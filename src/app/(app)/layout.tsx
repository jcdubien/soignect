import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.profileId) redirect("/register");

  const isAdmin = (session.user as { role: string }).role === "ADMIN";
  const profileType = (session.user as { profileType?: string }).profileType;
  const profileId = session.user.profileId as string;

  // Fetch contextual info for header (section 21)
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      name: true,
      region: true,
      _count: { select: { missions: { where: { isActive: true } } } },
      missions: {
        where: { isActive: true },
        orderBy: { startDate: "asc" },
        select: { startDate: true, endDate: true, location: true, missionType: true },
        take: 1,
      },
    },
  });

  const createHref = profileType === "TITULAIRE" ? "/missions/create" : "/disponibilites/create";
  // Lien du logo adapté au profil (item 6) — accueil = booking
  const homeHref = profileType === "TITULAIRE" ? "/planning" : "/disponibilites";

  // Build contextual summary for header
  const emailPrefix = (session.user.email ?? "").split("@")[0];
  const displayName = profile?.name ?? emailPrefix;
  const activeMissionCount = profile?._count.missions ?? 0;
  const firstMission = profile?.missions[0];

  let contextLine: string | null = null;
  if (profileType === "TITULAIRE") {
    const loc = firstMission?.location ?? (profile?.region ?? "Guadeloupe");
    contextLine = `${loc} · ${activeMissionCount} poste${activeMissionCount !== 1 ? "s" : ""} actif${activeMissionCount !== 1 ? "s" : ""}`;
  } else if (firstMission?.startDate && firstMission?.endDate) {
    const fmt = (d: Date) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    contextLine = `Disponible ${fmt(firstMission.startDate)} – ${fmt(firstMission.endDate)}`;
  } else {
    const regionLabel: Record<string, string> = {
      GUADELOUPE: "Guadeloupe", SAINT_MARTIN: "Saint-Martin", SAINT_BARTH: "Saint-Barth",
      MARTINIQUE: "Martinique", GUYANE: "Guyane", REUNION: "La Réunion",
      MAYOTTE: "Mayotte", METROPOLE: "Métropole",
    };
    contextLine = regionLabel[profile?.region ?? "GUADELOUPE"] ?? "Guadeloupe";
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ── Header top ── */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-40 shadow-sm">
        <Link href={homeHref} className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xl font-black text-kine-600 tracking-tight">Soig</span>
          <span className="text-xl font-black text-gray-800 tracking-tight">nect</span>
        </Link>

        {/* Résumé contextuel — section 21 */}
        <div className="flex-1 min-w-0 hidden sm:flex items-center gap-2 text-xs text-gray-500 overflow-hidden">
          <span
            className="font-semibold text-gray-700 truncate shrink-0 max-w-[180px]"
            title={displayName}
          >
            {displayName}
          </span>
          {contextLine && (
            <>
              <span className="text-gray-300 shrink-0">·</span>
              <span className="truncate text-gray-400">{contextLine}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && (
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition shadow-sm"
            >
              Admin
            </Link>
          )}
          <Link
            href={createHref}
            className="text-xs px-3 py-1.5 bg-kine-600 text-white rounded-lg font-semibold hover:bg-kine-700 transition"
          >
            + Annonce
          </Link>
          {profileType === "TITULAIRE" ? (
            <Link
              href="/planning"
              className="text-xs px-3 py-1.5 border border-kine-200 text-kine-700 rounded-lg font-semibold hover:bg-kine-50 transition hidden sm:inline-flex items-center gap-1"
            >
              📋 Planning
            </Link>
          ) : (
            <Link
              href="/disponibilites"
              className="text-xs px-3 py-1.5 border border-kine-200 text-kine-700 rounded-lg font-semibold hover:bg-kine-50 transition hidden sm:inline-flex items-center gap-1"
            >
              📅 Disponibilités
            </Link>
          )}
          <Link
            href="/compte"
            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg font-semibold hover:bg-gray-50 transition hidden sm:inline-flex items-center"
          >
            Mon compte
          </Link>
          <SignOutButton />
        </div>
      </header>

      {/* ── Contenu ── */}
      <main className="flex-1 flex flex-col pb-16 sm:pb-0">{children}</main>

      {/* ── Bottom nav mobile ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around px-2 py-1.5 z-40 sm:hidden shadow-[0_-1px_6px_rgba(0,0,0,0.06)]">
        <Link href="/annonces" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-500 hover:text-kine-600 transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span className="text-[10px] font-medium">Annonces</span>
        </Link>

        <Link href={createHref} className="flex flex-col items-center gap-0.5 -mt-4 px-4 py-2.5 bg-kine-600 text-white rounded-2xl shadow-lg hover:bg-kine-700 transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span className="text-[10px] font-semibold">Annonce</span>
        </Link>

        <Link href="/compte" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-500 hover:text-kine-600 transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="text-[10px] font-medium">Compte</span>
        </Link>

        <Link href="/matches" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-500 hover:text-kine-600 transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span className="text-[10px] font-medium">Relations</span>
        </Link>

        {profileType !== "TITULAIRE" && (
          <Link href="/disponibilites" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-500 hover:text-kine-600 transition">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span className="text-[10px] font-medium">Dispo</span>
          </Link>
        )}

        {isAdmin && (
          <Link href="/admin" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-amber-600 hover:text-amber-700 transition">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="text-[10px] font-semibold">Admin</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
