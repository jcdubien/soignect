import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { BriqueStatus, MatchStatus } from "@prisma/client";
import { logTraceEvent } from "@/lib/trace";
import { triggerBillingIfNeeded } from "@/lib/billing";
import { sendBillingTriggeredEmail, sendSignatureAppliedEmail } from "@/lib/email";
import { reportStructureContractUsage } from "@/lib/stripe-usage";
import { attachAssistantPostForMatch } from "@/lib/assistantPost";
import { createNotification } from "@/lib/notifications";
import { isContractProfileEnforced } from "@/lib/platform";
import { missingContractFields, missingContractLabels, CONTRACT_IDENTITY_SELECT } from "@/lib/contractProfile";
import {
  BUCKET_SIGNATURES, cheminSignatureProfil, copierSignatureVersMatch,
} from "@/lib/signatureEnregistree";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

// Côté de signature de l'utilisateur courant : le titulaire (recruteur) signe le
// slot "titulaire", tout autre profil signe le slot "remplacant".
function mySide(type: string): "titulaire" | "remplacant" {
  return type === "TITULAIRE" ? "titulaire" : "remplacant";
}

async function loadMatch(matchId: string, profileId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { profileA: { select: { type: true } }, profileB: { select: { type: true } } },
  });
  if (!match) return null;
  if (match.profileAId !== profileId && match.profileBId !== profileId) return null;
  return match;
}

// GET — statut des signatures du match
export async function GET(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const match = await loadMatch(matchId, session.user.profileId as string);
  if (!match) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const myProfile = match.profileAId === session.user.profileId ? match.profileA : match.profileB;
  const side = mySide(myProfile.type);
  const titulaireSigned = !!match.signatureTitulaireUrl;
  const remplacantSigned = !!match.signatureRemplacantUrl;

  // Signature conservée du LECTEUR (section 242) — l'écran doit pouvoir proposer de la réutiliser
  // au lieu d'exiger une photo à chaque contrat. Booléen seulement : le chemin dans le bucket
  // privé n'a aucune raison de sortir vers le navigateur.
  const moi = await prisma.profile.findUnique({
    where: { id: session.user.profileId as string },
    select: { signatureUrl: true },
  });

  return NextResponse.json({
    signatureEnregistree: !!moi?.signatureUrl,
    mySide: side,
    titulaireSigned,
    remplacantSigned,
    titulaireAt: match.signatureTitulaireAt,
    remplacantAt: match.signatureRemplacantAt,
    mineSigned: side === "titulaire" ? titulaireSigned : remplacantSigned,
    bothSigned: titulaireSigned && remplacantSigned,
  });
}

// POST — upload de la photo de signature de l'utilisateur courant
export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const match = await loadMatch(matchId, session.user.profileId as string);
  if (!match) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const myProfile = match.profileAId === session.user.profileId ? match.profileA : match.profileB;
  const side = mySide(myProfile.type);

  // Identité contractuelle (section 150) — MÊME garde que la génération du PDF, appliqué ici
  // aussi. Il ne vivait que dans contrat/route.ts : le parcours normal était bien fermé (sans
  // PDF généré, on n'atteint pas la signature dans l'interface), mais l'endpoint restait
  // ouvert — on pouvait apposer une signature sur un contrat dont l'identité d'une des parties
  // est incomplète. Une signature engage : elle mérite le même contrôle que le document.
  if (await isContractProfileEnforced()) {
    const parties = await prisma.profile.findMany({
      where: { id: { in: [match.profileAId, match.profileBId] } },
      // Liste dérivée de la source unique (section 236), plus recopiée : cette copie-ci avait
      // oublié `name`, et bloquait la signature de tout le monde sur un champ pourtant rempli.
      select: { id: true, ...CONTRACT_IDENTITY_SELECT },
    });
    const incomplet = parties.find((x) => missingContractFields(x).length > 0);
    if (incomplet) {
      const mien = incomplet.id === session.user.profileId;
      return NextResponse.json(
        {
          error: mien
            ? `Identité contractuelle incomplète — complétez votre profil avant de signer (${missingContractLabels(incomplet).join(", ")}).`
            : "Identité contractuelle incomplète du côté de l'autre partie — elle doit compléter son profil avant que le contrat puisse être signé.",
        },
        { status: 422 }
      );
    }
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  // Deux façons de signer (section 242) : une photo, ou la signature déjà conservée. Le second
  // chemin n'envoie aucun fichier — c'est ce qui évite de redemander une photo à chaque contrat.
  const reutiliser = form?.get("reutiliser") === "true";
  // Consentement de conservation. Booléen EXPLICITE, jamais déduit : sans case cochée, la
  // signature ne sert qu'à ce contrat-ci et rien n'est gardé.
  const enregistrer = form?.get("enregistrer") === "true";

  const supabase = getSupabaseAdmin();
  let path: string;

  if (reutiliser) {
    // ── Réutilisation de la signature conservée ──────────────────────────────────────────
    // On COPIE le fichier à l'emplacement du match, on ne le référence pas : un contrat signé
    // doit rester figé si la personne refait sa signature plus tard. Voir signatureEnregistree.ts.
    const moi = await prisma.profile.findUnique({
      where: { id: session.user.profileId as string },
      select: { signatureUrl: true },
    });
    if (!moi?.signatureUrl) {
      return NextResponse.json(
        { error: "Aucune signature conservée — prenez-la en photo." },
        { status: 422 },
      );
    }
    const copie = await copierSignatureVersMatch(moi.signatureUrl, matchId, side);
    if (!copie) {
      // Refus explicite plutôt qu'une ligne pointant vers un fichier absent : le contrat
      // paraîtrait signé et le PDF n'afficherait rien.
      return NextResponse.json(
        { error: "Signature conservée introuvable — prenez-la en photo à nouveau." },
        { status: 422 },
      );
    }
    path = copie;
  } else {
    // ── Signature prise en photo ─────────────────────────────────────────────────────────
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Fichier trop lourd (max 5 Mo)" }, { status: 400 });
    const contentType = file.type || "image/jpeg";
    if (!ALLOWED.includes(contentType)) return NextResponse.json({ error: `Format non supporté : ${contentType}` }, { status: 400 });

    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    path = `${matchId}/${side}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(BUCKET_SIGNATURES)
      .upload(path, buffer, { contentType, upsert: true });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // Conservation, si et seulement si la case a été cochée. Second fichier, à un emplacement
    // propre au profil : le contrat garde le sien, indépendant de celui-ci.
    if (enregistrer) {
      const cheminProfil = cheminSignatureProfil(session.user.profileId as string, ext);
      const { error: profErr } = await supabase.storage
        .from(BUCKET_SIGNATURES)
        .upload(cheminProfil, buffer, { contentType, upsert: true });
      // Échec de conservation = la signature du contrat reste valable. On ne fait pas échouer un
      // geste engageant pour une commodité : la case pourra être recochée au contrat suivant.
      if (!profErr) {
        await prisma.profile.update({
          where: { id: session.user.profileId as string },
          data: { signatureUrl: cheminProfil },
        });
      } else {
        console.error("[signature] conservation impossible :", profErr.message);
      }
    }
  }

  const now = new Date();
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: side === "titulaire"
      ? { signatureTitulaireUrl: path, signatureTitulaireAt: now }
      : { signatureRemplacantUrl: path, signatureRemplacantAt: now },
    select: { signatureTitulaireUrl: true, signatureRemplacantUrl: true, missionAId: true, missionBId: true },
  });

  const bothSigned = !!updated.signatureTitulaireUrl && !!updated.signatureRemplacantUrl;

  // Notification à l'autre partie — une signature vient d'être apposée (section notifications).
  // Fire-and-forget, soumise au consentement email global (emailOptIn).
  const otherProfileId = match.profileAId === session.user.profileId ? match.profileBId : match.profileAId;
  const signerLabel = myProfile.type === "TITULAIRE" ? "Le cabinet" : "Le remplaçant";
  prisma.profile
    .findUnique({
      where: { id: otherProfileId },
      select: { user: { select: { id: true, email: true, emailOptIn: true } } },
    })
    .then((other) => {
      if (!other?.user?.email) return;
      // Notification in-app (section 155) — en parallèle de l'email.
      createNotification({
        userId: other.user.id,
        type: "signature",
        message: bothSigned
          ? `${signerLabel} a signé — le contrat est signé des deux côtés.`
          : `${signerLabel} a signé le contrat — à votre tour.`,
        linkUrl: `/match/${matchId}/contrat`,
      });
      return sendSignatureAppliedEmail(other.user.email, {
        signerLabel,
        bothSigned,
        matchId,
        optIn: other.user.emailOptIn,
      });
    })
    .catch(() => {});

  // Contrat confirmé quand les DEUX signatures photo sont présentes (section 61) :
  // remplit la timeline (missions liées → CONFIRME) et confirme le match.
  if (bothSigned) {
    // Noms des deux parties pour renseigner matchedName sur chaque poste (section 1c / 6) :
    // le poste de A est rempli par B, et inversement.
    const full = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        missionAId: true, missionBId: true,
        profileA: { select: { name: true } },
        profileB: { select: { name: true } },
      },
    });
    if (full?.missionAId) {
      await prisma.mission.update({
        where: { id: full.missionAId },
        data: { briqueStatus: BriqueStatus.CONFIRME, statusUpdatedAt: now, matchedName: full.profileB?.name ?? null },
      });
    }
    if (full?.missionBId) {
      await prisma.mission.update({
        where: { id: full.missionBId },
        data: { briqueStatus: BriqueStatus.CONFIRME, statusUpdatedAt: now, matchedName: full.profileA?.name ?? null },
      });
    }
    const missionIds = [updated.missionAId, updated.missionBId].filter((x): x is string => !!x);
    await prisma.match.update({ where: { id: matchId }, data: { status: MatchStatus.CONFIRME } });

    // Bascule individuelle vers le payant — critère 1 (contrat signé), section 100.
    // Le cabinet = partie TITULAIRE du match. Détection synchrone.
    const titulaireId = match.profileA.type === "TITULAIRE" ? match.profileAId : match.profileBId;
    // Metered billing structure privée (section 7) — 1 contrat = 1 unité, idempotent
    reportStructureContractUsage(titulaireId, `structure_usage_${matchId}`);
    try {
      const newlyTriggered = await triggerBillingIfNeeded(titulaireId);
      if (newlyTriggered) {
        const cab = await prisma.profile.findUnique({
          where: { id: titulaireId },
          select: { name: true, user: { select: { email: true, emailOptIn: true } } },
        });
        if (cab?.user?.email) {
          // Notification (fire-and-forget) — grâce avant coupure (section 4)
          sendBillingTriggeredEmail(cab.user.email, { reason: "contrat", optIn: cab.user.emailOptIn });
        }
      }
    } catch (e) {
      console.error("[billing] trigger critère 1 échoué (ignoré):", e);
    }

    // Traçabilité (section 86) — contrat signé par les deux parties.
    // Fire-and-forget : on enrichit avec la commune sans bloquer la réponse.
    const traceMissionId = missionIds[0];
    prisma.mission
      .findUnique({ where: { id: traceMissionId }, select: { location: true, missionType: true } })
      .then((m) =>
        logTraceEvent({
          eventType: "CONTRACT_SIGNED",
          matchId,
          missionId: traceMissionId,
          commune: m?.location ?? null,
          missionType: m?.missionType ?? null,
        })
      )
      .catch(() => logTraceEvent({ eventType: "CONTRACT_SIGNED", matchId, missionId: traceMissionId }));

    // Rattachement automatique du poste à l'assistant (section 153, point 1) — pour un
    // contrat d'ASSISTANAT uniquement. Non bloquant (le helper avale ses erreurs).
    await attachAssistantPostForMatch(matchId);
  }

  return NextResponse.json({ ok: true, mySide: side, bothSigned }, { status: 201 });
}
