import { ImageResponse } from "next/og";

// Image de partage des pages ÉDITORIALES (section 193) — 1200×630.
//
// Aucune page du produit n'en avait, hors les annonces individuelles : partagée sur Facebook,
// la page de campagne affichait un bloc gris vide à la place de l'image. L'accueil et /login
// aussi. Une seule route portait un opengraph-image, celle des annonces.
//
// Même langage visuel que la carte d'annonce, à dessein : quelqu'un qui voit passer les deux
// doit reconnaître la même provenance. Dégradé, en-tête de marque, pied de page identiques.
export const OG_SIZE = { width: 1200, height: 630 };

// Zone de sécurité : beaucoup de destinations RECADRENT le 1200×630 en carré centré — soit les
// 630 px du milieu. Tout ce qui vit sur les bords en sort coupé. Même contrainte que la carte
// d'annonce, mêmes 600 px utiles.
const SAFE = 600;

export function ogPage(opts: { titre: string; sousTitre: string; badge?: string }) {
  // Police dimensionnée sur la longueur, comme la carte d'annonce : ces titres sont fixes
  // aujourd'hui, mais un titre rallongé ne doit pas déborder silencieusement.
  const t = opts.titre;
  const taille = t.length <= 26 ? 62 : t.length <= 42 ? 50 : t.length <= 62 ? 40 : 34;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          textAlign: "center",
          padding: 48,
          backgroundColor: "#0B3D5C",
          backgroundImage: "linear-gradient(135deg, #0B3D5C 0%, #12708f 55%, #1aa0a0 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800, letterSpacing: -1, opacity: 0.95 }}>
          Soignect
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: SAFE }}>
          {opts.badge && (
            <div
              style={{
                display: "flex",
                alignSelf: "center",
                fontSize: 28,
                fontWeight: 700,
                padding: "8px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.18)",
                marginBottom: 26,
                whiteSpace: "nowrap",
              }}
            >
              {opts.badge}
            </div>
          )}

          <div style={{ display: "flex", fontSize: taille, fontWeight: 800, lineHeight: 1.1, width: SAFE, textAlign: "center" }}>
            {t}
          </div>

          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, lineHeight: 1.35, marginTop: 22, width: SAFE, opacity: 0.9, textAlign: "center" }}>
            {opts.sousTitre}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", fontSize: 22, opacity: 0.82, maxWidth: SAFE, textAlign: "center" }}>
          La mise en relation des professionnels de santé en Guadeloupe
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
