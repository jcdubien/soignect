"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PalierApl } from "@/lib/aplPalier";

// Écran du lien d'édition d'une page client (20/10). Trois blocs, dans l'ordre où un client
// les regarde : ce que sa page dit (réglages), pourquoi telle commune y est prioritaire (APL),
// qui la visite. Le périmètre et l'abonnement s'affichent sans se régler : ils découlent de
// l'offre souscrite.

interface Priorite {
  id: string; codeInsee: string; commune: string; profession: string;
  niveau: number; origine: "APL" | "DECLAREE"; retirable: boolean;
}

const ACCES: Record<number, string> = {
  3: "aucun professionnel accessible", 2: "accès très faible", 1: "accès faible", 0: "dans la moyenne ou au-dessus",
};

export default function GestionClient(props: {
  jeton: string;
  nom: string;
  active: boolean;
  revueLe: string;
  lienPublic: string;
  communes: { code: string; libelle: string }[];
  professionsToutes: { value: string; label: string }[];
  initial: { messageAccueil: string; contact: string; professions: string[] };
  priorites: Priorite[];
  paliers: PalierApl[];
  vues: { total: number; trenteJours: number };
}) {
  const router = useRouter();
  const [message, setMessage] = useState(props.initial.messageAccueil);
  const [contact, setContact] = useState(props.initial.contact);
  const [professions, setProfessions] = useState<string[]>(props.initial.professions);
  const [etat, setEtat] = useState<string | null>(null);
  const [ajout, setAjout] = useState({ codeInsee: props.communes[0]?.code ?? "", profession: props.professionsToutes[0]?.value ?? "", niveau: 1 });
  const [copie, setCopie] = useState(false);
  const label = (p: string) => props.professionsToutes.find((x) => x.value === p)?.label ?? p;

  async function appel(method: string, body: unknown, ok: string) {
    setEtat(null);
    const res = await fetch(`/api/page-client/${props.jeton}`, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) { setEtat(ok); router.refresh(); }
    else setEtat((await res.json().catch(() => null))?.error ?? "Action impossible.");
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
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h1 className="text-lg font-bold m-0">Votre page — {props.nom}</h1>
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
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <p className="text-sm font-bold m-0">Ce que votre page affiche</p>
        <label className="block text-xs font-semibold text-gray-600">
          Message d&apos;accueil
          <textarea value={message} maxLength={700} rows={4} onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm font-normal" />
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Contact (téléphone, email…)
          <input value={contact} maxLength={200} onChange={(e) => setContact(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm font-normal" />
        </label>
        <div>
          <p className="text-xs font-semibold text-gray-600 m-0">Professions affichées <span className="font-normal text-gray-400">(aucune cochée = toutes)</span></p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1">
            {props.professionsToutes.map((p) => (
              <label key={p.value} className="text-xs flex items-center gap-1.5">
                <input type="checkbox" checked={professions.includes(p.value)}
                  onChange={(e) => setProfessions(e.target.checked ? [...professions, p.value] : professions.filter((x) => x !== p.value))} />
                {p.label}
              </label>
            ))}
          </div>
        </div>
        <button
          onClick={() => appel("PATCH", { messageAccueil: message, contact, professions }, "Réglages enregistrés.")}
          className="px-4 py-2 rounded-lg bg-[#0B3D5C] text-white text-sm font-bold"
        >
          Enregistrer
        </button>
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
            <li key={p.id} className="text-sm flex items-baseline justify-between gap-2 flex-wrap">
              <span>
                <strong>{p.commune}</strong> · {label(p.profession)}
                <span className="text-[11px] text-gray-400"> — {ACCES[p.niveau] ?? `niveau ${p.niveau}`} · {p.origine === "APL" ? "APL" : "ajoutée"}</span>
              </span>
              {p.retirable && (
                <button onClick={() => appel("DELETE", { id: p.id }, "Priorité retirée.")} className="text-xs text-red-600 underline">
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 flex-wrap items-end">
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
          <button onClick={() => appel("POST", ajout, "Priorité ajoutée.")} className="px-3 py-2 rounded-lg border border-[#0B3D5C] text-[#0B3D5C] text-xs font-bold">
            Ajouter
          </button>
        </div>
      </div>

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

      {etat && <p className="text-sm text-gray-700">{etat}</p>}
    </div>
  );
}
