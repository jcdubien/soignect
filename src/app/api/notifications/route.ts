import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/dbRetry";

export const dynamic = "force-dynamic";

// GET /api/notifications — notifications récentes du compte courant + compteur non lus (section 155).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = session.user.id as string;

  try {
    const [items, unreadCount] = await withDbRetry(() =>
      Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
        prisma.notification.count({ where: { userId, readAt: null } }),
      ]),
    );
    return NextResponse.json({ items, unreadCount });
  } catch (e) {
    // Endpoint sondé toutes les 60 s par la cloche : si la DB reste indisponible même après
    // retry (P1017 transitoire, section 186), on renvoie un état vide plutôt qu'un 500 — la
    // cloche affiche 0, la page n'est pas cassée et Sentry n'est pas spammé à chaque poll.
    console.error("[notifications] lecture échouée (repli état vide):", e);
    return NextResponse.json({ items: [], unreadCount: 0 });
  }
}

// PATCH /api/notifications — marquer comme lu. Body { id } pour une seule, sinon toutes.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = session.user.id as string;

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;

  await withDbRetry(() =>
    prisma.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    }),
  );

  return NextResponse.json({ ok: true });
}
