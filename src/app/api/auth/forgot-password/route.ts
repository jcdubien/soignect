import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  // Toujours répondre 200 pour ne pas révéler si l'email existe
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 heure

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  if (!process.env.RESEND_API_KEY) {
    console.warn("[forgot-password] RESEND_API_KEY non configurée");
    return NextResponse.json({ ok: true });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Soignect <no-reply@soignect.fr>",
    to: user.email,
    subject: "Réinitialisation de votre mot de passe — Soignect",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:24px;font-weight:900;color:#1f2937;margin:0 0 8px">Soignect</h1>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px">La mise en relation intelligente des professionnels de santé</p>

        <h2 style="font-size:18px;font-weight:700;color:#1f2937;margin:0 0 12px">
          Réinitialisation de mot de passe
        </h2>
        <p style="color:#374151;font-size:14px;margin:0 0 24px">
          Vous avez demandé à réinitialiser votre mot de passe.
          Cliquez sur le bouton ci-dessous dans l'heure qui suit.
        </p>

        <a href="${resetUrl}"
           style="display:inline-block;background:#284777;color:#fff;text-decoration:none;
                  font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px">
          Réinitialiser mon mot de passe →
        </a>

        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">
          Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
        </p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
