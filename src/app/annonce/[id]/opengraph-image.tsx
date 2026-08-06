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

// Photo de fond : on la télécharge NOUS-MÊMES et on la passe en data URI, au lieu de laisser
// le générateur d'image aller la chercher. Raison : si ce téléchargement échoue au moment du
// rendu, c'est TOUTE l'image de partage qui échoue — or les caches sociaux retiennent
// longtemps un aperçu cassé. Ici, un échec dégrade simplement vers le fond dégradé d'origine.
// Délai borné pour la même raison : un stockage lent ne doit pas faire expirer le rendu.
async function fondPhoto(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 6_000_000) return null; // vide ou déraisonnable
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let m;
  try {
    m = await prisma.mission.findFirst({
      // Même règle que la page publique et le sitemap : seules les annonces EN RECHERCHE
      // ont une image de partage. Sinon on générait une carte Facebook pour des congés.
      where: { id, isActive: true, briqueStatus: BriqueStatus.RECHERCHE },
      select: {
        title: true, location: true, missionType: true,
        startDate: true, endDate: true, minMonths: true,
        // photoUrl : fond de la carte (section 158). type : cadre le badge (cabinet propose / candidat se propose).
        profile: { select: { type: true, photoUrl: true } },
      },
    });
  } catch {
    // Panne base : surtout PAS 404 — les caches sociaux (Facebook, LinkedIn) retiennent
    // longtemps un 404 et l'aperçu resterait cassé pour une annonce pourtant valide.
    // 503 = temporaire, le scraper réessaiera.
    return new Response("Image de partage temporairement indisponible", { status: 503 });
  }

  // Pas d'annonce publique → pas d'image de partage. On renvoie 404 plutôt qu'une carte
  // générique, pour rester cohérent avec /annonce/[id] qui renvoie notFound().
  if (!m) return new Response("Not found", { status: 404 });

  const title = m.title.length > 120 ? m.title.slice(0, 118).trimEnd() + "…" : m.title;
  const location = m.location;
  const type = badgeLabel(m.profile?.type, m.missionType);
  const dates = datesLabel(m);

  // Zone de sécurité : beaucoup de destinations de partage (messageries, aperçus système via
  // navigator.share) RECADRENT le 1200x630 en carré centré — soit les 630 px du milieu. Tout ce
  // qui vivait sur les bords en sortait coupé : marque, badge, début du titre. L'essentiel tient
  // donc dans une colonne centrée de 600 px, qui survit au recadrage carré comme au 1.91:1.
  const SAFE = 600;

  // Police du titre dimensionnée selon la longueur (2 lignes max) → jamais de débordement,
  // seuils resserrés puisque la largeur utile est celle de la zone de sécurité, pas du canevas.
  const titleSize = title.length <= 26 ? 54 : title.length <= 46 ? 44 : title.length <= 72 ? 36 : 30;

  const photo = await fondPhoto(m.profile?.photoUrl);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          backgroundColor: "#0B3D5C",
          // Repli conservé tel quel : sans photo, la carte est exactement celle d'avant.
          backgroundImage: photo ? undefined : "linear-gradient(135deg, #0B3D5C 0%, #12708f 55%, #1aa0a0 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {photo && (
          <img
            src={photo}
            width={1200}
            height={630}
            style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
          />
        )}
        {/* Voile gris uniforme. Une photo de profil peut être claire, sombre, chargée : un voile
            unique et opaque à 58 % garantit le contraste du texte blanc quelle qu'elle soit,
            là où un dégradé laisserait des zones illisibles selon le cliché. */}
        {photo && (
          <div
            style={{
              position: "absolute",
              top: 0, left: 0, width: 1200, height: 630,
              display: "flex",
              backgroundColor: "rgba(42,45,48,0.58)",
            }}
          />
        )}

        {/* Calque de contenu — reprend la mise en page d'origine à l'identique. */}
        <div
          style={{
            position: "relative",
            width: 1200,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            textAlign: "center",
            padding: 48,
          }}
        >
        {/* En-tête marque */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800, letterSpacing: -1, opacity: 0.95 }}>
          Soignect
        </div>

        {/* Corps : type (badge) + titre + dates + commune */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: SAFE }}>
          <div
            style={{
              display: "flex",
              alignSelf: "center",
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
              maxWidth: SAFE,
              textAlign: "center",
            }}
          >
            {title}
          </div>

          {/* Les 2 essentiels restants — libellés texte (pas d'emoji : absent de la police Satori),
              chacun sur sa ligne, valeur en ellipsis si trop longue → jamais de débordement. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28, width: SAFE }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, maxWidth: SAFE }}>
              <div style={{ display: "flex", width: 118, fontSize: 24, fontWeight: 700, letterSpacing: 2, opacity: 0.65 }}>DATES</div>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 460 }}>{dates}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, maxWidth: SAFE }}>
              <div style={{ display: "flex", width: 118, fontSize: 24, fontWeight: 700, letterSpacing: 2, opacity: 0.65 }}>LIEU</div>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 460 }}>{location}</div>
            </div>
          </div>
        </div>

        {/* Pied */}
        <div style={{ display: "flex", justifyContent: "center", fontSize: 22, opacity: 0.82, maxWidth: SAFE, textAlign: "center" }}>
          La mise en relation des professionnels de santé en Guadeloupe
        </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
