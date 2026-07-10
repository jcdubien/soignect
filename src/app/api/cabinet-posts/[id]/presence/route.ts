import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PostType, MissionType, BriqueStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

// Type de poste → type de mission d'occupation
const POST_TO_MISSION: Record<PostType, MissionType> = {
  [PostType.TITULAIRE]:             MissionType.REMPLACEMENT,
  [PostType.ASSOCIE]:               MissionType.COLLABORATION,
  [PostType.ASSISTANT]:             MissionType.ASSISTANAT,
  [PostType.COLLABORATION]:         MissionType.COLLABORATION,
  [PostType.REMPLACEMENT_REGULIER]: MissionType.REMPLACEMENT,
};

const schema = z.object({
  practitionerName: z.string().max(100).optional(),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
});

// POST /api/cabinet-posts/[id]/presence — déclarer une présence confirmée (section 55 [2]).
// Crée directement une Mission briqueStatus=CONFIRME sur ce poste, sans passer par
// un match ni le feed (isActive=false → visible sur la timeline, hors annonces swipe).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const post = await prisma.cabinetPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (post.cabinetId !== session.user.profileId) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const name = parsed.data.practitionerName?.trim();

  const mission = await prisma.mission.create({
    data: {
      profileId: session.user.profileId as string,
      title: name && name.length > 0 ? name : post.label,
      location: "",
      specialties: [],
      missionType: POST_TO_MISSION[post.postType],
      briqueStatus: BriqueStatus.CONFIRME,
      cabinetPostId: post.id,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      isActive: false,
    },
  });

  return NextResponse.json(mission, { status: 201 });
}
