import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scanSustainedUsage, BILLING_USAGE_WINDOW_WEEKS, BILLING_USAGE_MIN_WEEKS } from "@/lib/billing";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  return session?.user?.role === "ADMIN";
}

// POST /api/admin/billing/scan?apply=1 — scan du critère 2 (usage soutenu).
// Sans ?apply=1 : dry-run (aucune mutation). Déclenché manuellement (pas de cron auto)
// pour respecter le garde-fou "ne bascule personne de force".
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const apply = new URL(req.url).searchParams.get("apply") === "1";
  const results = await scanSustainedUsage(apply);

  return NextResponse.json({
    apply,
    windowWeeks: BILLING_USAGE_WINDOW_WEEKS,
    minWeeks: BILLING_USAGE_MIN_WEEKS,
    candidates: results,
    newlyTriggered: results.filter((r) => r.triggered).length,
  });
}
