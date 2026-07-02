import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

const schema = z.object({
  type: z.enum(["REMPLACANT", "ASSISTANT", "TITULAIRE"]).optional(),
  isVerified: z.boolean().optional(),
  isFounding: z.boolean().optional(),
  subscriptionPlan: z.enum(["FREE", "PREMIUM", "BOOST"]).optional(),
  desirabilityScore: z.number().min(0).max(10).optional(),
  desirabilityOverride: z.number().min(0).max(10).nullable().optional(),
  desirabilityExpiry: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Invariant: isFounding profiles never below desirabilityScore 10
  if (data.desirabilityScore !== undefined || data.isFounding !== undefined) {
    const current = await prisma.profile.findUnique({
      where: { id },
      select: { isFounding: true, desirabilityScore: true },
    });
    const effectiveFounding =
      data.isFounding !== undefined ? data.isFounding : current?.isFounding;
    if (effectiveFounding && data.desirabilityScore !== undefined && data.desirabilityScore < 10) {
      data.desirabilityScore = 10;
    }
  }

  const updated = await prisma.profile.update({
    where: { id },
    data: {
      ...(data.type && { type: data.type }),
      ...(data.isVerified !== undefined && { isVerified: data.isVerified }),
      ...(data.isFounding !== undefined && { isFounding: data.isFounding }),
      ...(data.subscriptionPlan && { subscriptionPlan: data.subscriptionPlan }),
      ...(data.desirabilityScore !== undefined && { desirabilityScore: data.desirabilityScore }),
      ...("desirabilityOverride" in data && { desirabilityOverride: data.desirabilityOverride }),
      ...("desirabilityExpiry" in data && {
        desirabilityExpiry: data.desirabilityExpiry ? new Date(data.desirabilityExpiry) : null,
      }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: { id: true },
  });

  console.log(`[admin] profile updated: ${id}`, data);
  return NextResponse.json(updated);
}
