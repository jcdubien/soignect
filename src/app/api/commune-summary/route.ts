import { NextResponse } from "next/server";

// Territoire (parenthèse de désambiguïsation Wikipédia) selon la région réelle du
// profil/annonce — jamais codé en dur (section 5).
const TERRITORY: Record<string, string> = {
  GUADELOUPE: "Guadeloupe",
  SAINT_MARTIN: "Saint-Martin",
  SAINT_BARTH: "Saint-Barthélemy",
  MARTINIQUE: "Martinique",
  GUYANE: "Guyane",
  REUNION: "La Réunion",
  MAYOTTE: "Mayotte",
  METROPOLE: "France",
};

interface WikiSummary {
  type?: string;
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

async function fetchSummary(title: string): Promise<WikiSummary | null> {
  try {
    const res = await fetch(
      `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "SoignectApp/1.0 (https://soignect.fr)",
        },
        // Cache long : 30 jours (pas d'appel à chaque ouverture)
        next: { revalidate: 60 * 60 * 24 * 30 },
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as WikiSummary;
  } catch {
    return null;
  }
}

// GET /api/commune-summary?commune=Sainte-Rose&region=GUADELOUPE
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const commune = searchParams.get("commune")?.trim();
  const region = searchParams.get("region") ?? "GUADELOUPE";
  if (!commune) return NextResponse.json({ summary: null });

  const territory = TERRITORY[region] ?? TERRITORY.GUADELOUPE;
  // 1) format désambiguïsé "{commune} ({territoire})" — évite les homonymes métropole
  // 2) dernier recours : nom de commune seul
  const candidates = [`${commune} (${territory})`, commune];

  for (const title of candidates) {
    const data = await fetchSummary(title);
    if (!data || data.type === "disambiguation" || !data.extract) continue;
    return NextResponse.json({
      summary: {
        title: data.title ?? commune,
        extract: data.extract,
        thumbnail: data.thumbnail?.source ?? null,
        url: data.content_urls?.desktop?.page ?? null,
      },
    });
  }

  // Fallback silencieux : ne casse pas l'affichage
  return NextResponse.json({ summary: null });
}
