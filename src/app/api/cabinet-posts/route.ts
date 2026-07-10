import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PostType, MissionType, BriqueStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().min(1).max(60),
  postType: z.nativeEnum(PostType).optional(),
  noticeMonths: z.number().int().min(0).max(12).optional(),
  // Date d'occupation réelle (section 56) — peut être dans le passé
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
});

// Type de poste → type de mission d'occupation
const POST_TO_MISSION: Record<PostType, MissionType> = {
  [PostType.TITULAIRE]:             MissionType.REMPLACEMENT,
  [PostType.ASSOCIE]:               MissionType.COLLABORATION,
  [PostType.ASSISTANT]:             MissionType.ASSISTANAT,
  [PostType.COLLABORATION]:         MissionType.COLLABORATION,
  [PostType.REMPLACEMENT_REGULIER]: MissionType.REMPLACEMENT,
};

// GET /api/cabinet-posts — liste des postes du cabinet courant
export async function GET() {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const posts = await prisma.cabinetPost.findMany({
    where: { cabinetId: session.user.profileId as string },
    include: {
      missions: {
        where: { isActive: true },
        include: {
          matchesA: { include: { profileB: { select: { name: true, type: true } } } },
          matchesB: { include: { profileA: { select: { name: true, type: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(posts);
}

// POST /api/cabinet-posts — créer un poste
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const profileId = session.user.profileId as string;
  const postType = parsed.data.postType ?? PostType.REMPLACEMENT_REGULIER;

  const post = await prisma.cabinetPost.create({
    data: {
      cabinetId: profileId,
      label: parsed.data.label,
      postType,
      noticeMonths: parsed.data.noticeMonths ?? 3,
    },
  });

  // Si une date d'occupation est fournie, créer la Mission de présence associée (section 56).
  // isActive=false → visible sur la timeline du poste mais exclue du feed swipe.
  if (parsed.data.startDate) {
    await prisma.mission.create({
      data: {
        profileId,
        title: parsed.data.label,
        location: "",
        specialties: [],
        missionType: POST_TO_MISSION[postType],
        briqueStatus: BriqueStatus.CONFIRME,
        cabinetPostId: post.id,
        startDate: new Date(parsed.data.startDate),
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        isActive: false,
      },
    });
  }

  return NextResponse.json(post, { status: 201 });
}
