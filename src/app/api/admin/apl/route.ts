import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const departement = searchParams.get("departement");

  const communes = await prisma.communeAPL.findMany({
    where: departement ? { departement } : undefined,
    orderBy: [{ departement: "asc" }, { commune: "asc" }],
    take: 200,
  });

  return NextResponse.json(communes);
}
