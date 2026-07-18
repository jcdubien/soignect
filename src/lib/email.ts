import { Resend } from "resend";

// ── Configuration ────────────────────────────────────────────────────────────
// onboarding@resend.dev : expéditeur de test Resend (fonctionne sans domaine vérifié).
// À remplacer par noreply@soignect.fr une fois le domaine vérifié dans Resend.
const FROM  = "Soignect <onboarding@resend.dev>";
const BRAND = "#0B3D5C"; // lagon profond — bouton principal

function baseUrl(): string {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

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

// ── Envoi bas niveau — fire-and-forget (ne lève jamais d'erreur) ───────────────
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY non configurée — envoi ignoré");
    return;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (e) {
    console.error("[email] échec d'envoi:", e);
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
       Un contrat de remplacement a été préparé pour vous. Consultez-le et validez-le.
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
    { label: "Répondre", path: `/matches?matchId=${opts.matchId}` }
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
  opts: { viewerLabel: string; missionTitle: string | null; optIn: boolean }
): Promise<void> {
  if (!opts.optIn) return;
  const about = opts.missionTitle ? ` « ${escapeHtml(opts.missionTitle)} »` : "";
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0">
       ${escapeHtml(opts.viewerLabel)} vient de consulter votre annonce${about}.
     </p>`,
    { label: "Voir mes annonces", path: "/planning" }
  );
  await sendEmail(to, "Votre annonce a été consultée sur Soignect", html);
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
    { label: "Répondre", path: `/matches?matchId=${opts.matchId}` }
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
