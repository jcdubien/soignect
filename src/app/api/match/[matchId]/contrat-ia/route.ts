import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleDansLeMatch } from "@/lib/contrats/cotes";
import { checkDeepSeekBudget, recordDeepSeekCall } from "@/lib/deepseekBudget";
import { lireConversationPourContrat } from "@/lib/contrats/lectureConversation";

export const dynamic = "force-dynamic";

// POST — lit la conversation du match et propose des ajustements du contrat (09/11).
// Déclenchée par un bouton, jamais à l'ouverture de la page : chaque lecture est un appel
// DeepSeek compté au budget (lib/deepseekBudget). Plafond atteint ou échec → { degraded: true },
// l'écran le dit et le contrat reste modifiable à la main.
const Corps = z.object({
  missionType: z.string().max(30).nullable(),
  dateDebut: z.string().max(10),
  dateFin: z.string().max(10),
  retrocessionPct: z.number().int().min(0).max(100).nullable(),
  assiette: z.enum(["ENCAISSES", "REALISES"]).nullable().optional().default(null),
  redevancePct: z.number().int().min(0).max(100).nullable(),
  delaiPaiementJours: z.number().int().min(0).max(365).nullable(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  const profileId = session?.user?.profileId as string | undefined;
  if (!profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { matchId } = await params;

  const parsed = Corps.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      profileAId: true, profileBId: true, remplaceProfileId: true, termesContrat: true,
      profileA: { select: { type: true } }, profileB: { select: { type: true } },
    },
  });
  if (!match) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const role = roleDansLeMatch(match, profileId);
  if (!role) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  // Termes figés à la première signature : plus rien à proposer.
  if (match.termesContrat) return NextResponse.json({ propositions: [], points: [], figes: true });

  if (!(await checkDeepSeekBudget(profileId))) return NextResponse.json({ degraded: true });

  const messages = await prisma.message.findMany({
    where: { matchId },
    select: { senderId: true, content: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 300,
  });
  if (messages.length === 0) return NextResponse.json({ propositions: [], points: [], vide: true });

  const jeSuisTitulaire = role === "REMPLACE"
    || (role === "A" ? match.profileA.type : match.profileB.type) === "TITULAIRE";
  const lecture = await lireConversationPourContrat(
    messages.map((m) => ({ deMoi: m.senderId === profileId, texte: m.content, date: m.createdAt })),
    parsed.data,
    jeSuisTitulaire,
  );
  if (!lecture) return NextResponse.json({ degraded: true });
  await recordDeepSeekCall(profileId, parsed.data.missionType);
  return NextResponse.json(lecture);
}
