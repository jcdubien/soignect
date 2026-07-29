import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkDeepSeekBudget, recordDeepSeekCall } from "@/lib/deepseekBudget";
import { BIO_LIMIT_TITULAIRE, BIO_LIMIT_DEFAULT } from "@/lib/bio";
import {
  extractAnnonceFields,
  proposeAnnonceTitle,
  redactionHelp,
  optimizeAnnonce,
  type AnnonceRole,
} from "@/lib/annonceAI";

export const dynamic = "force-dynamic";

// POST /api/ai/annonce — assistance IA à la saisie d'annonce (refonte texte-libre).
// Chaque action = un appel DeepSeek distinct, déclenché explicitement par l'utilisateur.
// Rate-limit réutilisé (checkDeepSeekBudget/recordDeepSeekCall). Plafond atteint → { degraded:true }
// (le formulaire manuel reste pleinement utilisable côté UI : jamais de blocage de publication).
const bodySchema = z.object({
  action: z.enum(["extract", "title", "redaction", "optimize"]),
  role: z.enum(["cabinet", "candidat"]).default("cabinet"),
  text: z.string().max(8000).default(""),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const profileId = (session?.user as { profileId?: string })?.profileId;
  if (!profileId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { action, role, text } = parsed.data;

  // Dégradation gracieuse : au-delà du plafond DeepSeek, on ne bloque rien — l'UI bascule sur
  // le formulaire manuel. On répond 200 avec { degraded:true } (pas une erreur).
  const budgetOk = await checkDeepSeekBudget(profileId);
  if (!budgetOk) return NextResponse.json({ degraded: true });

  try {
    switch (action) {
      case "extract": {
        // L'accroche fait partie de l'extraction (fusion des deux zones de saisie) : son cap
        // suit la limite du rôle — cabinet 700, candidat 280 (lib/bio, section 123).
        const bioLimit = role === "cabinet" ? BIO_LIMIT_TITULAIRE : BIO_LIMIT_DEFAULT;
        const fields = await extractAnnonceFields(text, role as AnnonceRole, bioLimit);
        if (fields === null) return NextResponse.json({ degraded: true }); // échec réseau → repli
        await recordDeepSeekCall(profileId);
        return NextResponse.json({ fields });
      }
      case "title": {
        const title = await proposeAnnonceTitle(text, role as AnnonceRole);
        if (title === null) return NextResponse.json({ degraded: true });
        await recordDeepSeekCall(profileId);
        return NextResponse.json({ title });
      }
      case "redaction": {
        // Référence de style : les annonces passées de CET utilisateur (texte libre ou accroche).
        const past = await prisma.mission.findMany({
          where: { profileId, OR: [{ rawText: { not: null } }, { pitch: { not: null } }] },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { rawText: true, pitch: true, description: true },
        });
        const pastTexts = past.map((m) => m.rawText ?? m.pitch ?? m.description ?? "").filter(Boolean);
        const improved = await redactionHelp(text, role as AnnonceRole, pastTexts);
        if (improved === null) return NextResponse.json({ degraded: true });
        await recordDeepSeekCall(profileId);
        return NextResponse.json({ text: improved });
      }
      case "optimize": {
        const suggestions = await optimizeAnnonce(text, role as AnnonceRole);
        if (suggestions === null) return NextResponse.json({ degraded: true });
        await recordDeepSeekCall(profileId);
        return NextResponse.json({ suggestions });
      }
    }
  } catch {
    // Toute erreur inattendue → dégradation gracieuse, jamais de blocage.
    return NextResponse.json({ degraded: true });
  }
}
