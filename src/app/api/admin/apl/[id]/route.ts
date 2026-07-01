import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

const schema = z.object({
  boostKine: z.number().int().min(-10).max(10).optional(),
  boostInfirmier: z.number().int().min(-10).max(10).optional(),
  boostMedecin: z.number().int().min(-10).max(10).optional(),
  boostSageFemme: z.number().int().min(-10).max(10).optional(),
  boostOrthophoniste: z.number().int().min(-10).max(10).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "id invalide" }, { status: 400 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.communeAPL.update({
    where: { id: numId },
    data: parsed.data,
    select: { id: true },
  });

  console.log(`[admin] APL commune ${numId} updated`, parsed.data);
  return NextResponse.json(updated);
}
