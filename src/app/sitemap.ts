import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://soignect.vercel.app";
}

// Sitemap dynamique (section 158) — pages publiques statiques + toutes les annonces actives,
// mis à jour automatiquement (force-dynamic, re-généré à la demande).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();

  const staticPaths = [
    "/",
    "/remplacement-kine-guadeloupe",
    "/remplacement-kine-saint-martin",
    "/remplacement-kine-saint-barth",
    "/mentions-legales",
    "/confidentialite",
    "/cgu",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: p === "/" ? 1 : 0.6,
  }));

  let annonceEntries: MetadataRoute.Sitemap = [];
  try {
    const missions = await prisma.mission.findMany({
      where: { isActive: true, briqueStatus: "RECHERCHE" },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
    annonceEntries = missions.map((m) => ({
      url: `${base}/annonce/${m.id}`,
      lastModified: m.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    }));
  } catch {
    /* base indisponible : on renvoie au moins les pages statiques */
  }

  return [...staticEntries, ...annonceEntries];
}
