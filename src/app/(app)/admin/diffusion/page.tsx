import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ShareActions from "@/components/share/ShareActions";

export const dynamic = "force-dynamic";

// Pages d'entrée publiques (section 198). Elles existaient sans être répertoriées nulle part :
// Jean-Charles ignorait que Saint-Martin et Saint-Barth étaient en ligne. On les rassemble ici,
// avec de quoi les ouvrir, les partager, et voir si elles reçoivent du trafic.
//
// `trace` = clé metadata.page de l'événement LANDING_VIEW. Seule la page guadeloupéenne en pose
// une aujourd'hui ; les deux autres affichent « non tracée » plutôt qu'un zéro, qui se lirait
// comme une absence de visites alors que c'est une absence de mesure.
const PAGES = [
  {
    chemin: "/remplacement-kine-guadeloupe",
    titre: "Postes de kiné en Guadeloupe",
    sousTitre: "Page principale de campagne — remplacement, assistanat, collaboration",
    trace: "remplacement-kine-guadeloupe",
  },
  {
    chemin: "/remplacement-kine-saint-martin",
    titre: "Postes de kiné à Saint-Martin",
    sousTitre: "Collectivité d'outre-mer, distincte de la Guadeloupe",
    trace: null,
  },
  {
    chemin: "/remplacement-kine-saint-barth",
    titre: "Postes de kiné à Saint-Barthélemy",
    sousTitre: "Collectivité d'outre-mer, distincte de la Guadeloupe et de Saint-Martin",
    trace: null,
  },
];

export default async function AdminDiffusionPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/annonces");

  // Fréquentation par page, humains et robots séparés. Sans cette distinction un passage de
  // Googlebot pèserait autant qu'une visite réelle, et le chiffre ne voudrait plus rien dire.
  const vues = await prisma.traceEvent.findMany({
    where: { eventType: "LANDING_VIEW" },
    select: { metadata: true },
  });
  const compteur = new Map<string, { humains: number; robots: number }>();
  for (const v of vues) {
    const m = v.metadata as { page?: string; robot?: boolean } | null;
    if (!m?.page) continue;
    const c = compteur.get(m.page) ?? { humains: 0, robots: 0 };
    if (m.robot) c.robots++; else c.humains++;
    compteur.set(m.page, c);
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Diffusion</h1>
        <p className="text-gray-500 text-sm mt-1">
          Pages d&apos;entrée publiques · lien, partage et fréquentation
        </p>
      </div>

      <div className="space-y-4">
        {PAGES.map((p) => {
          const c = p.trace ? compteur.get(p.trace) : null;
          return (
            <div key={p.chemin} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-800">{p.titre}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{p.sousTitre}</p>
                </div>
                <a
                  href={p.chemin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-semibold text-kine-600 hover:underline"
                >
                  Ouvrir ↗
                </a>
              </div>

              <p className="text-[11px] font-mono text-gray-400 mb-3 break-all">{p.chemin}</p>

              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                {p.trace ? (
                  <>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                      👤 {c?.humains ?? 0} visite{(c?.humains ?? 0) > 1 ? "s" : ""}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-semibold">
                      🤖 {c?.robots ?? 0} robot{(c?.robots ?? 0) > 1 ? "s" : ""}
                    </span>
                  </>
                ) : (
                  // Dire « non tracée » plutôt qu'afficher 0 : un zéro se lirait comme une
                  // absence de visites, alors que c'est une absence de mesure.
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">
                    Fréquentation non tracée
                  </span>
                )}
              </div>

              <ShareActions path={p.chemin} title={p.titre} />
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-6 leading-relaxed">
        Une visite servie depuis le cache du navigateur ne compte pas : la trace est posée côté
        serveur, elle ne se déclenche qu&apos;au rendu. Le compteur est fiable pour comparer
        avant et après une campagne, pas au visiteur près.
      </p>
    </div>
  );
}
