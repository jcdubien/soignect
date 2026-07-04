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

// ── d) Mise en relation annulée ────────────────────────────────────────────────
export async function sendRelationCancelledEmail(
  to: string,
  opts: { optIn: boolean }
): Promise<void> {
  if (!opts.optIn) return;
  const html = layout(
    `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">Bonjour,</p>
     <p style="font-size:15px;line-height:1.6;margin:0">
       Une mise en relation a été annulée par l'autre partie. Le poste est à nouveau disponible.
     </p>`,
    { label: "Voir les propositions", path: "/annonces" }
  );
  await sendEmail(to, "Une mise en relation a été annulée", html);
}
