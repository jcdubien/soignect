import { offreOuverteLe } from "@/lib/feedFilters";
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { appBaseUrl as baseUrl } from "@/lib/appUrl";
import { PAGES_PUBLIEES, cheminPage } from "@/lib/pagesDiffusion";

export const dynamic = "force-dynamic";

// Sitemap dynamique (section 158) — pages publiques statiques + toutes les annonces actives,
// mis à jour automatiquement (force-dynamic, re-généré à la demande).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();

  const staticPaths = [
    "/",
    // Pages de diffusion, dérivées du registre (section 299) : la liste écrite à la main n'en
    // tenait que 3 sur 7, et une page ajoutée n'y serait jamais entrée.
    ...PAGES_PUBLIEES.map((pg) => cheminPage(pg.porte, pg.profession, pg.territoire)),
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
      // Prédicat unique (section 298) : on ne signale aux moteurs que des pages qui répondent.
      where: offreOuverteLe(new Date()),
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
