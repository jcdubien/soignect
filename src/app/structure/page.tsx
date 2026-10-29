import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Profession } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { structuresDuCompte } from "@/lib/espaceStructure";
import { statsTerritoire } from "@/lib/statsTerritoire";
import { libelleTypePartenaire } from "@/lib/partenariat";
import { libelleProfession, PAGES_PUBLIEES, TERRITOIRES, cheminPage } from "@/lib/pagesDiffusion";
import { COMMUNES_PAR_TERRITOIRE, LIBELLE_TERRITOIRE, inseeOfCommune } from "@/lib/communes";
import EspaceTerritoire from "@/app/(app)/territoire/EspaceTerritoire";
import { SignOutButton } from "@/components/ui/SignOutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Espace structure | Soignect", robots: { index: false, follow: false } };

// ESPACE STRUCTURE (section 379) — CPTS, MSP, collectivités, établissements.
//
// Hors du segment (app) : celui-ci exige un profil soignant et sert le fil de swipes, qu'une CPTS
// ou une MSP n'a pas. Un établissement, lui, garde son fil ; il trouve ici, en plus, les outils de
// sa structure partenaire.
//
// Ce que l'écran ouvre, et à quelle condition (lib/espaceStructure) : rien avant la validation de
// la structure par l'équipe Soignect ; ensuite la page de la structure et ses réglages (/gestion —
// besoins, priorités, mesure), sa page publique, les pages de diffusion de son île et le suivi
// agrégé du territoire. Les réglages réservés à l'administration le restent.
const STATUT_DEMANDE = {
  NOUVELLE: { texte: "En cours d'examen", classe: "bg-amber-100 text-amber-800" },
  CONVERTIE: { texte: "Validée", classe: "bg-emerald-100 text-emerald-800" },
  CLASSEE: { texte: "Non retenue", classe: "bg-gray-200 text-gray-600" },
} as const;

export default async function EspaceStructurePage() {
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?return_to=${encodeURIComponent("/structure")}`);
  const userId = session.user.id;
  const email = session.user.email?.toLowerCase() ?? "";

  const [structures, demandes] = await Promise.all([
    structuresDuCompte(userId),
    prisma.demandePartenariat.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
      select: { id: true, structure: true, type: true, territoire: true, statut: true, createdAt: true },
    }),
  ]);
  const active = structures.find((s) => s.active) ?? null;

  // Suivi du territoire : celui de la première structure active — mêmes agrégats que l'Espace
  // territoire des partenaires, aucune donnée nominative.
  const suivi = active
    ? await (async () => {
        const [stats, demandesPriorite] = await Promise.all([
          statsTerritoire(active.territoire),
          prisma.demandePriorite.findMany({
            where: { demandeurId: userId }, orderBy: { createdAt: "desc" },
            select: { id: true, commune: true, profession: true, niveau: true, motif: true, statut: true, reponse: true, createdAt: true },
          }),
        ]);
        return {
          stats, demandesPriorite,
          communes: COMMUNES_PAR_TERRITOIRE[active.territoire].filter((c) => inseeOfCommune(c) !== null),
          professions: Object.values(Profession).map((v) => ({ value: v, label: libelleProfession(v) })),
        };
      })()
    : null;

  const pagesDeLIle = (ile: string) => {
    const t = Object.values(TERRITOIRES).find((x) => x.ile === ile && x.toute);
    return t ? PAGES_PUBLIEES.filter((x) => x.territoire === t && ["territoire", "maison-de-sante", "emploi"].includes(x.porte.slug)) : [];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm font-black text-kine-700">Soignect</Link>
        <span className="text-xs font-semibold text-gray-500">Espace structure</span>
        <span className="ml-auto flex items-center gap-3 text-sm">
          {session.user.profileId && <Link href="/annonces" className="text-kine-700 underline">Mes annonces</Link>}
          <SignOutButton />
        </span>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-black text-gray-900">Votre espace structure</h1>

        {structures.length === 0 && (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            {demandes.length > 0 ? (
              <>
                <p className="text-sm text-gray-700">
                  Votre demande est entre les mains de l&apos;équipe Soignect. Les outils de votre structure
                  s&apos;ouvrent ici dès qu&apos;elle est validée.
                </p>
                <ul className="space-y-2">
                  {demandes.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 text-sm border-t border-gray-50 pt-2">
                      <span className="text-gray-800">{d.structure} · {libelleTypePartenaire(d.type)} · {LIBELLE_TERRITOIRE[d.territoire]}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${STATUT_DEMANDE[d.statut].classe}`}>{STATUT_DEMANDE[d.statut].texte}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-700">
                Aucune structure n&apos;est encore rattachée à ce compte.{" "}
                <Link href="/partenaire" className="font-semibold text-kine-700 underline">Faire une demande</Link>{" "}
                avec l&apos;email de ce compte ({email}) : elle lui sera rattachée à sa validation.
              </p>
            )}
          </section>
        )}

        {structures.map((s) => (
          <section key={s.clientId} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{s.nom}</h2>
              <span className="text-xs text-gray-500">{libelleTypePartenaire(s.type as Parameters<typeof libelleTypePartenaire>[0])} · {LIBELLE_TERRITOIRE[s.territoire]}</span>
              {!s.active && <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-gray-200 text-gray-600">Relation à renouveler</span>}
            </div>
            {s.active ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {s.page && (
                  <>
                    <Link href={`/gestion/${s.page.jetonEdition}`} className="rounded-xl border border-kine-200 bg-kine-50 px-4 py-3 hover:bg-kine-100 transition">
                      <p className="text-sm font-bold text-kine-800">Gérer votre page →</p>
                      <p className="text-xs text-gray-500">Besoins du territoire, priorités, visites et intérêts reçus</p>
                    </Link>
                    <Link href={`/p/${s.page.jetonPublic}`} className="rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50 transition">
                      <p className="text-sm font-bold text-gray-800">Votre page publique →</p>
                      <p className="text-xs text-gray-500">{s.page.demo ? "En démonstration : votre nom n'y est pas publié" : "Celle que vous partagez"}</p>
                    </Link>
                  </>
                )}
                {pagesDeLIle(s.territoire).map((x) => (
                  <Link key={cheminPage(x.porte, x.profession, x.territoire)} href={cheminPage(x.porte, x.profession, x.territoire)} className="rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50 transition">
                    <p className="text-sm font-bold text-gray-800">{x.porte.libelle} · {x.profession.court} →</p>
                    <p className="text-xs text-gray-500">Page de diffusion — {x.territoire.nom}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                La relation avec Soignect est arrivée à échéance : vos outils reprennent dès son renouvellement.
              </p>
            )}
          </section>
        ))}

        {suivi && active && (
          <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <h2 className="px-5 pt-5 text-sm font-bold text-gray-700 uppercase tracking-wide">Suivi du territoire</h2>
            <EspaceTerritoire
              stats={suivi.stats}
              demandes={JSON.parse(JSON.stringify(suivi.demandesPriorite))}
              communes={suivi.communes}
              professions={suivi.professions}
              territoire={active.territoire}
              iles={null}
            />
          </section>
        )}
      </main>
    </div>
  );
}
