import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

// Image de partage Open Graph générée dynamiquement par annonce (section 158) — 1200×630,
// titre + lieu + type sur un visuel de marque. Remplace l'ancienne petite icône.
export const runtime = "nodejs"; // accès Prisma (DB) → runtime Node, pas edge
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Annonce Soignect";

const TYPE_LABEL: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat (long terme)",
  COLLABORATION: "Collaboration libérale",
};

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.mission
    .findFirst({
      where: { id, isActive: true },
      select: { title: true, location: true, missionType: true, profile: { select: { name: true } } },
    })
    .catch(() => null);

  const title = m?.title ?? "Annonce paramédicale";
  const location = m?.location ?? "Guadeloupe";
  const type = m ? (TYPE_LABEL[m.missionType] ?? m.missionType) : "Soignect";
  const org = m?.profile?.name ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#0B3D5C",
          backgroundImage: "linear-gradient(135deg, #0B3D5C 0%, #12708f 55%, #1aa0a0 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* En-tête marque */}
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
          Soignect
        </div>

        {/* Corps : type + titre + lieu */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 26,
              fontWeight: 700,
              padding: "8px 20px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              marginBottom: 28,
            }}
          >
            {type}
          </div>
          <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>
            {title.length > 90 ? title.slice(0, 90) + "…" : title}
          </div>
          <div style={{ display: "flex", fontSize: 38, marginTop: 24, opacity: 0.92 }}>
            {location}{org ? `  ·  ${org}` : ""}
          </div>
        </div>

        {/* Pied */}
        <div style={{ display: "flex", fontSize: 28, opacity: 0.85 }}>
          La mise en relation des professionnels de santé en Guadeloupe
        </div>
      </div>
    ),
    { ...size }
  );
}
