import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendConversationReminderEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

// GET /api/cron/message-reminders — job horaire (Vercel Cron). Scanne les conversations
// dont le dernier message est resté sans réponse depuis > 24h, sans rappel déjà envoyé
// pour ce seuil (Message.reminderSentAt). Email UNIQUEMENT au destinataire (section 9/112).
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

  const cutoff = new Date(Date.now() - REMINDER_AFTER_MS);

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

    // Destinataire = la partie qui n'a PAS envoyé le dernier message (la balle est dans son camp)
    const recipient = last.senderId === m.profileAId ? m.profileB : m.profileA;
    const senderProfile = last.senderId === m.profileAId ? m.profileA : m.profileB;
    const missionTitle = m.missionA?.title ?? m.missionB?.title ?? null;

    if (recipient.user?.email) {
      await sendConversationReminderEmail(recipient.user.email, {
        partnerName: senderProfile.name,
        missionTitle,
        excerpt: last.content,
        matchId: m.id,
        optIn: recipient.user.emailOptIn,
      });
      sent++;
    }
    // Marque le seuil comme traité (évite les doublons), même si pas d'email envoyable
    await prisma.message.update({ where: { id: last.id }, data: { reminderSentAt: new Date() } });
  }

  return NextResponse.json({ ok: true, scanned: matches.length, remindersSent: sent });
}
