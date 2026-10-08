import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendNewMessageEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { contientUnNumero } from "@/lib/numeroTelephone";
import { logTraceEvent } from "@/lib/trace";

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

  // Marquer comme lus les messages reçus (envoyés par l'autre) — section 155. Fire-and-forget :
  // ouvrir la conversation vaut lecture ; alimente le badge « non lu » de la page Relations.
  prisma.message.updateMany({
    where: { matchId: id, senderId: { not: session.user.profileId }, readAt: null },
    data: { readAt: new Date() },
  }).catch(() => {});

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

  // ── LE COMPTAGE SE REJOUE TOUT SEUL (section 292) ─────────────────────────────────────────
  //
  // La mesure du 08/10 (7 messages sur 100, 6 conversations sur 17) a demandé de relire TOUS les
  // messages en base et d'y passer un motif. C'est faisable à 100 messages ; ça ne l'est plus
  // longtemps, et ça oblige à toucher au contenu des conversations à chaque fois qu'on veut
  // savoir si le chiffre a bougé.
  //
  // Cette trace déplace la mesure au moment de l'écriture. Elle ne porte NI le contenu, NI le
  // numéro, ni même la position du motif : seulement « un message de cette conversation en
  // contenait un ». C'est tout ce dont la question a besoin, et c'est la seule forme qui n'exige
  // jamais de relire ce que deux personnes se sont écrit.
  //
  // Posée côté serveur, et non sur le clic de l'avertissement : on compte ce qui est RÉELLEMENT
  // parti, pas ce que l'écran a montré. Les deux divergent dès que quelqu'un contourne la
  // détection côté client, ou l'a déjà vue dans cette conversation.
  if (contientUnNumero(parsed.data.content)) {
    logTraceEvent({ eventType: "NUMERO_PARTAGE", matchId: id, profileId: session.user.profileId });
  }

  // Notification immédiate au destinataire — nouveau message (section notifications).
  // Distincte du rappel 24h sans réponse (cron message-reminders). Fire-and-forget,
  // soumise au consentement email global (emailOptIn).
  const recipientId = match.profileAId === session.user.profileId ? match.profileBId : match.profileAId;
  prisma.profile
    .findUnique({
      where: { id: recipientId },
      select: { user: { select: { id: true, email: true, emailOptIn: true } } },
    })
    .then((rec) => {
      if (!rec?.user?.email) return;
      const senderLabel = message.sender.type === "TITULAIRE" ? "Un cabinet" : "Un remplaçant";
      // Notification in-app (section 155) — en parallèle de l'email.
      createNotification({
        userId: rec.user.id,
        type: "message",
        message: `${senderLabel} vous a envoyé un message : « ${parsed.data.content.slice(0, 60)} »`,
        linkUrl: `/match/${id}?chat=1`,
      });
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
