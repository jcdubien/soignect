import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { prisma } from "@/lib/prisma";
import { BILLING_GRACE_DAYS } from "@/lib/billing";
import { isFreeAccessMode } from "@/lib/platform";
import { fmtDay } from "@/lib/dates";
import ActiveAnnoncesMenu from "./ActiveAnnoncesMenu";
import ActiveAnnoncesMobile from "./ActiveAnnoncesMobile";

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
      subscriptionPlan: true,
      billingTriggeredAt: true,
      _count: { select: { missions: { where: { isActive: true } } } },
      missions: {
        where: { isActive: true },
        orderBy: { startDate: "asc" },
        select: { id: true, title: true, startDate: true, endDate: true, location: true, missionType: true },
      },
    },
  });

  // Bandeau bascule payant (section 100) — cabinet déclenché, sans plan payant
  const isPaid = profile?.subscriptionPlan === "PREMIUM" || profile?.subscriptionPlan === "BOOST";
  const billingBanner = (() => {
    if (profileType !== "TITULAIRE" || !profile?.billingTriggeredAt || isPaid) return null;
    const graceEnd = new Date(profile.billingTriggeredAt);
    graceEnd.setDate(graceEnd.getDate() + BILLING_GRACE_DAYS);
    const daysLeft = Math.ceil((graceEnd.getTime() - Date.now()) / 86400000);
    return { daysLeft };
  })();

  // Mode lancement gratuit : on ne montre AUCUNE communication laissant entendre que
  // le gratuit mènera au payant (bandeau de grâce inclus) tant que ce mode est actif.
  const freeAccess = await isFreeAccessMode();

  // Lien du logo adapté au profil (item 6) — accueil = booking
  const homeHref = profileType === "TITULAIRE" ? "/planning" : "/disponibilites";

  // Build contextual summary for header
  const emailPrefix = (session.user.email ?? "").split("@")[0];
  const displayName = profile?.name ?? emailPrefix;
  const firstMission = profile?.missions[0];

  // Annonces actives du cabinet (compteur cliquable, section 21/102) — pour le TITULAIRE.
  // Le compteur reste _count.missions (inchangé) ; on liste ici les mêmes missions actives
  // pour ouvrir directement leur édition (flux « Modifier l'annonce » existant).
  const titulaireLoc = firstMission?.location ?? (profile?.region ?? "Guadeloupe");
  const activeMissions =
    profileType === "TITULAIRE"
      ? (profile?.missions ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          location: m.location,
          missionType: m.missionType as string,
        }))
      : [];

  // contextLine ne sert plus que pour les profils NON-titulaires (le titulaire a un menu client).
  let contextLine: string | null = null;
  if (profileType !== "TITULAIRE") {
    if (firstMission?.startDate && firstMission?.endDate) {
      const fmt = (d: Date) => fmtDay(d) ?? "";
      contextLine = `Disponible ${fmt(firstMission.startDate)} – ${fmt(firstMission.endDate)}`;
    } else {
      const regionLabel: Record<string, string> = {
        GUADELOUPE: "Guadeloupe", SAINT_MARTIN: "Saint-Martin", SAINT_BARTH: "Saint-Barth",
        MARTINIQUE: "Martinique", GUYANE: "Guyane", REUNION: "La Réunion",
        MAYOTTE: "Mayotte", METROPOLE: "Métropole",
      };
      contextLine = regionLabel[profile?.region ?? "GUADELOUPE"] ?? "Guadeloupe";
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-clip">
      {/* ── Header top ── */}
      <header className="bg-white border-b border-gray-100 px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 sticky top-0 z-40 shadow-sm">
        <Link href={homeHref} className="flex items-center gap-1.5 flex-shrink-0">
          <Image src="/GeminiLogo.png" alt="" width={26} height={26} className="shrink-0" priority />
          <span className="text-xl font-black text-gray-800 tracking-tight">Soignect</span>
        </Link>

        {/* Badge de statut (section 62) — rôle libéral, teinte bleu marine */}
        <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--bleu-marine)]/10 text-[var(--bleu-marine)] border border-[var(--bleu-marine)]/25">
          {({ TITULAIRE: "Titulaire", REMPLACANT: "Remplaçant", ASSISTANT: "Assistant", COLLABORATEUR: "Collaborateur" } as Record<string, string>)[profileType ?? ""] ?? "Profil"}
        </span>

        {/* Résumé contextuel — section 21 */}
        <div className="flex-1 min-w-0 hidden sm:flex items-center gap-2 text-xs text-gray-500 overflow-hidden">
          <span
            className="font-semibold text-gray-700 truncate shrink-0 max-w-[180px]"
            title={displayName}
          >
            {displayName}
          </span>
          {profileType === "TITULAIRE" ? (
            <>
              <span className="text-gray-300 shrink-0">·</span>
              <ActiveAnnoncesMenu location={titulaireLoc} missions={activeMissions} />
            </>
          ) : contextLine ? (
            <>
              <span className="text-gray-300 shrink-0">·</span>
              <span className="truncate text-gray-400">{contextLine}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Point d'entrée mobile vers les annonces actives (section 141) — sm:hidden,
              équivalent du compteur cliquable desktop masqué sur mobile. */}
          {profileType === "TITULAIRE" && <ActiveAnnoncesMobile missions={activeMissions} />}
          {isAdmin && (
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition shadow-sm"
            >
              Admin
            </Link>
          )}
          {/* Bouton « + Annonce » supprimé (section 148) — la création se fait uniquement
              au clic sur la timeline (zone vide → créer, zone remplie → éditer). */}
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
          {/* Pastille d'état de plan (F1) — dit clairement le plan courant et invite à
              Premium. Gratuit = ambre (incite) ; payé = vert (rassure). ✨/Gratuit compact
              sur mobile, libellé complet sur desktop.
              Pendant le mode lancement gratuit (freeAccess) : masquée ENTIÈREMENT (section
              132) — afficher « Premium » (ou « Gratuit ») laisserait croire à un statut payant
              actif alors que tout est débloqué pour tous. Réapparaît dès freeAccessMode=false. */}
          {profileType === "TITULAIRE" && !freeAccess && (
            <Link
              href="/premium"
              title={isPaid ? "Votre abonnement" : "Vous êtes en plan Gratuit — découvrir Premium"}
              className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold transition inline-flex items-center gap-1 ${
                isPaid
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              {isPaid ? (
                <>
                  <span>✓</span>
                  <span className="hidden sm:inline">
                    {profile?.subscriptionPlan === "BOOST" ? "Boost" : profile?.subscriptionPlan === "STRUCTURE" ? "Établissement" : "Premium"}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold">Gratuit</span>
                  <span className="hidden sm:inline font-normal opacity-90">· Premium</span>
                  <span>✨</span>
                </>
              )}
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

      {/* ── Bandeau bascule payant (section 100) — masqué en mode lancement gratuit ── */}
      {billingBanner && !freeAccess && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-amber-800 min-w-0">
            {billingBanner.daysLeft > 0 ? (
              <>Vous profitez pleinement de Soignect 🎉 — souscrivez un plan sous <strong>{billingBanner.daysLeft} jour{billingBanner.daysLeft > 1 ? "s" : ""}</strong> pour garder l&apos;accès Premium.</>
            ) : (
              <>Votre accès Premium est suspendu. Souscrivez un plan pour le réactiver.</>
            )}
          </p>
          <Link href="/premium" className="shrink-0 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition">
            Choisir un plan
          </Link>
        </div>
      )}

      {/* ── Contenu ── */}
      <main className="flex-1 flex flex-col pb-16 sm:pb-0">{children}</main>

      {/* ── Bottom nav mobile ── (section 149 : items en flex-1 pour tenir dans le viewport
          quel que soit leur nombre — 5 ou 6 avec Admin. `justify-around` + padding fixe
          débordait sur mobile étroit → rognage à gauche + scroll horizontal du document.) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center px-1 py-1.5 z-40 sm:hidden shadow-[0_-1px_6px_rgba(0,0,0,0.06)]">
        <Link href="/annonces" className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 text-gray-500 hover:text-kine-600 transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span className="text-[10px] font-medium truncate max-w-full">Annonces</span>
        </Link>

        {/* FAB « + Annonce » supprimé (section 148) — création via clic sur la timeline. */}

        <Link href="/compte" className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 text-gray-500 hover:text-kine-600 transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="text-[10px] font-medium truncate max-w-full">Compte</span>
        </Link>

        {/* Planning (titulaire) / Disponibilités (remplaçant) — section 91 :
            accès direct depuis la bottom nav, entre Compte et Relations. */}
        <Link
          href={profileType === "TITULAIRE" ? "/planning" : "/disponibilites"}
          className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 text-gray-500 hover:text-kine-600 transition"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className="text-[10px] font-medium truncate max-w-full">{profileType === "TITULAIRE" ? "Planning" : "Dispo"}</span>
        </Link>

        <Link href="/matches" className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 text-gray-500 hover:text-kine-600 transition">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span className="text-[10px] font-medium truncate max-w-full">Relations</span>
        </Link>

        {isAdmin && (
          <Link href="/admin" className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 text-amber-600 hover:text-amber-700 transition">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="text-[10px] font-semibold truncate max-w-full">Admin</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
