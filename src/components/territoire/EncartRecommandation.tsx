"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ActionRecommandation } from "@/lib/recommandationTerritoire";
import { territoireDuCode } from "@/lib/indicateursTerritoire";
import type { RecommandationAffichee, ResumeReglages, SourceApl } from "@/lib/recommandationTerritoireServeur";

// Encart « Recommandation Soignect » (23/10) — en tête de la page de gestion d'une structure.
// Règles, textes et mention : lib/recommandationTerritoire (source unique). Ce composant affiche,
// trace, et préremplit un formulaire existant de la page ; il n'enregistre rien lui-même.

const IGNORE_JOURS = 30;

function lireIgnorees(jeton: string): Record<string, number> {
  try {
    const brut = JSON.parse(localStorage.getItem(`reco-ignorees:${jeton}`) ?? "{}") as Record<string, number>;
    const limite = Date.now() - IGNORE_JOURS * 86_400_000;
    return Object.fromEntries(Object.entries(brut).filter(([, t]) => t > limite));
  } catch {
    return {};
  }
}

function ecrireIgnorees(jeton: string, v: Record<string, number>) {
  try { localStorage.setItem(`reco-ignorees:${jeton}`, JSON.stringify(v)); } catch { /* navigation privée */ }
}

export default function EncartRecommandation(props: {
  jeton: string;
  mention: string;
  recommandations: RecommandationAffichee[];
  resume: ResumeReglages;
  source: SourceApl;
  peutModifier: boolean;
  /** Préremplit le formulaire de la page (étape 4) ; absent = pas de bouton « Appliquer… ». */
  onAppliquer?: (action: NonNullable<ActionRecommandation>) => void;
}) {
  const [ignorees, setIgnorees] = useState<Record<string, number>>({});
  const [toutes, setToutes] = useState(false);
  useEffect(() => setIgnorees(lireIgnorees(props.jeton)), [props.jeton]);
  const visibles = useMemo(() => props.recommandations.filter((r) => !ignorees[r.cle]), [props.recommandations, ignorees]);
  const principale = visibles[0] ?? null;
  const autres = visibles.slice(1);

  const tracees = useRef(new Set<string>());
  function tracer(evenement: "affichee" | "preremplie" | "ignoree", cle: string) {
    if (evenement === "affichee") { if (tracees.current.has(cle)) return; tracees.current.add(cle); }
    void fetch(`/api/page-client/${props.jeton}/recommandation`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evenement, cle }), keepalive: true,
    }).catch(() => {});
  }
  useEffect(() => { if (principale) tracer("affichee", principale.cle); }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (toutes) autres.forEach((r) => tracer("affichee", r.cle)); }); // eslint-disable-line react-hooks/exhaustive-deps

  function ignorer(cle: string) {
    tracer("ignoree", cle);
    const v = { ...ignorees, [cle]: Date.now() };
    setIgnorees(v); ecrireIgnorees(props.jeton, v);
  }
  function appliquer(r: RecommandationAffichee) {
    if (!r.action || !props.onAppliquer) return;
    tracer("preremplie", r.cle);
    props.onAppliquer(r.action);
  }

  const dateImport = props.source.importeLe ? new Date(props.source.importeLe).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : null;

  const boutons = (r: RecommandationAffichee) => (
    <div className="flex gap-2 flex-wrap mt-3">
      {r.action && props.peutModifier && props.onAppliquer && (
        <button type="button" onClick={() => appliquer(r)}
          className="px-3 py-2 rounded-lg bg-[#5eead4] text-[#042f2e] text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
          {r.action.type === "retirer" ? "Voir la priorité…" : r.action.type === "preparerBesoin" ? "Préparer le brouillon…" : "Appliquer…"}
        </button>
      )}
      {props.peutModifier && (
        <button type="button" onClick={() => ignorer(r.cle)}
          className="px-3 py-2 rounded-lg border border-slate-400 text-slate-100 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
          Ignorer
        </button>
      )}
    </div>
  );

  return (
    <section aria-labelledby="reco-titre" className="rounded-2xl p-5 text-slate-50" style={{ background: "linear-gradient(160deg, #0b1f33 0%, #12304d 100%)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <h2 id="reco-titre" className="text-base font-extrabold m-0 tracking-wide">Recommandation <span className="text-[#5eead4]">Soignect</span></h2>
        {principale?.libelleProfession && principale.regle !== "DONNEES_INSUFFISANTES" && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-slate-400 text-slate-300">{principale.libelleProfession}</span>
        )}
      </div>
      <p className="text-xs text-slate-300 mt-2 mb-4">{props.mention}</p>

      {!principale ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-sm font-bold m-0">Rien à proposer pour l&apos;instant.</p>
          <p className="text-xs text-slate-300 mt-1 mb-0">Vos réglages sont cohérents avec les données publiques disponibles, ou les écarts sont justifiés.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(principale.palier || principale.densite) && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300 m-0 mb-2">Ce que montrent les données</p>
              {principale.palier ? (
                <>
                  <p className="text-sm m-0">{principale.commune} est</p>
                  <p className="text-2xl font-extrabold leading-tight m-0">
                    {principale.palier.rang === 1 ? "la commune la moins bien dotée" : <>la {principale.palier.rang}<sup className="text-xs">e</sup> commune la moins bien dotée</>}
                  </p>
                  <p className="text-sm mt-1 mb-0">en {principale.nomPluriel}, sur {principale.palier.sur} {territoireDuCode(principale.codeInsee)}.</p>
                  <p className="text-xs text-slate-300 mt-2 mb-0">
                    Indicateur d&apos;accessibilité de la DREES{props.source.annee ? ` (APL ${props.source.annee})` : ""} : {principale.palier.apl.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                    {principale.medianeApl != null && `, pour une commune médiane à ${principale.medianeApl.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`}. Plus il est bas, plus l&apos;accès est difficile.
                  </p>
                </>
              ) : (
                <p className="text-2xl font-extrabold leading-tight m-0">{principale.densite!.effectif === 0 ? "Aucun praticien" : principale.densite!.effectif}</p>
              )}
              {principale.densite && (
                <p className="text-xs text-slate-300 mt-2 mb-0">
                  {(() => {
                    const d = principale.densite!;
                    const ou = principale.regle === "PERIMETRE_SANS_PRATICIEN" ? "sur vos communes" : `à ${principale.commune}`;
                    const salaries = d.effectif - d.effectifLiberal;
                    return `${d.effectifLiberal} ${principale.nomPluriel} en libéral ${ou}, soit ${d.pour10k.toLocaleString("fr-FR")} pour 10 000 habitants`
                      + (d.reference != null ? ` (moyenne de la Guadeloupe : ${d.reference.toLocaleString("fr-FR")})` : "")
                      + (salaries > 0 ? `, plus ${salaries} salarié${salaries > 1 ? "s" : ""} (hôpital, clinique…)` : "") + ".";
                  })()}
                </p>
              )}
            </div>
          )}
          <div className={`rounded-xl border border-white/10 bg-white/5 p-4 ${principale.palier || principale.densite ? "" : "sm:col-span-2"}`}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300 m-0 mb-2">Vos réglages</p>
            <p className="text-2xl font-extrabold leading-tight m-0">{props.resume.casesReglees} sur {props.resume.casesApl}</p>
            <p className="text-sm mt-1 mb-0">
              zones à accès faible, selon les données, sont prioritaires sur votre page.
              {" "}{props.resume.reglagesHumains === 0 ? "Vous n’en avez encore ajouté ni ajusté aucune." : `Vous en avez ajouté ou ajusté ${props.resume.reglagesHumains}.`}
            </p>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-[#5eead4]/50 bg-white/5 p-4" aria-live="polite">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-300 m-0 mb-2">Recommandation</p>
            <p className="text-base font-semibold m-0">{principale.phrase}</p>
            <p className="text-xs text-slate-300 mt-1 mb-0">{principale.parce}</p>
            {boutons(principale)}
          </div>
        </div>
      )}

      {autres.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setToutes((v) => !v)} aria-expanded={toutes}
            className="text-sm font-bold text-[#5eead4] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
            {toutes ? "Masquer" : autres.length === 1 ? "Voir l’autre proposition" : `Voir les ${autres.length} autres propositions`}
          </button>
          {toutes && (
            <ul className="list-none p-0 m-0 mt-2 space-y-2">
              {autres.map((r) => (
                <li key={r.cle} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold m-0">{r.phrase}</p>
                  <p className="text-xs text-slate-300 mt-1 mb-0">{r.parce}</p>
                  {boutons(r)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <details className="mt-4 border-t border-white/10 pt-3">
        <summary className="cursor-pointer text-sm font-bold text-[#5eead4]">Voir le calcul</summary>
        <ul className="text-xs text-slate-200 mt-2 space-y-1 pl-4">
          <li>Source : {props.source.source ?? "inconnue"}{props.source.annee ? `, millésime ${props.source.annee}` : ""}{dateImport ? `, importée le ${dateImport}` : ""}.</li>
          {props.source.effectifs?.praticiens && (
            <li>
              Praticiens recensés : {props.source.effectifs.praticiens}
              {props.source.effectifs.extraitLe ? `, extraction du ${new Date(props.source.effectifs.extraitLe).toLocaleDateString("fr-FR", { timeZone: "UTC" })}` : ""} ;
              {" "}population : {props.source.effectifs.population}. La densité compte l&apos;exercice libéral (un
              établissement compte son personnel salarié dans sa commune) ; un praticien compte dans chaque commune où il
              exerce ; la référence est la Guadeloupe, calculée de la même façon. Aides-soignants : présents seulement quand une structure les a enregistrés — trop partiel pour un indicateur.
            </li>
          )}
          <li>L&apos;APL (accessibilité potentielle localisée) mesure, commune par commune, l&apos;offre de soins accessible au regard de la population et de ses besoins. Plus elle est basse, plus l&apos;accès est difficile.</li>
          <li>L&apos;APL et la densité peuvent diverger : l&apos;APL tient compte des communes voisines, des distances et des besoins de la population (âge) ; la densité ne compte que les praticiens installés dans la commune.</li>
          <li>Classement : les communes du département sont rangées de l&apos;accès le plus faible (1ʳᵉ) au plus élevé. Le quart le moins bien doté est classé « accès très faible », le deuxième quart « accès faible » : c&apos;est une convention Soignect, pas un seuil officiel.</li>
          <li>Vous pouvez ajuster un niveau d&apos;un cran librement ; au-delà, une explication écrite est demandée.</li>
          <li>Les mêmes règles s&apos;appliquent à toutes les structures. L&apos;APL ne voit pas les déplacements entre communes, le temps partiel, ni la télésanté.</li>
          <li>Professions sans données publiques fiables : aucune proposition.</li>
        </ul>
      </details>
    </section>
  );
}
