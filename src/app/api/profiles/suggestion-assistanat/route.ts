import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logTraceEvent } from "@/lib/trace";
import { z } from "zod";

export const dynamic = "force-dynamic";

// POST — les trois gestes possibles sur la suggestion « poste long terme » (sections 191, 272).
//
// ── POURQUOI ON TRACE MAINTENANT ─────────────────────────────────────────────────────────────
//
// Mesure du 29/09 : 9 remplaçants avaient franchi le seuil, **0** avaient écarté la bannière,
// **0** avaient publié du long terme ensuite. Zéro écartement sur neuf ne dit pas « elle ne
// convainc pas » — ça dit qu'elle n'a probablement jamais été VUE. Mais on ne pouvait que le
// déduire : rien n'enregistrait ni l'affichage ni le clic, et l'exposition réelle restait hors
// d'atteinte.
//
// Une bannière qu'on déplace sans la tracer se rejugerait dans un mois avec la même incertitude.
//
// ── CE QUE CHAQUE GESTE FAIT, ET NE FAIT PAS ─────────────────────────────────────────────────
//
//   vue     → trace seule. Surtout PAS de marquage : la colonne fait disparaître la bannière,
//             et l'afficher une fois en tout n'est pas la montrer.
//   clic    → trace seule, pour la même raison — on part publier, on peut renoncer en route.
//             La bannière doit encore être là au retour.
//   ecartee → le seul geste qui l'éteint, parce que c'est le seul qui dit « non ».
//
// `suggestionAssistanatVueAt` porte donc un nom trompeur : elle date l'ÉCARTEMENT, pas la vue.
// Renommer la colonne demanderait une migration pour un gain cosmétique ; le commentaire tient
// lieu d'avertissement, ici et dans `lib/suggestionAssistanat.ts`.
const schema = z.object({ action: z.enum(["vue", "clic", "ecartee"]).default("ecartee") });

const EVENEMENT = {
  vue:     "SUGGESTION_LT_VUE",
  clic:    "SUGGESTION_LT_CLIC",
  ecartee: "SUGGESTION_LT_ECARTEE",
} as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const profileId = session.user.profileId as string;

  // Corps absent = « ecartee », par défaut du schéma : l'ancien appelant ne postait rien.
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { action } = parsed.data;

  if (action === "ecartee") {
    await prisma.profile.update({
      where: { id: profileId },
      data: { suggestionAssistanatVueAt: new Date() },
    });
  }

  // Fire-and-forget, comme toutes les traces : un compteur ne doit jamais retarder un geste.
  logTraceEvent({ eventType: EVENEMENT[action], profileId });

  return NextResponse.json({ ok: true, action });
}
