"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BESOINS_ACTIFS_MAX, CRITERES_VALIDATION, DUREE_PUBLICATION_JOURS, ETIQUETTE_PROPOSITION, LIMITES_BESOIN,
  NATURES_BESOIN, erreurTexteBesoin, etiquetteBesoin, type NatureBesoinCle,
} from "@/lib/besoinTerritoire";

// Besoins du territoire — écran de la page de gestion (23/10). Règles et libellés :
// lib/besoinTerritoire ; enregistrement : /api/page-client/<jeton>/besoins (éditeur nommé). Les
// contrôles affichés ici (longueur, coordonnées) sont repris à l'identique par le serveur, qui
// reste seul juge.

export interface BesoinAffiche {
  id: string; codeInsee: string; commune: string; profession: string; specialite: string | null;
  nature: NatureBesoinCle; texte: string; proposition: string | null;
  statut: "BROUILLON" | "A_VALIDER" | "PUBLIE" | "ARCHIVE";
  expireLe: string | null; motifRefus: string | null;
}

type Formulaire = { id: string | null; codeInsee: string; profession: string; specialite: string; nature: NatureBesoinCle; texte: string; proposition: string };

const STATUT: Record<BesoinAffiche["statut"], { libelle: string; classe: string }> = {
  BROUILLON: { libelle: "Brouillon", classe: "bg-gray-100 text-gray-700" },
  A_VALIDER: { libelle: "En attente de validation", classe: "bg-amber-100 text-amber-900" },
  PUBLIE: { libelle: "Publié", classe: "bg-emerald-100 text-emerald-800" },
  ARCHIVE: { libelle: "Archivé", classe: "bg-gray-100 text-gray-500" },
};

const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: "America/Guadeloupe" });

export default function BlocBesoins(props: {
  jeton: string;
  nomStructure: string;
  peutModifier: boolean;
  demo: boolean;
  dejaValidee: boolean;
  communes: { code: string; libelle: string }[];
  professions: { value: string; label: string }[];
  besoins: BesoinAffiche[];
  /** Ouverture préremplie demandée par l'encart « Recommandation Soignect » (R5). */
  prerempli?: { codeInsee: string; profession: string; n: number } | null;
  surligne?: boolean;
}) {
  const router = useRouter();
  const vide = (): Formulaire => ({
    id: null, codeInsee: props.communes[0]?.code ?? "", profession: props.professions[0]?.value ?? "",
    specialite: "", nature: "INSTALLATION_LIBERALE", texte: "", proposition: "",
  });
  const [form, setForm] = useState<Formulaire | null>(null);
  const [apercu, setApercu] = useState(false);
  const [etat, setEtat] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [archivesVisibles, setArchivesVisibles] = useState(false);
  useEffect(() => {
    if (!props.prerempli) return;
    setForm({ ...vide(), codeInsee: props.prerempli.codeInsee, profession: props.prerempli.profession });
    setApercu(false); setEtat(null);
  }, [props.prerempli?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (p: string) => props.professions.find((x) => x.value === p)?.label ?? p;
  const communeDe = (code: string) => props.communes.find((c) => c.code === code)?.libelle ?? code;
  const actifs = props.besoins.filter((b) => b.statut === "A_VALIDER" || b.statut === "PUBLIE").length;
  const enCours = props.besoins.filter((b) => b.statut !== "ARCHIVE");
  const archives = props.besoins.filter((b) => b.statut === "ARCHIVE");
  const ecriture = props.peutModifier && !props.demo;

  const erreurLocale = form
    ? (form.texte.trim().length < LIMITES_BESOIN.texteMin ? `Le texte fait au moins ${LIMITES_BESOIN.texteMin} caractères.` : null)
      ?? erreurTexteBesoin("Le texte", form.texte) ?? erreurTexteBesoin("Ce que vous proposez", form.proposition)
    : null;

  async function appel(method: string, body: unknown, ok: string): Promise<boolean> {
    setEtat(null); setEnvoi(true);
    const res = await fetch(`/api/page-client/${props.jeton}/besoins`, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setEnvoi(false);
    const d = await res.json().catch(() => null);
    if (!res.ok) { setEtat(d?.error ?? "Action impossible."); return false; }
    setEtat(ok); router.refresh(); return true;
  }

  async function enregistrer() {
    if (!form || erreurLocale) return;
    const corps = {
      codeInsee: form.codeInsee, profession: form.profession, specialite: form.specialite.trim() || null,
      nature: form.nature, texte: form.texte, proposition: form.proposition.trim() || null,
    };
    const fait = form.id
      ? await appel("PUT", { id: form.id, ...corps }, "Brouillon modifié.")
      : await appel("POST", corps, "Brouillon enregistré. Vérifiez-le, puis demandez sa publication.");
    if (fait) { setForm(null); setApercu(false); }
  }

  const carteApercu = (b: { commune: string; profession: string; specialite: string | null; nature: NatureBesoinCle; texte: string; proposition: string | null }) => (
    <div className="rounded-xl border border-[#0B3D5C]/20 bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#0B3D5C] m-0">{etiquetteBesoin(props.nomStructure)}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1 mb-0">
        {label(b.profession)}{b.specialite ? ` — ${b.specialite}` : ""} · {b.commune}
      </p>
      <p className="text-xs text-gray-500 mt-0.5 mb-2">{NATURES_BESOIN[b.nature]}</p>
      <p className="text-sm text-gray-800 whitespace-pre-line m-0">{b.texte}</p>
      {b.proposition && (
        <p className="text-sm text-gray-700 mt-2 mb-0"><span className="text-xs font-semibold text-gray-500">{ETIQUETTE_PROPOSITION} :</span> {b.proposition}</p>
      )}
      <p className="text-[11px] text-gray-400 mt-2 mb-0">Contact par la messagerie Soignect — aucune coordonnée affichée.</p>
    </div>
  );

  return (
    <div id="bloc-besoins" className={`bg-white rounded-xl border border-gray-200 p-5 ${props.surligne ? "ring-2 ring-[#5eead4]" : ""}`}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="text-sm font-bold m-0">Besoins du territoire</p>
        <p className="text-xs text-gray-500 m-0">{actifs} / {BESOINS_ACTIFS_MAX} besoins actifs</p>
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-3">
        Un manque de votre territoire que vous souhaitez faire connaître aux soignants : une
        profession absente d&apos;une commune, une installation à accompagner. Ce n&apos;est pas une
        offre d&apos;emploi. Publié {DUREE_PUBLICATION_JOURS} jours, renouvelable.
        {!props.dejaValidee && " Votre première publication est relue par Soignect avant d'être visible."}
      </p>
      {props.demo && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-0 mb-3">
          Page de démonstration : les besoins s&apos;ouvrent avec l&apos;abonnement.
        </p>
      )}

      {enCours.length === 0 ? (
        <p className="text-xs text-gray-500 mb-3">Aucun besoin pour l&apos;instant.</p>
      ) : (
        <ul className="list-none p-0 m-0 space-y-2 mb-3">
          {enCours.map((b) => (
            <li key={b.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${STATUT[b.statut].classe}`}>{STATUT[b.statut].libelle}</span>
                <span className="text-sm font-semibold">{label(b.profession)}{b.specialite ? ` — ${b.specialite}` : ""} · {b.commune}</span>
                <span className="text-xs text-gray-500">{NATURES_BESOIN[b.nature]}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1 mb-0 whitespace-pre-line line-clamp-3">{b.texte}</p>
              {b.statut === "PUBLIE" && b.expireLe && <p className="text-[11px] text-gray-500 mt-1 mb-0">Publié jusqu&apos;au {date(b.expireLe)}.</p>}
              {b.statut === "BROUILLON" && b.motifRefus && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-2 mb-0">Renvoyé par Soignect : {b.motifRefus}</p>
              )}
              {ecriture && (
                <div className="flex gap-3 flex-wrap mt-2">
                  {b.statut === "BROUILLON" && (
                    <>
                      <button type="button" className="text-xs text-[#0B3D5C] underline" onClick={() => {
                        setForm({ id: b.id, codeInsee: b.codeInsee, profession: b.profession, specialite: b.specialite ?? "", nature: b.nature, texte: b.texte, proposition: b.proposition ?? "" });
                        setApercu(false);
                      }}>Modifier</button>
                      <button type="button" disabled={envoi} className="text-xs font-bold text-[#0B3D5C] underline"
                        onClick={() => appel("PATCH", { id: b.id, action: "publier" }, props.dejaValidee ? "Besoin publié." : "Demande envoyée : Soignect relit votre première publication.")}>
                        {props.dejaValidee ? "Publier" : "Demander la publication"}
                      </button>
                    </>
                  )}
                  {b.statut === "PUBLIE" && (
                    <button type="button" disabled={envoi} className="text-xs text-[#0B3D5C] underline"
                      onClick={() => appel("PATCH", { id: b.id, action: "renouveler" }, `Renouvelé pour ${DUREE_PUBLICATION_JOURS} jours.`)}>
                      Renouveler
                    </button>
                  )}
                  {b.statut !== "A_VALIDER" && (
                    <button type="button" disabled={envoi} className="text-xs text-red-600 underline"
                      onClick={() => appel("PATCH", { id: b.id, action: "archiver" }, "Besoin archivé.")}>
                      Archiver
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {ecriture && !form && (
        <button type="button" onClick={() => { setForm(vide()); setApercu(false); setEtat(null); }}
          className="px-3 py-2 rounded-lg border border-[#0B3D5C] text-[#0B3D5C] text-xs font-bold">
          Préparer un besoin
        </button>
      )}

      {ecriture && form && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-bold text-gray-700 m-0">{form.id ? "Modifier le brouillon" : "Nouveau besoin"}</p>
          {apercu ? (
            <>
              <p className="text-xs text-gray-500 m-0">Aperçu — c&apos;est ainsi que les soignants le liront.</p>
              {carteApercu({ commune: communeDe(form.codeInsee), profession: form.profession, specialite: form.specialite.trim() || null, nature: form.nature, texte: form.texte.trim(), proposition: form.proposition.trim() || null })}
              <div className="flex gap-2 flex-wrap">
                <button type="button" disabled={envoi || !!erreurLocale} onClick={enregistrer} className="px-3 py-2 rounded-lg bg-[#0B3D5C] text-white text-xs font-bold disabled:opacity-50">
                  Enregistrer le brouillon
                </button>
                <button type="button" onClick={() => setApercu(false)} className="text-xs text-gray-600 underline">Revenir au formulaire</button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold text-gray-600">Commune
                  <select value={form.codeInsee} onChange={(e) => setForm({ ...form, codeInsee: e.target.value })} className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2 py-2 font-normal">
                    {props.communes.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-gray-600">Profession
                  <select value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2 py-2 font-normal">
                    {props.professions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-gray-600">Spécialité <span className="font-normal text-gray-400">(facultatif)</span>
                  <input value={form.specialite} maxLength={LIMITES_BESOIN.specialiteMax} onChange={(e) => setForm({ ...form, specialite: e.target.value })} className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2 py-2 font-normal" />
                </label>
                <label className="text-xs font-semibold text-gray-600">Nature
                  <select value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value as NatureBesoinCle })} className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2 py-2 font-normal">
                    {(Object.keys(NATURES_BESOIN) as NatureBesoinCle[]).map((n) => <option key={n} value={n}>{NATURES_BESOIN[n]}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-gray-600">Le besoin
                <textarea rows={4} value={form.texte} maxLength={LIMITES_BESOIN.texteMax} onChange={(e) => setForm({ ...form, texte: e.target.value })}
                  placeholder="Ce qui manque, où, et depuis quand si vous le savez."
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg p-2 font-normal" />
                <span className="block text-[11px] font-normal text-gray-400">{form.texte.trim().length} / {LIMITES_BESOIN.texteMax} caractères (au moins {LIMITES_BESOIN.texteMin})</span>
              </label>
              <label className="block text-xs font-semibold text-gray-600">Ce que vous proposez <span className="font-normal text-gray-400">(facultatif — affiché « {ETIQUETTE_PROPOSITION.toLowerCase()} »)</span>
                <textarea rows={2} value={form.proposition} maxLength={LIMITES_BESOIN.propositionMax} onChange={(e) => setForm({ ...form, proposition: e.target.value })}
                  placeholder="Locaux, accompagnement à l'installation, mise en relation avec les équipes…"
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg p-2 font-normal" />
              </label>
              <p className="text-[11px] text-gray-500 m-0">Pas de téléphone, d&apos;email ni de lien : les soignants vous écrivent par la messagerie Soignect.</p>
              {erreurLocale && form.texte.length > 0 && <p role="alert" className="text-xs text-red-700 m-0">{erreurLocale}</p>}
              <div className="flex gap-2 flex-wrap">
                <button type="button" disabled={!!erreurLocale} onClick={() => setApercu(true)} className="px-3 py-2 rounded-lg bg-[#0B3D5C] text-white text-xs font-bold disabled:opacity-50">
                  Voir l&apos;aperçu
                </button>
                <button type="button" onClick={() => { setForm(null); setApercu(false); }} className="text-xs text-gray-600 underline">Annuler</button>
              </div>
            </>
          )}
        </div>
      )}

      {archives.length > 0 && (
        <div className="mt-3">
          <button type="button" aria-expanded={archivesVisibles} onClick={() => setArchivesVisibles((v) => !v)} className="text-xs text-gray-500 underline">
            {archivesVisibles ? "Masquer les archivés" : `Archivés (${archives.length})`}
          </button>
          {archivesVisibles && (
            <ul className="list-none p-0 m-0 mt-2 space-y-1">
              {archives.map((b) => (
                <li key={b.id} className="text-xs text-gray-500">{label(b.profession)}{b.specialite ? ` — ${b.specialite}` : ""} · {b.commune} · {NATURES_BESOIN[b.nature]}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-gray-600">Ce que Soignect vérifie avant une première publication</summary>
        <ol className="text-xs text-gray-600 mt-2 mb-0 pl-5 space-y-1">
          {CRITERES_VALIDATION.map((c) => <li key={c}>{c}</li>)}
        </ol>
      </details>
      {etat && <p role="status" className="text-sm text-gray-700 mt-3 mb-0">{etat}</p>}
    </div>
  );
}
