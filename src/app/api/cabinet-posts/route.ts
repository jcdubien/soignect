import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PostType } from "@prisma/client";

const createSchema = z.object({
  label: z.string().min(1).max(60),
  postType: z.nativeEnum(PostType).optional(),
  noticeMonths: z.number().int().min(0).max(12).optional(),
});

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

  const post = await prisma.cabinetPost.create({
    data: {
      cabinetId: session.user.profileId as string,
      label: parsed.data.label,
      postType: parsed.data.postType ?? PostType.REMPLACEMENT_REGULIER,
      noticeMonths: parsed.data.noticeMonths ?? 3,
    },
  });

  return NextResponse.json(post, { status: 201 });
}
