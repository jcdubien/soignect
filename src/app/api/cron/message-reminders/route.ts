import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendConversationReminderEmail } from "@/lib/email";
import { traiterMatchsDormants, SEUIL_DORMANCE_JOURS } from "@/lib/matchsDormants";

export const dynamic = "force-dynamic";

const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

// GET /api/cron/message-reminders — job quotidien (Vercel Cron, 9h00). Scanne les conversations
// dont le dernier message est resté sans réponse depuis > 24h, sans rappel déjà envoyé
// pour ce seuil (Message.reminderSentAt). Email UNIQUEMENT au destinataire (section 9/112).
//
// ── DEUX TRAITEMENTS DANS UNE SEULE ROUTE, ET POURQUOI (section 279) ─────────────────────────
//
// L'expiration des mises en relation dormantes est greffée ici plutôt que servie par un cron
// à elle. Ce n'est PAS un choix de commodité : le plan Vercel Hobby n'autorise que **deux**
// entrées dans `vercel.json`, et les deux sont prises (`message-reminders` 9h00,
// `publication-reminders` 9h15). Une troisième ne se déploierait pas — pire, le dépôt a déjà
// payé l'apprentissage qu'une entrée de cron invalide bloque SILENCIEUSEMENT tous les builds.
//
// La greffe est de surcroît le bon endroit : les deux traitements partent du même objet — une
// relation et ses messages.
//
// ⚠️ LEUR SÉPARATION N'EST PLUS AUTOMATIQUE. Tant que l'expiration ne visait que les relations
// SANS aucun message, les deux périmètres étaient disjoints par construction. Depuis
// l'élargissement au silence (06/10), une conversation ancienne relève des deux : elle a des
// messages (donc le rappel la voit) et son dernier message est vieux (donc l'expiration aussi).
// Sans garde, la même personne recevrait dans la même minute « quelqu'un attend votre réponse »
// et « cette relation prend fin dans 3 jours » — deux courriers qui se contredisent sur le ton.
//
// Le rappel CÈDE donc la main au-delà du seuil de dormance : passé ce point, la relation
// n'appartient plus au registre de la conversation à poursuivre.
//
// Les deux blocs sont INDÉPENDANTS À L'ÉCHEC : une erreur sur l'expiration ne doit pas priver
// les conversations de leur rappel, ni l'inverse.
export async function GET(req: Request) {
  // Protection : si CRON_SECRET est défini, exiger le header Authorization (Vercel Cron)
  // ou un paramètre ?key=.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authz = req.headers.get("authorization");
    const key = new URL(req.url).searchParams.get("key");
    if (authz !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "Interdit" }, { status: 401 });
    }
  }

  // `?simulation=1` — compte ce qui SERAIT fait sans rien écrire ni envoyer. Le balayage des
  // dormants agit sur des relations réelles : pouvoir le mesurer avant de le laisser agir n'est
  // pas un confort, c'est la seule façon de vérifier le périmètre sur la vraie base.
  // Il couvre les DEUX traitements. Une simulation qui enverrait quand même les rappels de
  // conversation ne serait pas une simulation — et c'est précisément la route qu'on appelle
  // pour vérifier le périmètre avant de laisser le cron agir.
  const simulation = new URL(req.url).searchParams.get("simulation") === "1";

  const cutoff = new Date(Date.now() - REMINDER_AFTER_MS);
  const seuilDormance = new Date(Date.now() - SEUIL_DORMANCE_JOURS * 86_400_000);

  const matches = await prisma.match.findMany({
    where: { messages: { some: {} } },
    select: {
      id: true, profileAId: true, profileBId: true,
      profileA: { select: { name: true, user: { select: { email: true, emailOptIn: true } } } },
      profileB: { select: { name: true, user: { select: { email: true, emailOptIn: true } } } },
      missionA: { select: { title: true } },
      missionB: { select: { title: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, senderId: true, content: true, createdAt: true, reminderSentAt: true },
      },
    },
  });

  let sent = 0;
  for (const m of matches) {
    const last = m.messages[0];
    if (!last || last.reminderSentAt || last.createdAt >= cutoff) continue;
    // Au-delà du seuil de dormance, cette relation relève de l'expiration (voir en-tête).
    if (last.createdAt <= seuilDormance) continue;

    // Destinataire = la partie qui n'a PAS envoyé le dernier message (la balle est dans son camp)
    const recipient = last.senderId === m.profileAId ? m.profileB : m.profileA;
    const senderProfile = last.senderId === m.profileAId ? m.profileA : m.profileB;
    const missionTitle = m.missionA?.title ?? m.missionB?.title ?? null;

    if (recipient.user?.email) {
      sent++;
      if (!simulation) {
        await sendConversationReminderEmail(recipient.user.email, {
          partnerName: senderProfile.name,
          missionTitle,
          excerpt: last.content,
          matchId: m.id,
          optIn: recipient.user.emailOptIn,
        });
      }
    }
    if (simulation) continue; // ne pas consommer le seuil d'un rappel qu'on n'a pas envoyé
    // Marque le seuil comme traité (évite les doublons), même si pas d'email envoyable
    await prisma.message.update({ where: { id: last.id }, data: { reminderSentAt: new Date() } });
  }

  // ── Expiration des mises en relation dormantes (section 279) ──────────────────────────────
  // Isolée : le rappel ci-dessus est déjà envoyé à ce stade, et ne doit pas être annulé par un
  // échec ici. On rapporte l'erreur dans la réponse plutôt que de la taire.
  let dormants;
  let erreurDormants: string | null = null;
  try {
    dormants = await traiterMatchsDormants({ simulation });
  } catch (e) {
    erreurDormants = e instanceof Error ? e.message : String(e);
    console.error("[cron] expiration des dormants échouée:", e);
  }

  return NextResponse.json({
    ok: true,
    scanned: matches.length,
    remindersSent: sent,
    dormants: dormants ?? null,
    ...(erreurDormants ? { erreurDormants } : {}),
    ...(simulation ? { simulation: true } : {}),
  });
}
