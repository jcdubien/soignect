import { prisma } from "@/lib/prisma";

// Notifications in-app (section 155) — canal d'affichage EN PLUS des emails (section 137),
// pas à la place. Une entrée créée en parallèle de chaque email, mêmes déclencheurs.
// Fire-and-forget : ne jette jamais, ne bloque jamais le flux appelant.
export type NotificationType = "message" | "match" | "signature" | "consultation";

export async function createNotification(opts: {
  userId: string | null | undefined;
  type: NotificationType;
  message: string;
  linkUrl: string;
}): Promise<void> {
  if (!opts.userId) return;
  try {
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        message: opts.message.slice(0, 300),
        linkUrl: opts.linkUrl,
      },
    });
  } catch (e) {
    console.error("[notifications] création échouée (ignorée):", e);
  }
}
