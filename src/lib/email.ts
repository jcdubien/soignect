import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";
import { appBaseUrl } from "@/lib/appUrl";

// ── Configuration ────────────────────────────────────────────────────────────
// Expéditeur pilotable par variable d'environnement : Resend REFUSE tout envoi depuis un
// domaine non vérifié (« Domain is not verified »), y compris son propre onboarding@resend.dev.
// Dès que soignect.fr est vérifié dans Resend, poser EMAIL_FROM="Soignect <noreply@soignect.fr>"
// dans Vercel suffit — aucun redéploiement de code nécessaire.
const FROM  = process.env.EMAIL_FROM ?? "Soignect <onboarding@resend.dev>";
const BRAND = "#0B3D5C"; // lagon profond — bouton principal

const baseUrl = appBaseUrl;

// ── Layout sobre commun (fond blanc, logo, bouton, mention légale) ─────────────
function layout(bodyHtml: string, cta?: { label: string; path: string }): string {
  const button = cta
    ? `<a href="${baseUrl()}${cta.path}"
         style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;
                font-weight:700;font-size:14px;padding:12px 26px;border-radius:10px;margin-top:12px">
         ${cta.label}
       </a>`
    : "";

  return `
  <div style="background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
              max-width:480px;margin:0 auto;padding:32px 24px;color:#1f2937">
    <div style="font-size:22px;font-weight:900;color:${BRAND};margin-bottom:24px">Soignect</div>
    ${bodyHtml}
    ${button}
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px" />
    <p style="font-size:11px;color:#9ca3af;line-height:1.5;margin:0">
      Soignect — mise en relation des professionnels de santé.<br/>
      Vous recevez cet email car vous avez un compte Soignect.
      Vous pouvez gérer vos notifications depuis votre compte.
    </p>
  </div>`;
}

// ── Envoi bas niveau — ne lève jamais, mais REMONTE toujours l'échec ───────────
// Renvoie true si Resend a accepté l'envoi, false sinon. Les appelants restent en
// fire-and-forget ; seul l'appelant qui logge un succès doit tester le retour.
//
// Piège corrigé (panne du 30/07) : le SDK Resend ne LÈVE PAS sur refus de l'API — il renvoie
// { data: null, error }. Le try/catch précédent n'était donc jamais déclenché et l'objet error
// partait à la poubelle : domaine non vérifié, quota dépassé ou clé invalide restaient
// totalement invisibles. On teste désormais `error` explicitement, et tout échec part dans Sentry.
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY non configurée — envoi ignoré");
    Sentry.captureMessage("[email] RESEND_API_KEY absente — aucun email n'est envoyé", "warning");
    return false;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error(`[email] refus Resend (${error.name}): ${error.message}`);
      Sentry.captureException(new Error(`[email] refus Resend (${error.name}): ${error.message}`), {
        // Pas de destinataire dans les extras : donnée personnelle, hors de Sentry.
        extra: { subject, from: FROM, statusCode: error.statusCode },
      });
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] échec d'envoi:", e);
    Sentry.captureException(e, { extra: { subject, from: FROM } });
    return false;
  }
}

// ── a) Bienvenue à l'inscription ───────────────────────────────────────────────
export async function sendWelcomeEmail(
  to: string,
  opts: { firstName: string; cibleLabel: string; optIn: boolean }
): Promise<void> {
  if (!opts.optIn) return;
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour ${opts.firstName},</p>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px">Votre compte est créé.</p>
     <p style="font-size:15px;line-height:1.6;margin:0">
       Complétez votre profil pour être visible par les ${opts.cibleLabel}.
     </p>`,
    { label: "Compléter mon profil", path: "/compte" }
  );
  await sendEmail(to, "Bienvenue sur Soignect", html);
}

// ── b) Nouvelle mise en relation ───────────────────────────────────────────────
export async function sendNewRelationEmail(
  to: string,
  opts: { actorLabel: string; optIn: boolean }
): Promise<void> {
  if (!opts.optIn) return;
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0">
       ${opts.actorLabel} a retenu votre profil. Connectez-vous pour démarrer la conversation.
     </p>`,
    { label: "Voir la proposition", path: "/matches" }
  );
  await sendEmail(to, "Vous avez une nouvelle mise en relation sur Soignect", html);
}

// ── c) Contrat disponible ──────────────────────────────────────────────────────
export async function sendContratEmail(
  to: string,
  opts: { matchId: string; optIn: boolean }
): Promise<void> {
  if (!opts.optIn) return;
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0">
       Un contrat a été préparé pour vous. Consultez-le et validez-le.
     </p>`,
    { label: "Voir le contrat", path: `/match/${opts.matchId}` }
  );
  await sendEmail(to, "Un contrat vous attend sur Soignect", html);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── f) Rappel conversation sans réponse depuis 24h (section 9/112) ─────────────
export async function sendConversationReminderEmail(
  to: string,
  opts: { partnerName: string | null; missionTitle: string | null; excerpt: string; matchId: string; optIn: boolean }
): Promise<void> {
  if (!opts.optIn) return;
  const who = opts.partnerName ?? "Un professionnel";
  const about = opts.missionTitle ? ` au sujet de « ${escapeHtml(opts.missionTitle)} »` : "";
  const excerpt = escapeHtml(opts.excerpt.slice(0, 140));
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px">
       ${escapeHtml(who)} attend votre réponse${about}.
     </p>
     <p style="font-size:14px;line-height:1.5;margin:0;color:#4b5563;border-left:3px solid #e5e7eb;padding-left:10px">
       « ${excerpt} »
     </p>`,
    { label: "Répondre", path: `/match/${opts.matchId}?chat=1` }
  );
  await sendEmail(to, "Un message attend votre réponse sur Soignect", html);
}

// ── e) Bascule vers le payant déclenchée (section 100) ─────────────────────────
// Notice de compte importante : envoyée quel que soit l'opt-in marketing.
export async function sendBillingTriggeredEmail(
  to: string,
  opts: { reason: "contrat" | "usage"; optIn?: boolean }
): Promise<void> {
  const motif = opts.reason === "contrat"
    ? "vous avez signé un contrat via Soignect"
    : "vous utilisez régulièrement le Planning Board";
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px">
       Félicitations — ${motif} 🎉. Vous avez tiré une vraie valeur de Soignect.
     </p>
     <p style="font-size:15px;line-height:1.6;margin:0">
       Pour continuer à profiter des fonctionnalités Premium/Boost, choisissez un plan
       dans les 14 jours. Sans action de votre part, l'accès Premium sera suspendu à la fin
       de ce délai (votre compte et vos données restent bien sûr conservés).
     </p>`,
    { label: "Choisir mon plan", path: "/premium" }
  );
  await sendEmail(to, "Votre accès Premium Soignect — action requise sous 14 jours", html);
}

// ── g) Consultation d'annonce par un candidat (notif recruteur) ────────────────
// Événement fréquent → soumis à l'opt-out dédié notifyConsultation (et non au
// consentement email global), coupable séparément depuis /compte.
export async function sendConsultationEmail(
  to: string,
  opts: {
    viewerLabel: string;
    listingWord?: string;                 // « annonce » (cabinet) | « disponibilité » (candidat)
    missionTitle: string | null;
    optIn: boolean;
    // CTA direct vers l'annonce/recherche du VISITEUR (section 180) : le destinataire va voir
    // qui s'intéresse à lui. Repli sur ses propres annonces si le visiteur n'a rien publié.
    cta?: { label: string; path: string };
  }
): Promise<void> {
  if (!opts.optIn) return;
  const listingWord = opts.listingWord ?? "annonce";
  const about = opts.missionTitle ? ` « ${escapeHtml(opts.missionTitle)} »` : "";
  const invite = opts.cta && opts.cta.path.startsWith("/annonce/")
    ? `<p style="font-size:14px;line-height:1.5;margin:8px 0 0;color:#4b5563">
         Découvrez son profil et son annonce d'un coup d'œil.
       </p>`
    : "";
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0">
       ${escapeHtml(opts.viewerLabel)} vient de consulter votre ${listingWord}${about}.
     </p>${invite}`,
    opts.cta ?? { label: "Voir mes annonces", path: "/planning" }
  );
  await sendEmail(to, `Votre ${listingWord} a été consultée sur Soignect`, html);
}

// ── h) Nouveau message dans une conversation (notif immédiate) ──────────────────
// Distinct du rappel 24h sans réponse (section 112) : celui-ci part à chaque message.
export async function sendNewMessageEmail(
  to: string,
  opts: { senderLabel: string; excerpt: string; matchId: string; optIn: boolean }
): Promise<void> {
  if (!opts.optIn) return;
  const excerpt = escapeHtml(opts.excerpt.slice(0, 140));
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px">
       ${escapeHtml(opts.senderLabel)} vous a envoyé un message sur Soignect.
     </p>
     <p style="font-size:14px;line-height:1.5;margin:0;color:#4b5563;border-left:3px solid #e5e7eb;padding-left:10px">
       « ${excerpt} »
     </p>`,
    { label: "Répondre", path: `/match/${opts.matchId}?chat=1` }
  );
  await sendEmail(to, "Nouveau message sur Soignect", html);
}

// ── i) Signature apposée par l'autre partie sur le contrat ─────────────────────
export async function sendSignatureAppliedEmail(
  to: string,
  opts: { signerLabel: string; bothSigned: boolean; matchId: string; optIn: boolean }
): Promise<void> {
  if (!opts.optIn) return;
  const body = opts.bothSigned
    ? `<p style="font-size:15px;line-height:1.6;margin:0">
         ${escapeHtml(opts.signerLabel)} a signé — le contrat est désormais signé par les deux parties.
         Vous pouvez télécharger le PDF officiel.
       </p>`
    : `<p style="font-size:15px;line-height:1.6;margin:0">
         ${escapeHtml(opts.signerLabel)} a apposé sa signature sur le contrat. Il ne manque plus que la vôtre.
       </p>`;
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>${body}`,
    { label: "Voir le contrat", path: `/match/${opts.matchId}/contrat` }
  );
  await sendEmail(to, "Signature du contrat sur Soignect", html);
}

// ── d) Mise en relation annulée ────────────────────────────────────────────────
export async function sendRelationCancelledEmail(
  to: string,
  opts: { optIn: boolean; wasConfirmed?: boolean }
): Promise<void> {
  if (!opts.optIn) return;
  // Annulation d'un match CONFIRMÉ (contrat signé) : message plus explicite sur les
  // conséquences (section 149). Sinon, annulation d'une simple mise en relation.
  const body = opts.wasConfirmed
    ? `Une mise en relation <strong>confirmée</strong> a été annulée par l'autre partie.
       Le contrat signé rattaché est annulé et le poste redevient à pourvoir.`
    : `Une mise en relation a été annulée par l'autre partie. Le poste est à nouveau disponible.`;
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0">${body}</p>`,
    { label: "Voir les propositions", path: "/annonces" }
  );
  await sendEmail(
    to,
    opts.wasConfirmed ? "Une mise en relation confirmée a été annulée" : "Une mise en relation a été annulée",
    html
  );
}

// ── j) Invitation à rejoindre Soignect pour se rattacher à un poste (section 187) ──────────────
// Transactionnel (le destinataire est explicitement invité, pas de compte donc pas d'opt-in) :
// toujours envoyé. Lien /register?inviteToken=… → rattachement auto à la finalisation.
export async function sendPosteInvitationEmail(
  to: string,
  opts: { cabinetName: string | null; postLabel: string; token: string }
): Promise<void> {
  const who = opts.cabinetName ? escapeHtml(opts.cabinetName) : "Un cabinet";
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0 0 8px">
       <strong>${who}</strong> vous invite à rejoindre Soignect pour le poste
       « ${escapeHtml(opts.postLabel)} ».
     </p>
     <p style="font-size:15px;line-height:1.6;margin:0">
       Créez votre compte en quelques minutes : vous serez automatiquement rattaché·e à ce poste.
     </p>`,
    { label: "Créer mon compte →", path: `/register?inviteToken=${encodeURIComponent(opts.token)}` }
  );
  await sendEmail(to, `Invitation à rejoindre Soignect — poste « ${opts.postLabel} »`, html);
}
