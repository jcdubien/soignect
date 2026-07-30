import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { BriqueStatus } from "@prisma/client";

// Image de partage Open Graph générée dynamiquement par annonce (section 158) — 1200×630.
// Priorité aux 3 infos essentielles pour un candidat qui scrolle (mobile) : TYPE, DATES, COMMUNE.
// Tout est borné pour ne JAMAIS déborder du cadre : titre en police dynamique + 2 lignes max,
// dates/commune chacune sur sa ligne (ellipsis si trop long).
export const runtime = "nodejs"; // accès Prisma (DB) → runtime Node, pas edge
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Annonce Soignect";

// Le badge est cadré selon le PROPRIÉTAIRE de l'annonce : un cabinet PROPOSE un poste, un
// candidat (remplaçant/assistant) SE PROPOSE. Même page /annonce/[id] pour les deux.
const CABINET_TYPE: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat · long terme",
  COLLABORATION: "Collaboration libérale",
};
const CANDIDAT_TYPE: Record<string, string> = {
  REMPLACEMENT: "Remplaçant disponible",
  ASSISTANAT: "Assistant · recherche poste",
  COLLABORATION: "Collaboration · recherche",
};
function badgeLabel(profileType: string | undefined, missionType: string): string {
  const isCandidate = profileType === "REMPLACANT" || profileType === "ASSISTANT";
  return (isCandidate ? CANDIDAT_TYPE : CABINET_TYPE)[missionType] ?? missionType;
}

// Dates « jour seul » stockées à minuit UTC → format en UTC (cf. lib/dates.ts).
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const ym = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

// Libellé de dates concis et lisible — approximatif si besoin plutôt que tronqué (mois/année).
function datesLabel(m: { startDate: Date | null; endDate: Date | null; minMonths: number | null }): string {
  const s = m.startDate ? new Date(m.startDate) : null;
  const e = m.endDate ? new Date(m.endDate) : null;
  // Glyphes limités à ceux présents dans la police Satori (pas de « ≥ » ni « → » → carrés).
  if (s && e) {
    const sameMonth = s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth();
    return sameMonth ? ym(s) : `${MONTHS[s.getUTCMonth()]} - ${ym(e)}`;
  }
  if (s) return `Dès ${ym(s)}`;
  if (m.minMonths) return `Longue durée · min. ${m.minMonths} mois`;
  return "Dates à convenir";
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.mission
    .findFirst({
      // Même règle que la page publique et le sitemap : seules les annonces EN RECHERCHE
      // ont une image de partage. Sinon on générait une carte Facebook pour des congés.
      where: { id, isActive: true, briqueStatus: BriqueStatus.RECHERCHE },
      select: {
        title: true, location: true, missionType: true,
        startDate: true, endDate: true, minMonths: true,
        profile: { select: { type: true } }, // cadre le badge (cabinet propose / candidat se propose)
      },
    })
    .catch(() => null);

  const rawTitle = m?.title ?? "Annonce paramédicale";
  const title = rawTitle.length > 120 ? rawTitle.slice(0, 118).trimEnd() + "…" : rawTitle;
  const location = m?.location ?? "Guadeloupe";
  const type = m ? badgeLabel(m.profile?.type, m.missionType) : "Soignect";
  const dates = m ? datesLabel(m) : "";

  // Police du titre dimensionnée selon la longueur (2 lignes max) → jamais de débordement.
  const titleSize = title.length <= 26 ? 70 : title.length <= 46 ? 58 : title.length <= 72 ? 48 : 40;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          backgroundColor: "#0B3D5C",
          backgroundImage: "linear-gradient(135deg, #0B3D5C 0%, #12708f 55%, #1aa0a0 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* En-tête marque */}
        <div style={{ display: "flex", alignItems: "center", fontSize: 38, fontWeight: 800, letterSpacing: -1, opacity: 0.95 }}>
          Soignect
        </div>

        {/* Corps : type (badge) + titre + dates + commune */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 30,
              fontWeight: 700,
              padding: "8px 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              marginBottom: 26,
              whiteSpace: "nowrap",
            }}
          >
            {type}
          </div>

          {/* Titre — police dynamique, 2 lignes max, ellipsis */}
          <div
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.08,
              maxWidth: 1060,
            }}
          >
            {title}
          </div>

          {/* Les 2 essentiels restants — libellés texte (pas d'emoji : absent de la police Satori),
              chacun sur sa ligne, valeur en ellipsis si trop longue → jamais de débordement. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 34 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, maxWidth: 1060 }}>
              <div style={{ display: "flex", width: 118, fontSize: 24, fontWeight: 700, letterSpacing: 2, opacity: 0.65 }}>DATES</div>
              <div style={{ display: "flex", fontSize: 42, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dates}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18, maxWidth: 1060 }}>
              <div style={{ display: "flex", width: 118, fontSize: 24, fontWeight: 700, letterSpacing: 2, opacity: 0.65 }}>LIEU</div>
              <div style={{ display: "flex", fontSize: 42, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{location}</div>
            </div>
          </div>
        </div>

        {/* Pied */}
        <div style={{ display: "flex", fontSize: 26, opacity: 0.82 }}>
          La mise en relation des professionnels de santé en Guadeloupe
        </div>
      </div>
    ),
    { ...size }
  );
}
