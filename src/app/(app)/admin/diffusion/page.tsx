import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ShareActions from "@/components/share/ShareActions";
import { KINESITHERAPEUTE, TERRITOIRES, PORTES, cheminPage, cleTracePage } from "@/lib/pagesDiffusion";
import { INSTANCES_EMBED, cheminEmbed, cleTraceEmbed } from "@/lib/embedTerritoire";
import { ZONE_LABELS } from "@/lib/communes";
import { etatJetonPage } from "@/lib/facebookPage";
import { fmtDayYear } from "@/lib/dates";

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
  // Interrogé à CHAQUE affichage, sans mise en cache : l'écran sert justement à savoir où en
  // est le jeton à l'instant où on le regarde. Un appel Graph borné à 6 s, sur une page
  // d'administration consultée quelques fois par mois.
  const jeton = await etatJetonPage();

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

      {/* ── État du jeton Facebook (section 255) ──────────────────────────────────────────
          L'alerte par email prévient AVANT la coupure ; cet encart répond à l'autre question,
          celle qu'on se pose n'importe quand : « est-ce que ça marche encore, en ce moment ? ».
          Sans lui, la seule façon de le savoir était de publier une annonce et de regarder la
          Page — vérification qu'on ne fait pas, et c'est bien le problème d'origine. ── */}
      <div
        className={`mb-6 rounded-2xl border p-5 ${
          !jeton.configure
            ? "bg-gray-50 border-gray-200"
            : jeton.valide === false
              ? "bg-red-50 border-red-200"
              : jeton.joursRestants !== null && jeton.joursRestants <= 30
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-gray-100 shadow-sm"
        }`}
      >
        <h2 className="font-bold text-gray-800 mb-1">Publication automatique sur la Page Facebook</h2>
        {!jeton.configure ? (
          <p className="text-sm text-gray-500">
            Aucun jeton configuré — la diffusion automatique est inactive. C&apos;est l&apos;état
            normal en développement.
          </p>
        ) : jeton.valide === false ? (
          <p className="text-sm text-red-700">
            <strong>Le jeton n&apos;est plus valide.</strong> La publication automatique est
            arrêtée. Renouvelez-le dans le Graph API Explorer de Meta, puis remplacez{" "}
            <code className="font-mono">FACEBOOK_PAGE_ACCESS_TOKEN</code> dans les variables
            d&apos;environnement Vercel.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              {jeton.valide === null
                ? "Facebook n'a pas répondu — état indéterminé, pas nécessairement une panne."
                : "Jeton valide."}{" "}
              {jeton.joursRestants === null ? (
                // On NE PRÉTEND PAS connaître une échéance que Graph n'a pas donnée. Afficher
                // « permanent » sur une absence de réponse serait exactement le genre de
                // certitude fabriquée qui a laissé passer ce défaut pendant deux semaines.
                <span className="text-gray-500">
                  Aucune échéance communiquée par Facebook : soit le jeton est permanent, soit la
                  date n&apos;a pas pu être lue (<code className="font-mono text-[11px]">{jeton.motif}</code>).
                </span>
              ) : (
                <span className={jeton.joursRestants <= 30 ? "font-semibold text-amber-800" : ""}>
                  Expire dans <strong>{jeton.joursRestants} jour{jeton.joursRestants > 1 ? "s" : ""}</strong>.
                </span>
              )}
            </p>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div className="flex justify-between gap-2 border-b border-gray-200/60 py-1">
                <dt className="text-gray-500">Échéance du jeton</dt>
                <dd className="font-mono text-gray-700">{fmtDayYear(jeton.expireLe) ?? "permanent"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-gray-200/60 py-1">
                <dt className="text-gray-500">Accès aux données</dt>
                <dd className="font-mono text-gray-700">{fmtDayYear(jeton.accesDonneesExpireLe) ?? "—"}</dd>
              </div>
            </dl>
            <p className="text-[11px] text-gray-400 mt-2 leading-snug">
              Deux échéances distinctes : le jeton peut être permanent alors que l&apos;accès aux
              données, lui, expire — et c&apos;est cette seconde date qui interrompt la publication.
              Une alerte part par email à 30, 14, 7, 3 et 1 jour, une seule fois par seuil.
            </p>
          </>
        )}
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
