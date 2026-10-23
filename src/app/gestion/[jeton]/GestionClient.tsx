"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PalierApl } from "@/lib/aplPalier";
import BlocMesure, { type MesureAffichee } from "@/components/territoire/BlocMesure";
import EncartRecommandation from "@/components/territoire/EncartRecommandation";
import BlocBesoins, { type BesoinAffiche } from "@/components/territoire/BlocBesoins";
import type { ActionRecommandation } from "@/lib/recommandationTerritoire";
import type { RecommandationAffichee, ResumeReglages, SourceApl } from "@/lib/recommandationTerritoireServeur";
import { JUSTIFICATION_MAX, JUSTIFICATION_MIN, justificationRequise } from "@/lib/boostTerritorial";

// Écran du lien d'édition d'une page client (20/10). Trois blocs, dans l'ordre où un client
// les regarde : ce que sa page dit (réglages), pourquoi telle commune y est prioritaire (APL),
// qui la visite. Le périmètre et l'abonnement s'affichent sans se régler : ils découlent de
// l'offre souscrite.

interface Priorite {
  id: string; codeInsee: string; commune: string; profession: string;
  niveau: number; origine: "APL" | "DECLAREE"; retirable: boolean;
  /** Case de CE client sur une page réelle : son niveau se règle (point 8). */
  reglable: boolean; niveauApl: number | null; justification: string | null;
}

interface LigneJournal {
  id: string; createdAt: string; commune: string; profession: string;
  action: "CREATION" | "MODIFICATION" | "RETRAIT";
  niveauAvant: number | null; niveauApres: number | null; niveauApl: number | null;
  justification: string | null; auteurNom: string; motif: string | null; accesGratuit: boolean | null;
}

const ACTION: Record<LigneJournal["action"], string> = { CREATION: "Ajout", MODIFICATION: "Réglage", RETRAIT: "Retrait" };

const ACCES: Record<number, string> = {
  3: "aucun professionnel accessible", 2: "accès très faible", 1: "accès faible", 0: "dans la moyenne ou au-dessus",
};

export default function GestionClient(props: {
  jeton: string;
  /** Éditeur nommé connecté — null = consultation seule (section 314). */
  editeur: { nom: string } | null;
  lienConnexion: string;
  nom: string;
  logoUrl: string | null;
  active: boolean;
  demo: boolean;
  revueLe: string;
  lienPublic: string;
  communes: { code: string; libelle: string }[];
  professionsToutes: { value: string; label: string }[];
  initial: { messageAccueil: string; contact: string; professions: string[] };
  priorites: Priorite[];
  paliers: PalierApl[];
  vues: { total: number; trenteJours: number };
  journal: LigneJournal[];
  mesure: MesureAffichee;
  recommandation: { recommandations: RecommandationAffichee[]; resume: ResumeReglages; source: SourceApl; mention: string } | null;
  besoins: { dejaValidee: boolean; liste: BesoinAffiche[] };
}) {
  const router = useRouter();
  const [message, setMessage] = useState(props.initial.messageAccueil);
  const [contact, setContact] = useState(props.initial.contact);
  const [professions, setProfessions] = useState<string[]>(props.initial.professions);
  const [etat, setEtat] = useState<string | null>(null);
  const [ajout, setAjout] = useState({ codeInsee: props.communes[0]?.code ?? "", profession: props.professionsToutes[0]?.value ?? "", niveau: 1, justification: "" });
  // Réglage en cours d'une case (point 8) : une seule à la fois.
  const [reglage, setReglage] = useState<{ id: string; niveau: number; justification: string } | null>(null);
  const aplAjout = props.paliers.find((p) => p.codeInsee === ajout.codeInsee && p.profession === ajout.profession)?.niveau ?? null;
  const [copie, setCopie] = useState(false);
  const peutModifier = props.editeur !== null;
  const label = (p: string) => props.professionsToutes.find((x) => x.value === p)?.label ?? p;
  // « Appliquer… » de l'encart (23/10) : PRÉREMPLIT le formulaire existant et y amène l'éditeur.
  // L'enregistrement reste le bouton habituel — mêmes contrôles, même journal.
  const [surlignee, setSurlignee] = useState<string | null>(null);
  function preremplir(a: NonNullable<ActionRecommandation>) {
    let cible: string;
    if (a.type === "ajouter") {
      setAjout({ codeInsee: a.codeInsee, profession: a.profession, niveau: a.niveau, justification: "" });
      cible = "form-ajout";
    } else {
      const p = props.priorites.find((x) => x.id === a.prioriteId);
      if (a.type === "regler") setReglage({ id: a.prioriteId, niveau: a.niveau, justification: p?.justification ?? "" });
      cible = `prio-${a.prioriteId}`;
    }
    setSurlignee(cible);
    requestAnimationFrame(() => document.getElementById(cible)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function appel(method: string, body: unknown, ok: string): Promise<boolean> {
    setEtat(null);
    const res = await fetch(`/api/page-client/${props.jeton}`, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) { setEtat(ok); router.refresh(); }
    else setEtat((await res.json().catch(() => null))?.error ?? "Action impossible.");
    return res.ok;
  }

  if (!props.active) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h1 className="text-lg font-bold m-0">{props.nom}</h1>
        <p className="text-sm text-gray-600 mt-2 mb-0">
          Votre page n&apos;est plus active : l&apos;abonnement est arrivé à échéance ou a été clôturé.
          Contactez Soignect pour la réactiver.
        </p>
      </div>
    );
  }

  const tableauApl = props.communes.map((c) => ({
    ...c,
    paliers: props.paliers.filter((p) => p.codeInsee === c.code).sort((a, b) => b.niveau - a.niveau),
  }));

  return (
    <div className="space-y-4">
      {props.recommandation && (
        <EncartRecommandation
          jeton={props.jeton}
          mention={props.recommandation.mention}
          recommandations={props.recommandation.recommandations}
          resume={props.recommandation.resume}
          source={props.recommandation.source}
          peutModifier={peutModifier}
          onAppliquer={preremplir}
        />
      )}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          {props.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.logoUrl} alt="" className="h-10 w-auto max-w-[120px] object-contain" />
          )}
          <h1 className="text-lg font-bold m-0">Votre page — {props.nom}</h1>
        </div>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          Abonnement actif jusqu&apos;au {new Date(props.revueLe).toLocaleDateString("fr-FR", { timeZone: "UTC" })} ·
          {" "}{props.vues.total} visite{props.vues.total > 1 ? "s" : ""} au total, {props.vues.trenteJours} sur 30 jours
        </p>
        <p className="text-sm font-semibold m-0">Lien à diffuser aux soignants</p>
        <div className="flex gap-2 mt-1 flex-wrap">
          <input readOnly value={props.lienPublic} className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-2 bg-gray-50" />
          <button
            onClick={() => { navigator.clipboard?.writeText(props.lienPublic).then(() => setCopie(true)).catch(() => {}); }}
            className="px-3 py-2 rounded-lg bg-[#0B3D5C] text-white text-xs font-bold"
          >
            {copie ? "Copié" : "Copier"}
          </button>
          <a href={props.lienPublic} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-[#0B3D5C] text-[#0B3D5C] text-xs font-bold no-underline">
            Voir la page
          </a>
        </div>
        <p className="text-[11px] text-gray-400 mt-2 mb-0">
          Gardez pour vous le lien de cet écran : il permet de modifier la page.
        </p>
        {peutModifier ? (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2 mt-3 mb-0">
            Connecté·e : <strong>{props.editeur!.nom}</strong> — vos modifications sont enregistrées à votre nom.
          </p>
        ) : (
          <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2 mt-3 mb-0">
            Consultation seule. Pour modifier la page,{" "}
            <a href={props.lienConnexion} className="underline font-semibold text-[#0B3D5C]">connectez-vous avec votre compte éditeur</a>.
            Les comptes éditeurs sont ouverts par Soignect, à votre nom.
          </p>
        )}
        {props.demo && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-3 mb-0">
            Page de démonstration : les zones prioritaires sont calculées depuis l&apos;APL et ne
            sont pas présentées comme les vôtres. Avec l&apos;abonnement, elles deviennent vos
            priorités déclarées, remontent vos postes dans Soignect, et vous pouvez en ajouter.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <p className="text-sm font-bold m-0">Ce que votre page affiche</p>
        <label className="block text-xs font-semibold text-gray-600">
          Message d&apos;accueil
          <textarea value={message} maxLength={700} rows={4} disabled={!peutModifier} onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm font-normal" />
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Contact (téléphone, email…)
          <input value={contact} maxLength={200} disabled={!peutModifier} onChange={(e) => setContact(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm font-normal" />
        </label>
        <div>
          <p className="text-xs font-semibold text-gray-600 m-0">Professions affichées <span className="font-normal text-gray-400">(aucune cochée = toutes)</span></p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1">
            {props.professionsToutes.map((p) => (
              <label key={p.value} className="text-xs flex items-center gap-1.5">
                <input type="checkbox" checked={professions.includes(p.value)} disabled={!peutModifier}
                  onChange={(e) => setProfessions(e.target.checked ? [...professions, p.value] : professions.filter((x) => x !== p.value))} />
                {p.label}
              </label>
            ))}
          </div>
        </div>
        {peutModifier && <button
          onClick={() => appel("PATCH", { messageAccueil: message, contact, professions }, "Réglages enregistrés.")}
          className="px-4 py-2 rounded-lg bg-[#0B3D5C] text-white text-sm font-bold"
        >
          Enregistrer
        </button>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-bold m-0">Zones prioritaires</p>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          Calculées depuis l&apos;accessibilité potentielle localisée (APL) publiée par la DREES,
          profession par profession : une commune est prioritaire quand elle est parmi la moitié la
          moins bien dotée de son département. Vous pouvez en ajouter ; celles de l&apos;APL se
          mettent à jour à chaque nouvelle publication.
        </p>
        <ul className="list-none p-0 m-0 space-y-1 mb-3">
          {props.priorites.length === 0 && <li className="text-xs text-gray-500">Aucune zone prioritaire.</li>}
          {props.priorites.map((p) => (
            <li key={p.id} id={`prio-${p.id}`} className={`text-sm flex items-baseline justify-between gap-2 flex-wrap ${surlignee === `prio-${p.id}` ? "ring-2 ring-[#5eead4] rounded-lg p-1" : ""}`}>
              <span>
                <strong>{p.commune}</strong> · {label(p.profession)}
                <span className="text-[11px] text-gray-400"> — {ACCES[p.niveau] ?? `niveau ${p.niveau}`} · {p.origine === "APL" ? "APL" : "ajoutée"}{p.niveauApl !== null && p.niveau !== p.niveauApl ? ` · réglée (APL : ${p.niveauApl})` : ""}</span>
              </span>
              <span className="flex gap-3">
                {p.reglable && peutModifier && reglage?.id !== p.id && (
                  <button onClick={() => setReglage({ id: p.id, niveau: p.niveau, justification: p.justification ?? "" })} className="text-xs text-[#0B3D5C] underline">
                    Régler
                  </button>
                )}
                {p.retirable && peutModifier && (
                  <button onClick={() => appel("DELETE", { id: p.id }, "Priorité retirée.")} className="text-xs text-red-600 underline">
                    Retirer
                  </button>
                )}
              </span>
              {p.justification && <span className="w-full text-[11px] text-gray-500 italic">Justification : {p.justification}</span>}
              {reglage?.id === p.id && (
                <span className="w-full flex gap-2 flex-wrap items-start bg-gray-50 border border-gray-200 rounded-lg p-2">
                  <select value={reglage.niveau} onChange={(e) => setReglage({ ...reglage, niveau: Number(e.target.value) })} className="text-xs border border-gray-200 rounded-lg px-2 py-2">
                    <option value={1}>Accès faible</option>
                    <option value={2}>Accès très faible</option>
                    <option value={3}>Aucun professionnel</option>
                  </select>
                  {justificationRequise(reglage.niveau, p.niveauApl) && (
                    <textarea rows={2} maxLength={JUSTIFICATION_MAX} value={reglage.justification}
                      placeholder={`Pourquoi ce niveau ? (${JUSTIFICATION_MIN} à ${JUSTIFICATION_MAX} caractères)`}
                      onChange={(e) => setReglage({ ...reglage, justification: e.target.value })}
                      className="flex-1 min-w-[200px] text-xs border border-gray-200 rounded-lg p-2" />
                  )}
                  <button onClick={() => appel("PUT", { id: p.id, niveau: reglage.niveau, justification: justificationRequise(reglage.niveau, p.niveauApl) ? reglage.justification : null }, "Réglage enregistré.").then((fait) => { if (fait) setReglage(null); })}
                    className="px-3 py-2 rounded-lg bg-[#0B3D5C] text-white text-xs font-bold">Enregistrer</button>
                  <button onClick={() => setReglage(null)} className="text-xs text-gray-500 underline py-2">Annuler</button>
                  <span className="w-full text-[11px] text-gray-500">
                    {p.niveauApl === null
                      ? "Pas d'APL pour cette case : tout niveau se justifie par écrit."
                      : `Niveau APL : ${p.niveauApl}. Un cran d'écart se règle librement ; au-delà, justification écrite.`}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
        {!props.demo && peutModifier && <div id="form-ajout" className={`flex gap-2 flex-wrap items-end ${surlignee === "form-ajout" ? "ring-2 ring-[#5eead4] rounded-lg p-2" : ""}`}>
          <select value={ajout.codeInsee} onChange={(e) => setAjout({ ...ajout, codeInsee: e.target.value })} className="text-xs border border-gray-200 rounded-lg px-2 py-2">
            {props.communes.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
          </select>
          <select value={ajout.profession} onChange={(e) => setAjout({ ...ajout, profession: e.target.value })} className="text-xs border border-gray-200 rounded-lg px-2 py-2">
            {props.professionsToutes.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={ajout.niveau} onChange={(e) => setAjout({ ...ajout, niveau: Number(e.target.value) })} className="text-xs border border-gray-200 rounded-lg px-2 py-2">
            <option value={1}>Accès faible</option>
            <option value={2}>Accès très faible</option>
            <option value={3}>Aucun professionnel</option>
          </select>
          <button onClick={() => appel("POST", { ...ajout, justification: justificationRequise(ajout.niveau, aplAjout) ? ajout.justification : null }, "Priorité ajoutée.")} className="px-3 py-2 rounded-lg border border-[#0B3D5C] text-[#0B3D5C] text-xs font-bold">
            Ajouter
          </button>
          {justificationRequise(ajout.niveau, aplAjout) && (
            <textarea rows={2} maxLength={JUSTIFICATION_MAX} value={ajout.justification}
              placeholder={`Pourquoi ce niveau ? (${JUSTIFICATION_MIN} à ${JUSTIFICATION_MAX} caractères)`}
              onChange={(e) => setAjout({ ...ajout, justification: e.target.value })}
              className="w-full text-xs border border-gray-200 rounded-lg p-2" />
          )}
          <p className="w-full text-[11px] text-gray-500 m-0">
            {aplAjout === null
              ? "Pas d'APL pour cette commune et cette profession : le niveau se justifie par écrit."
              : `Niveau APL : ${aplAjout}. Un cran d'écart se règle librement ; au-delà, justification écrite.`}
          </p>
        </div>}
      </div>

      <BlocBesoins
        jeton={props.jeton}
        nomStructure={props.nom}
        peutModifier={peutModifier}
        demo={props.demo}
        dejaValidee={props.besoins.dejaValidee}
        communes={props.communes}
        professions={props.professionsToutes}
        besoins={props.besoins.liste}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-bold m-0">L&apos;APL de vos communes</p>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          Rang de chaque commune dans son département (1 = la moins bien dotée)
          {props.paliers[0]?.annee ? `, millésime ${props.paliers[0].annee}` : ""}. Pas d&apos;APL publié
          pour les autres professions.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-3 font-medium">Commune</th>
                <th className="py-1 pr-3 font-medium">Profession</th>
                <th className="py-1 pr-3 font-medium">APL</th>
                <th className="py-1 pr-3 font-medium">Rang</th>
                <th className="py-1 font-medium">Accès</th>
              </tr>
            </thead>
            <tbody>
              {tableauApl.flatMap((c) => c.paliers.map((p, i) => (
                <tr key={`${c.code}-${p.profession}`} className="border-t border-gray-100">
                  <td className="py-1 pr-3">{i === 0 ? c.libelle : ""}</td>
                  <td className="py-1 pr-3">{label(p.profession)}</td>
                  <td className="py-1 pr-3">{p.apl.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</td>
                  <td className="py-1 pr-3">{p.rang}/{p.sur}</td>
                  <td className={`py-1 ${p.niveau > 0 ? "font-semibold text-[#0B3D5C]" : "text-gray-400"}`}>{ACCES[p.niveau]}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {!props.demo && <BlocMesure mesure={props.mesure} />}

      {peutModifier && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-bold m-0">Journal des réglages</p>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Chaque ajout, réglage et retrait de case y est inscrit, à son auteur. Le journal ne se
            modifie ni ne s&apos;efface.
          </p>
          {props.journal.length === 0 ? <p className="text-xs text-gray-500 m-0">Aucune entrée.</p> : (
            <ul className="list-none p-0 m-0 space-y-1">
              {props.journal.map((j) => (
                <li key={j.id} className="text-xs text-gray-700">
                  <span className="text-gray-400">{new Date(j.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Guadeloupe" })}</span>
                  {" "}· {ACTION[j.action]} · <strong>{j.commune}</strong> · {label(j.profession)}
                  {" "}· {j.niveauAvant ?? "—"} → {j.niveauApres ?? "—"}{j.niveauApl !== null ? ` (APL ${j.niveauApl})` : ""}
                  {" "}· {j.auteurNom}
                  {j.justification && <span className="italic text-gray-500"> — « {j.justification} »</span>}
                  {j.motif && <span className="text-gray-500"> — {j.motif}</span>}
                  {j.accesGratuit && <span className="text-gray-400"> · accès gratuit</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {etat && <p className="text-sm text-gray-700">{etat}</p>}
    </div>
  );
}
