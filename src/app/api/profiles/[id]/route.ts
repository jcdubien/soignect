import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Profession, Region, TitulaireKind } from "@prisma/client";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().max(100).optional(),
  bio: z.string().max(300).optional(),
  bioTinder: z.string().max(700).optional(),
  photoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  region: z.nativeEnum(Region).optional(),
  profession: z.nativeEnum(Profession).optional(),
  isVerified: z.boolean().optional(),
  isEmployeur: z.boolean().optional(),
  titulaireKind: z.nativeEnum(TitulaireKind).optional(),
  // Champs notifications (portés par User, section 50-51)
  phone: z.string().max(20).nullable().optional(),
  phoneCountry: z.string().max(4).optional(),
  emailOptIn: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await prisma.profile.findUnique({
    where: { id },
    include: { missions: { where: { isActive: true } } },
  });
  if (!profile) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  return NextResponse.json(profile);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (profile.userId !== session.user.id && (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { phone, phoneCountry, emailOptIn, titulaireKind, ...profileData } = parsed.data;

  const updated = await prisma.profile.update({
    where: { id },
    data: {
      ...profileData,
      // titulaireKind est la source de vérité ; isEmployeur (libellés) en est dérivé
      ...(titulaireKind !== undefined
        ? { titulaireKind, isEmployeur: titulaireKind === "STRUCTURE" }
        : {}),
    },
  });

  // Champs notifications → portés par le User lié
  if (phone !== undefined || phoneCountry !== undefined || emailOptIn !== undefined) {
    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        ...(phone !== undefined ? { phone } : {}),
        ...(phoneCountry !== undefined ? { phoneCountry } : {}),
        ...(emailOptIn !== undefined ? { emailOptIn } : {}),
      },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { id }, select: { userId: true } });
  if (!profile) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (profile.userId !== session.user.id && (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  // Cascade via Prisma (onDelete: Cascade on Profile → User)
  await prisma.user.delete({ where: { id: profile.userId } });

  return NextResponse.json({ deleted: true });
}
