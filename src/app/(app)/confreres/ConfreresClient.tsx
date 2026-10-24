"use client";

import { useState } from "react";
import Link from "next/link";
import { LIBELLE_MODE } from "@/lib/retrocession";

// Confrère trouvé hors Soignect (24/10) — voir lib/confrereHorsSoignect.

interface Confrere {
  matchId: string; nom: string; missionType: string; startDate: string | null; endDate: string | null;
  minMonths: number | null; active: boolean; lien: string | null; signeTitulaire: boolean; signeConfrere: boolean;
}

const TYPES = [
  { v: "REMPLACEMENT", l: "Remplacement" },
  { v: "ASSISTANAT", l: "Assistanat" },
  { v: "COLLABORATION", l: "Collaboration" },
] as const;

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");

async function partagerLien(nom: string, lien: string): Promise<string> {
  const texte = `Bonjour ${nom.split(" ")[0]}, voici le lien pour activer votre compte Soignect et retrouver notre contrat :`;
  try {
    if (navigator.share) { await navigator.share({ title: "Votre compte Soignect", text: texte, url: lien }); return "Lien partagé."; }
  } catch (e) { if ((e as Error)?.name === "AbortError") return ""; }
  try { await navigator.clipboard.writeText(`${texte} ${lien}`); return "Lien copié : collez-le dans votre message."; }
  catch { return "Copiez le lien ci-dessus."; }
}

export default function ConfreresClient({ communes, communeParDefaut, initiaux, modesRedevance }: { communes: string[]; communeParDefaut: string; initiaux: Confrere[]; modesRedevance: boolean }) {
  const [liste, setListe] = useState(initiaux);
  const [f, setF] = useState({ prenom: "", nom: "", email: "", missionType: "ASSISTANAT", startDate: "", endDate: "", minMonths: "", taux: "", mode: "POURCENTAGE", fixe: "", plafond: "", location: communeParDefaut, rpps: "", numeroOrdre: "", adresse: "" });
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [statut, setStatut] = useState<Record<string, string>>({});
  const remplacement = f.missionType === "REMPLACEMENT";
  // Forfait et plafond : redevance d'un assistant ou d'un collaborateur seulement (section 296).
  const avecModes = modesRedevance && !remplacement;
  const mode = avecModes ? f.mode : "POURCENTAGE";
  const maj = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setEnvoi(true);
    try {
      const r = await fetch("/api/confreres", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prenom: f.prenom, nom: f.nom, email: f.email || null, missionType: f.missionType, location: f.location,
          startDate: f.startDate, endDate: remplacement ? f.endDate || null : null,
          minMonths: remplacement ? null : Number(f.minMonths) || null,
          retrocessionRate: mode === "FIXE" ? 0 : Number(f.taux),
          retrocessionMode: mode,
          retrocessionFixeEuros: mode === "FIXE" ? Number(f.fixe) || null : null,
          retrocessionPlafondEuros: mode === "PLAFONNEE" ? Number(f.plafond) || null : null,
          rpps: f.rpps || null, numeroOrdre: f.numeroOrdre || null, adresse: f.adresse || null,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setErreur(d?.error ?? "Ajout impossible."); return; }
      const l = await (await fetch("/api/confreres")).json().catch(() => null);
      if (l?.confreres) setListe(l.confreres);
      setF({ ...f, prenom: "", nom: "", email: "", startDate: "", endDate: "", minMonths: "", rpps: "", numeroOrdre: "", adresse: "" });
      setStatut((s) => ({ ...s, [d.matchId]: "Confrère ajouté. Préparez le contrat, puis partagez-lui le lien d'activation." }));
    } finally { setEnvoi(false); }
  }

  async function regenerer(c: Confrere) {
    const r = await fetch(`/api/confreres/${c.matchId}/lien`, { method: "POST" });
    const d = await r.json().catch(() => null);
    if (!r.ok) { setStatut((s) => ({ ...s, [c.matchId]: d?.error ?? "Impossible." })); return; }
    setListe((l) => l.map((x) => (x.matchId === c.matchId ? { ...x, lien: d.lien } : x)));
    setStatut((s) => ({ ...s, [c.matchId]: "Nouveau lien créé : l'ancien ne fonctionne plus." }));
  }

  const champ = "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm";
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">Un confrère trouvé hors Soignect</h1>
      <p className="text-sm text-gray-500 mt-1">
        Vous avez déjà convenu d&apos;un remplacement ou d&apos;un assistanat ? Saisissez-le ici : Soignect
        prépare le contrat, et crée pour votre confrère un compte qu&apos;il active lui-même avec le lien
        que vous lui partagez. Aucun email ne lui est envoyé.
      </p>

      <form onSubmit={ajouter} className="mt-5 space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-gray-600">Prénom<input required maxLength={60} value={f.prenom} onChange={maj("prenom")} className={champ} /></label>
          <label className="text-xs font-semibold text-gray-600">Nom<input required maxLength={60} value={f.nom} onChange={maj("nom")} className={champ} /></label>
        </div>
        <label className="block text-xs font-semibold text-gray-600">Email du confrère (facultatif)<input type="email" maxLength={200} value={f.email} onChange={maj("email")} className={champ} />
          <span className="font-normal text-gray-400">Laissé vide, il saisira le sien en activant son compte. Rien ne lui est envoyé.</span></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-gray-600">Type<select value={f.missionType} onChange={maj("missionType")} className={champ}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select></label>
          <label className="text-xs font-semibold text-gray-600">Commune d&apos;exercice<select required value={f.location} onChange={maj("location")} className={champ}><option value="">—</option>{communes.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs font-semibold text-gray-600">Début<input required type="date" value={f.startDate} onChange={maj("startDate")} className={champ} /></label>
          {remplacement
            ? <label className="text-xs font-semibold text-gray-600">Fin<input required type="date" value={f.endDate} onChange={maj("endDate")} className={champ} /></label>
            : <label className="text-xs font-semibold text-gray-600">Durée minimale (mois)<input required type="number" min={1} max={120} value={f.minMonths} onChange={maj("minMonths")} className={champ} /></label>}
          {mode === "FIXE"
            ? <label className="text-xs font-semibold text-gray-600">Redevance mensuelle (€)<input required type="number" min={1} value={f.fixe} onChange={maj("fixe")} className={champ} /></label>
            : <label className="text-xs font-semibold text-gray-600">{remplacement ? "Part du remplaçant (%)" : "Redevance au cabinet (%)"}<input required type="number" min={0} max={100} value={f.taux} onChange={maj("taux")} className={champ} /></label>}
        </div>
        {avecModes && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-gray-600">Mode de redevance<select value={f.mode} onChange={maj("mode")} className={champ}>{(["POURCENTAGE", "FIXE", "PLAFONNEE"] as const).map((m) => <option key={m} value={m}>{LIBELLE_MODE[m]}</option>)}</select></label>
            {mode === "PLAFONNEE" && <label className="text-xs font-semibold text-gray-600">Plafond mensuel de la redevance (€)<input required type="number" min={1} value={f.plafond} onChange={maj("plafond")} className={champ} /></label>}
          </div>
        )}
        {remplacement && <p className="text-[11px] text-gray-400 -mt-1">Un remplaçant se rétrocède en pourcentage (forfait et plafond : assistanat et collaboration seulement).</p>}
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-semibold">Identité professionnelle du confrère (facultatif)</summary>
          <p className="text-gray-400 mt-1">Portée au contrat. Laissée vide, il la complétera lui-même dans son compte.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <label className="font-semibold">RPPS<input maxLength={20} value={f.rpps} onChange={maj("rpps")} className={champ} /></label>
            <label className="font-semibold">N° Ordre<input maxLength={30} value={f.numeroOrdre} onChange={maj("numeroOrdre")} className={champ} /></label>
          </div>
          <label className="block font-semibold mt-2">Adresse<input maxLength={200} value={f.adresse} onChange={maj("adresse")} className={champ} /></label>
        </details>
        {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
        <button disabled={envoi} className="w-full rounded-xl bg-kine-600 py-3 text-sm font-bold text-white disabled:opacity-60">{envoi ? "Ajout…" : "Ajouter et préparer le contrat"}</button>
      </form>

      {liste.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-bold text-gray-700">Vos confrères ajoutés</h2>
          {liste.map((c) => (
            <div key={c.matchId} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="font-semibold text-gray-900 m-0">{c.nom}</p>
              <p className="text-xs text-gray-500 m-0">
                {TYPES.find((t) => t.v === c.missionType)?.l} · dès le {date(c.startDate)}
                {c.endDate ? ` jusqu'au ${date(c.endDate)}` : c.minMonths ? ` · ${c.minMonths} mois min.` : ""}
              </p>
              <p className="text-xs mt-1 m-0">
                <span className={c.active ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"}>{c.active ? "Compte activé" : "En attente d'activation"}</span>
                {" · "}contrat signé : vous {c.signeTitulaire ? "oui" : "non"}, lui {c.signeConfrere ? "oui" : "non"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/match/${c.matchId}/contrat`} className="rounded-lg bg-kine-600 px-3 py-1.5 text-xs font-bold text-white">Préparer / récupérer le contrat</Link>
                {c.lien && <button type="button" onClick={async () => { const m = await partagerLien(c.nom, c.lien!); if (m) setStatut((s) => ({ ...s, [c.matchId]: m })); }} className="rounded-lg border border-kine-600 px-3 py-1.5 text-xs font-bold text-kine-700">Partager le lien d&apos;activation</button>}
                {!c.active && <button type="button" onClick={() => regenerer(c)} className="text-xs text-gray-500 underline">Nouveau lien</button>}
              </div>
              {c.lien && <p className="mt-2 break-all text-[11px] text-gray-400 m-0">{c.lien}</p>}
              {statut[c.matchId] && <p role="status" className="mt-1 text-xs text-gray-700 m-0">{statut[c.matchId]}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
