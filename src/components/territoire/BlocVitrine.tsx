"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LIMITES_VITRINE, RUBRIQUES_VITRINE, STATUTS_VITRINE, erreurContenuVitrine, erreurPublicationVitrine,
  type ContenuVitrine,
} from "@/lib/vitrineTerritoire";
import VitrineAffichee from "@/components/territoire/VitrineAffichee";

// Vitrine du territoire — écran de la page de gestion (02/11). Règles et libellés :
// lib/vitrineTerritoire ; enregistrement : /api/page-client/<jeton>/vitrine (éditeur nommé). Les
// contrôles affichés ici sont repris à l'identique par le serveur, qui reste seul juge.

export interface VitrineGestion extends ContenuVitrine {
  statut: keyof typeof STATUTS_VITRINE;
  dejaValidee: boolean;
  motifRefus: string | null;
  photos: { url: string; chemin: string; legende: string }[];
}

const CLASSE_STATUT: Record<VitrineGestion["statut"], string> = {
  BROUILLON: "bg-gray-100 text-gray-700",
  A_VALIDER: "bg-amber-100 text-amber-900",
  PUBLIE: "bg-emerald-100 text-emerald-800",
  RETIREE: "bg-red-100 text-red-800",
};

/** Réduit la photo avant l'envoi (corps de requête limité côté serveur) ; le serveur la réécrit
 *  de toute façon. Orientation appliquée par le navigateur. */
async function reduire(fichier: File): Promise<Blob> {
  const COTE = 2000;
  const image = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  const echelle = Math.min(1, COTE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("Photo illisible"))), "image/jpeg", 0.88));
}

export default function BlocVitrine(props: {
  jeton: string;
  peutModifier: boolean;
  demo: boolean;
  vitrine: VitrineGestion | null;
  surligne?: boolean;
}) {
  const router = useRouter();
  const v = props.vitrine;
  const [form, setForm] = useState<ContenuVitrine>({
    accroche: v?.accroche ?? "", cadreDeVie: v?.cadreDeVie ?? "", offreSoins: v?.offreSoins ?? "", aidesInstallation: v?.aidesInstallation ?? "",
  });
  const [legendes, setLegendes] = useState<string[]>(v?.photos.map((p) => p.legende) ?? []);
  const [nouvelleLegende, setNouvelleLegende] = useState("");
  const [apercu, setApercu] = useState(false);
  const [etat, setEtat] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const ecriture = props.peutModifier && !props.demo;
  const enRelecture = v?.statut === "A_VALIDER";
  const modifiable = ecriture && !enRelecture;
  const erreur = erreurContenuVitrine(form, legendes);
  const change = !v || form.accroche !== v.accroche || RUBRIQUES_VITRINE.some((r) => (form[r.cle] ?? "") !== (v[r.cle] ?? ""))
    || legendes.some((l, i) => l !== v.photos[i]?.legende);

  async function appel(init: RequestInit, ok: string): Promise<boolean> {
    setEtat(null); setEnvoi(true);
    const res = await fetch(`/api/page-client/${props.jeton}/vitrine`, init).catch(() => null);
    setEnvoi(false);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { setEtat(d?.error ?? "Action impossible."); return false; }
    setEtat(ok); router.refresh(); return true;
  }
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  async function enregistrer() {
    if (erreur) return;
    await appel(json("PUT", { ...form, legendes }), v?.statut === "PUBLIE" ? "Modifications publiées." : "Vitrine enregistrée.");
  }

  async function ajouterPhoto(fichier: File | undefined) {
    if (!fichier) return;
    setEtat(null);
    let blob: Blob;
    try { blob = await reduire(fichier); } catch { setEtat("Cette photo ne peut pas être lue. Essayez un fichier JPEG ou PNG."); return; }
    const fd = new FormData();
    fd.append("file", blob, "photo.jpg");
    fd.append("legende", nouvelleLegende);
    if (await appel({ method: "POST", body: fd }, "Photo ajoutée.")) {
      setLegendes((l) => [...l, nouvelleLegende.trim()]);
      setNouvelleLegende("");
    }
  }

  async function retirerPhoto(i: number, chemin: string) {
    if (await appel(json("DELETE", { chemin }), "Photo retirée.")) setLegendes((l) => l.filter((_, j) => j !== i));
  }

  const publicationManquante = v ? erreurPublicationVitrine(v) : null;

  return (
    <div id="bloc-vitrine" className={`bg-white rounded-xl border border-gray-200 p-5 ${props.surligne ? "ring-2 ring-[#5eead4]" : ""}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-bold m-0">Vitrine du territoire</p>
        {v && <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${CLASSE_STATUT[v.statut]}`}>{STATUTS_VITRINE[v.statut]}</span>}
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-3">
        Donnez envie aux soignants de venir exercer chez vous. La vitrine s&apos;affiche sur votre page
        publique et, dans Soignect, sur les cartes de vos besoins du territoire.
        {v?.dejaValidee ? " Vos modifications paraissent directement." : " Sa première publication est relue par Soignect avant d'être visible."}
        {" "}Pas de numéro, d&apos;email ni de lien : le contact passe par Soignect.
      </p>
      {props.demo && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-0 mb-3">
          Page de démonstration : la vitrine s&apos;ouvre avec l&apos;abonnement.
        </p>
      )}
      {enRelecture && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-0 mb-3">
          Soignect relit votre vitrine. Elle se modifie après la décision.
        </p>
      )}
      {v?.motifRefus && (v.statut === "BROUILLON" || v.statut === "RETIREE") && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-0 mb-3">
          {v.statut === "RETIREE" ? "Retirée par Soignect" : "Renvoyée par Soignect"} : {v.motifRefus}
          {v.statut === "RETIREE" && " — corrigez-la, puis demandez à nouveau sa publication : elle sera relue."}
        </p>
      )}

      <div className="space-y-3">
        <label className="block text-xs font-semibold text-gray-600">
          Accroche <span className="font-normal text-gray-400">({form.accroche.length}/{LIMITES_VITRINE.accrocheMax})</span>
          <input value={form.accroche} maxLength={LIMITES_VITRINE.accrocheMax} disabled={!modifiable}
            placeholder="Ex. : Exercer au cœur du Nord Basse-Terre, entre forêt et mer"
            onChange={(e) => setForm({ ...form, accroche: e.target.value })}
            className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm font-normal" />
        </label>
        {RUBRIQUES_VITRINE.map((r) => (
          <label key={r.cle} className="block text-xs font-semibold text-gray-600">
            {r.titre} <span className="font-normal text-gray-400">({(form[r.cle] ?? "").length}/{LIMITES_VITRINE.rubriqueMax})</span>
            <span className="block font-normal text-gray-400">{r.aide}</span>
            <textarea value={form[r.cle] ?? ""} maxLength={LIMITES_VITRINE.rubriqueMax} rows={4} disabled={!modifiable}
              onChange={(e) => setForm({ ...form, [r.cle]: e.target.value })}
              className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm font-normal" />
          </label>
        ))}

        {v && (
          <div>
            <p className="text-xs font-semibold text-gray-600 m-0">Photos ({v.photos.length}/{LIMITES_VITRINE.photosMax})</p>
            <p className="text-[11px] text-gray-400 mt-0.5 mb-2">Le territoire, pas les personnes : aucune personne reconnaissable sans son accord.</p>
            {v.photos.length > 0 && (
              <ul className="list-none p-0 m-0 grid grid-cols-2 gap-2">
                {v.photos.map((p, i) => (
                  <li key={p.chemin} className="rounded-lg border border-gray-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={legendes[i] || "Photo du territoire"} className="w-full h-24 object-cover rounded" />
                    <input value={legendes[i] ?? ""} maxLength={LIMITES_VITRINE.legendeMax} disabled={!modifiable} placeholder="Légende"
                      onChange={(e) => setLegendes((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                      className="mt-1 w-full border border-gray-200 rounded p-1 text-xs" />
                    {modifiable && (
                      <button type="button" disabled={envoi} onClick={() => { void retirerPhoto(i, p.chemin); }} className="mt-1 text-[11px] text-red-600 underline">Retirer</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {modifiable && v.photos.length < LIMITES_VITRINE.photosMax && (
              <div className="mt-2 flex gap-2 flex-wrap items-center">
                <input value={nouvelleLegende} maxLength={LIMITES_VITRINE.legendeMax} placeholder="Légende de la photo (facultatif)"
                  onChange={(e) => setNouvelleLegende(e.target.value)}
                  className="flex-1 min-w-[180px] border border-gray-200 rounded-lg p-2 text-xs" />
                <label className={`px-3 py-2 rounded-lg border border-[#0B3D5C] text-[#0B3D5C] text-xs font-bold cursor-pointer ${envoi ? "opacity-50" : ""}`}>
                  {envoi ? "Envoi…" : "Ajouter une photo"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={envoi}
                    onChange={(e) => { void ajouterPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            )}
          </div>
        )}
        {!v && ecriture && <p className="text-[11px] text-gray-400 m-0">Les photos s&apos;ajoutent une fois la vitrine enregistrée.</p>}
      </div>

      {modifiable && (
        <>
          {erreur && form.accroche.length > 0 && <p className="text-xs text-red-700 mt-3 mb-0">{erreur}</p>}
          <div className="flex gap-2 flex-wrap mt-3">
            <button type="button" disabled={envoi || !!erreur || !change} onClick={() => { void enregistrer(); }}
              className="px-3 py-2 rounded-lg bg-[#0B3D5C] text-white text-xs font-bold disabled:opacity-40">
              {v?.statut === "PUBLIE" ? "Publier les modifications" : "Enregistrer"}
            </button>
            {v && (v.statut === "BROUILLON" || v.statut === "RETIREE") && !change && (
              <button type="button" disabled={envoi || !!publicationManquante}
                title={publicationManquante ?? undefined}
                onClick={() => { void appel(json("PATCH", { action: "publier" }), v.dejaValidee ? "Vitrine publiée." : "Demande envoyée : Soignect relit votre vitrine."); }}
                className="px-3 py-2 rounded-lg border border-[#0B3D5C] text-[#0B3D5C] text-xs font-bold disabled:opacity-40">
                {v.dejaValidee ? "Publier" : "Demander la publication"}
              </button>
            )}
            {v?.statut === "PUBLIE" && !change && (
              <button type="button" disabled={envoi} onClick={() => { void appel(json("PATCH", { action: "masquer" }), "Vitrine masquée. Vous pouvez la republier à tout moment."); }}
                className="text-xs text-gray-600 underline">
                Masquer la vitrine
              </button>
            )}
            {form.accroche.trim() && (
              <button type="button" onClick={() => setApercu(!apercu)} className="text-xs text-[#0B3D5C] underline">
                {apercu ? "Fermer l'aperçu" : "Aperçu"}
              </button>
            )}
          </div>
          {v && (v.statut === "BROUILLON" || v.statut === "RETIREE") && !change && publicationManquante && (
            <p className="text-[11px] text-gray-500 mt-2 mb-0">{publicationManquante}</p>
          )}
        </>
      )}
      {!ecriture && !v && !props.demo && <p className="text-xs text-gray-500 m-0">Aucune vitrine pour l&apos;instant.</p>}

      {(apercu || (!modifiable && v)) && form.accroche.trim() && (
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3">
          {apercu && <p className="text-[10px] font-bold uppercase text-gray-400 m-0 mb-2">Aperçu</p>}
          <VitrineAffichee compacte vitrine={{ ...form, photos: (v?.photos ?? []).map((p, i) => ({ url: p.url, legende: legendes[i] ?? "" })) }} />
        </div>
      )}
      {etat && <p role="status" className="text-xs text-gray-700 mt-3 mb-0">{etat}</p>}
    </div>
  );
}
