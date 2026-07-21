import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logTraceEvent } from "@/lib/trace";
import ShareActions from "@/components/share/ShareActions";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://soignect.vercel.app";
}

const TYPE_LABEL: Record<string, string> = {
  REMPLACEMENT: "Remplacement",
  ASSISTANAT: "Assistanat (long terme)",
  COLLABORATION: "Collaboration libérale",
};

function fmt(d: Date | null | undefined): string | null {
  return d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;
}

function periodLabel(m: { startDate: Date | null; endDate: Date | null; minMonths: number | null }): string {
  if (m.startDate && m.endDate) return `${fmt(m.startDate)} → ${fmt(m.endDate)}`;
  if (m.startDate) return `À partir du ${fmt(m.startDate)}`;
  if (m.minMonths) return `${m.minMonths} mois minimum`;
  return "Dates à convenir";
}

async function getMission(id: string) {
  return prisma.mission.findFirst({
    where: { id, isActive: true },
    select: {
      id: true, title: true, location: true, startDate: true, endDate: true,
      minMonths: true, missionType: true, pitch: true, bioTinder: true,
      createdAt: true, updatedAt: true,
      profile: { select: { profession: true, name: true, region: true, titulaireKind: true } },
    },
  });
}

// employmentType schema.org (Google Jobs) mappé depuis le type de mission.
const EMPLOYMENT_TYPE: Record<string, string> = {
  REMPLACEMENT: "TEMPORARY",
  ASSISTANAT: "CONTRACTOR",
  COLLABORATION: "CONTRACTOR",
};

// Données structurées JobPosting (schema.org) pour Google Jobs (section 158).
function jobPostingLd(m: NonNullable<Awaited<ReturnType<typeof getMission>>>, url: string) {
  const type = TYPE_LABEL[m.missionType] ?? m.missionType;
  const description =
    (m.pitch ?? m.bioTinder ?? `${type} en Guadeloupe`).trim() +
    ` — ${type} · ${m.location} · ${periodLabel(m)}.`;
  const orgName = m.profile.name ?? "Cabinet de santé";
  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: m.title,
    description,
    datePosted: m.createdAt.toISOString(),
    ...(m.endDate ? { validThrough: m.endDate.toISOString() } : {}),
    employmentType: EMPLOYMENT_TYPE[m.missionType] ?? "CONTRACTOR",
    hiringOrganization: { "@type": "Organization", name: orgName },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: m.location,
        addressRegion: "Guadeloupe",
        addressCountry: "FR",
      },
    },
    url,
    directApply: false,
  };
}

// Open Graph pour un aperçu propre au partage (Facebook, etc.)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = await getMission(id);
  if (!m) return { title: "Annonce introuvable — Soignect" };
  const type = TYPE_LABEL[m.missionType] ?? m.missionType;
  const title = `${m.title} · ${m.location}`;
  const description = `${type} · ${m.location} · ${periodLabel(m)} — sur Soignect`;
  return {
    title: `${title} — Soignect`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Soignect",
      // og:image généré dynamiquement par annonce (opengraph-image.tsx, section 158) —
      // 1200×630 avec titre + lieu sur un visuel de marque. Next l'ajoute automatiquement.
    },
  };
}

export default async function PublicAnnoncePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMission(id);
  if (!m) return notFound();

  const session = await auth();
  const isLoggedIn = !!session?.user;

  // Trace acquisition — arrivée sur la page publique (section 3), fire-and-forget
  logTraceEvent({
    eventType: "FACEBOOK_GROUP_CLICK",
    missionId: m.id,
    commune: m.location,
    missionType: m.missionType,
    metadata: { authed: isLoggedIn },
  });

  const type = TYPE_LABEL[m.missionType] ?? m.missionType;
  // Accroche tronquée (1-2 lignes) visible sans compte
  const teaserSrc = (m.pitch ?? m.bioTinder ?? "").trim();
  const teaser = teaserSrc.length > 120 ? teaserSrc.slice(0, 120).trimEnd() + "…" : teaserSrc;

  const loginHref = `/login?return_to=${encodeURIComponent(`/annonce/${m.id}`)}`;
  const canonicalUrl = `${baseUrl()}/annonce/${m.id}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-kine-900 via-kine-700 to-kine-500 flex flex-col items-center px-4 py-10">
      {/* Données structurées JobPosting (Google Jobs, section 158) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd(m, canonicalUrl)) }}
      />
      <Link href="/" className="text-white/90 text-2xl font-black tracking-tight mb-6">Soignect</Link>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-kine-100 text-kine-700 mb-3">
            {type}
          </span>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{m.title}</h1>
          <p className="text-sm text-gray-500 mt-1">📍 {m.location}</p>
          <p className="text-sm text-gray-500 mt-0.5">📅 {periodLabel(m)}</p>

          {teaser && (
            <p className="mt-4 text-sm text-gray-700 italic border-l-2 border-kine-300 pl-3">{teaser}</p>
          )}

          {/* Contenu réservé (bio complète, cabinet, contact, candidature) */}
          <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
            <p className="text-sm font-semibold text-gray-700">🔒 Détails complets & candidature</p>
            <p className="text-xs text-gray-400 mt-1">
              Cabinet, présentation complète et mise en relation réservés aux membres.
            </p>
            {isLoggedIn ? (
              <Link
                href="/annonces"
                className="mt-3 inline-block w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold hover:bg-kine-700 transition"
              >
                Voir et répondre à l&apos;annonce →
              </Link>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href={loginHref}
                  className="w-full py-3 bg-kine-600 text-white rounded-xl text-sm font-bold hover:bg-kine-700 transition"
                >
                  Se connecter pour candidater
                </Link>
                <Link
                  href={`/register?return_to=${encodeURIComponent(`/annonce/${m.id}`)}`}
                  className="w-full py-2.5 border border-kine-200 text-kine-700 rounded-xl text-sm font-semibold hover:bg-kine-50 transition"
                >
                  Créer un compte gratuit
                </Link>
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2 text-center">Partager cette annonce</p>
            <ShareActions path={`/annonce/${m.id}`} title={`${m.title} · ${m.location}`} />
          </div>
        </div>
      </div>

      <p className="text-white/70 text-xs mt-6 text-center max-w-md">
        Soignect — la mise en relation intelligente des professionnels de santé en Guadeloupe.
      </p>
    </div>
  );
}
