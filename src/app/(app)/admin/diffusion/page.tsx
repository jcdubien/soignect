import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ShareActions from "@/components/share/ShareActions";
import { KINESITHERAPEUTE, TERRITOIRES, PORTES, cheminPage, cleTracePage } from "@/lib/pagesDiffusion";
import { INSTANCES_EMBED, cheminEmbed, cleTraceEmbed } from "@/lib/embedTerritoire";
import { ZONE_LABELS } from "@/lib/communes";

export const dynamic = "force-dynamic";

// Pages d'entrée publiques (section 198). Elles existaient sans être répertoriées nulle part :
// Jean-Charles ignorait que Saint-Martin et Saint-Barth étaient en ligne. On les rassemble ici,
// avec de quoi les ouvrir, les partager, et voir si elles reçoivent du trafic.
//
// `trace` = clé metadata.page de l'événement LANDING_VIEW. Les trois pages en posent une
// désormais. La branche « non tracée » du rendu est conservée pour une page qu'on ajouterait
// sans l'instrumenter : un zéro se lirait comme une absence de VISITES, alors que ce serait une
// absence de MESURE.
// Pages dérivées du module de factorisation (section 212) — plus une liste recopiée à la
// main. Une porte ajoutée dans lib/pagesDiffusion apparaît ici sans toucher cet écran ; c'est
// justement l'oubli qu'on veut rendre impossible, Jean-Charles ayant déjà découvert des pages
// en ligne dont il ignorait l'existence.
const PAGES = [
  // Porte CHERCHEUR × 3 territoires — les pages historiques.
  ...Object.values(TERRITOIRES).map((t) => ({
    chemin: cheminPage(PORTES.CHERCHEUR, KINESITHERAPEUTE, t),
    titre: `${PORTES.CHERCHEUR.libelle} — ${t.nom}`,
    sousTitre: PORTES.CHERCHEUR.cible,
    trace: cleTracePage(PORTES.CHERCHEUR, KINESITHERAPEUTE, t),
  })),
  // Les trois autres portes, sur la Guadeloupe seule aujourd'hui.
  ...[PORTES.CABINET, PORTES.ETABLISSEMENT, PORTES.TERRITOIRE].map((porte) => ({
    chemin: cheminPage(porte, KINESITHERAPEUTE, TERRITOIRES.GUADELOUPE),
    titre: `${porte.libelle} — ${TERRITOIRES.GUADELOUPE.nom}`,
    sousTitre: porte.cible,
    trace: cleTracePage(porte, KINESITHERAPEUTE, TERRITOIRES.GUADELOUPE),
  })),
  // Modules embarquables (section 208) — pas des pages de campagne, mais tracés de la même
  // façon. DÉRIVÉS du registre depuis le 20/08, comme les portes juste au-dessus : l'entrée
  // était écrite à la main, donc une deuxième CPTS aurait marché côté module et n'aurait
  // jamais paru ici. Même défaut que les pages Saint-Martin/Saint-Barth découvertes après coup.
  ...INSTANCES_EMBED.map((i) => ({
    chemin: cheminEmbed(i),
    titre: `Module embarquable — ${ZONE_LABELS[i.zone]}`,
    sousTitre: `Iframe pour le site de ${i.destinataire} — postes ouverts du territoire`,
    trace: cleTraceEmbed(i),
  })),
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
