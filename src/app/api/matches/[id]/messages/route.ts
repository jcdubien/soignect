import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendNewMessageEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

async function getMatchAndVerify(matchId: string, profileId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return null;
  if (match.profileAId !== profileId && match.profileBId !== profileId) return null;
  return match;
}

// GET /api/matches/[id]/messages?after=<ISO>
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const match = await getMatchAndVerify(id, session.user.profileId);
  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

  const after = req.nextUrl.searchParams.get("after");

  const messages = await prisma.message.findMany({
    where: {
      matchId: id,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    include: { sender: { select: { id: true, type: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json(messages);
}

// POST /api/matches/[id]/messages
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const match = await getMatchAndVerify(id, session.user.profileId);
  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

  const body = await req.json();
  const parsed = z.object({ content: z.string().min(1).max(1000) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Message invalide" }, { status: 400 });

  const message = await prisma.message.create({
    data: {
      matchId: id,
      senderId: session.user.profileId,
      content: parsed.data.content,
    },
    include: { sender: { select: { id: true, type: true } } },
  });

  // Notification immédiate au destinataire — nouveau message (section notifications).
  // Distincte du rappel 24h sans réponse (cron message-reminders). Fire-and-forget,
  // soumise au consentement email global (emailOptIn).
  const recipientId = match.profileAId === session.user.profileId ? match.profileBId : match.profileAId;
  prisma.profile
    .findUnique({
      where: { id: recipientId },
      select: { user: { select: { email: true, emailOptIn: true } } },
    })
    .then((rec) => {
      if (!rec?.user?.email) return;
      const senderLabel = message.sender.type === "TITULAIRE" ? "Un cabinet" : "Un remplaçant";
      return sendNewMessageEmail(rec.user.email, {
        senderLabel,
        excerpt: parsed.data.content,
        matchId: id,
        optIn: rec.user.emailOptIn,
      });
    })
    .catch(() => {});

  return NextResponse.json(message, { status: 201 });
}
