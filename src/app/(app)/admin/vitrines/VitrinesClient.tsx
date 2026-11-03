"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VitrineAffichee from "@/components/territoire/VitrineAffichee";
import type { VitrinePublique } from "@/lib/vitrineTerritoire";

interface Vitrine {
  id: string; structure: string; statut: "BROUILLON" | "A_VALIDER" | "PUBLIE" | "RETIREE"; libelleStatut: string;
  liee: boolean; motif: string | null; majLe: string; lienPublic: string | null; contenu: VitrinePublique;
}

const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: "America/Guadeloupe" });

export default function VitrinesClient({ vitrines, criteres, mentionLien }: { vitrines: Vitrine[]; criteres: readonly string[]; mentionLien: string }) {
  const router = useRouter();
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [etat, setEtat] = useState<string | null>(null);

  async function decider(id: string, decision: "valider" | "refuser" | "retirer") {
    setEtat(null);
    const r = await fetch("/api/admin/vitrines", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, motif: motifs[id] ?? null }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) { setEtat(d?.error ?? "Action impossible."); return; }
    setEtat(decision === "valider" ? "Vitrine validée et publiée." : decision === "retirer" ? "Vitrine retirée, avec le motif. Sa prochaine publication sera relue." : "Vitrine renvoyée en brouillon, avec le motif.");
    router.refresh();
  }

  const aValider = vitrines.filter((v) => v.statut === "A_VALIDER");
  const autres = vitrines.filter((v) => v.statut !== "A_VALIDER");

  const champMotif = (id: string, texte: string) => (
    <input value={motifs[id] ?? ""} maxLength={300} placeholder={texte}
      onChange={(e) => setMotifs((m) => ({ ...m, [id]: e.target.value }))}
      className="mt-3 w-full rounded-lg border border-gray-200 p-2 text-sm" />
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">Vitrines du territoire</h1>
      <h2 className="mt-4 text-lg font-bold text-gray-900">À valider</h2>
      <p className="mt-1 text-sm text-gray-500">
        La première publication d&apos;une vitrine passe ici, et la suivante après un retrait. Les
        modifications d&apos;une vitrine validée paraissent directement ; vous en êtes prévenu.
      </p>
      <details className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">Critères de validation</summary>
        <ol className="mt-2 mb-0 pl-5 text-sm text-gray-700 space-y-1">
          {criteres.map((c) => <li key={c}>{c}</li>)}
        </ol>
      </details>
      {etat && <p role="status" className="mt-3 text-sm text-gray-700">{etat}</p>}
      {aValider.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">Aucune vitrine en attente.</p>
      ) : (
        <ul className="mt-4 space-y-3 list-none p-0">
          {aValider.map((v) => (
            <li key={v.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 m-0">{v.structure} · demandée le {date(v.majLe)}</p>
              {v.liee && (
                <p className="mt-1 mb-0 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                  {mentionLien} — la validation sera inscrite comme telle au journal.
                </p>
              )}
              <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-3">
                <VitrineAffichee compacte vitrine={v.contenu} />
              </div>
              {champMotif(v.id, "Motif (obligatoire pour un refus)")}
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { void decider(v.id, "valider"); }} className="rounded-lg bg-[#0B3D5C] px-3 py-1.5 text-xs font-bold text-white">Valider et publier</button>
                <button type="button" onClick={() => { void decider(v.id, "refuser"); }} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700">Renvoyer en brouillon</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-lg font-bold text-gray-900">Toutes les vitrines</h2>
      {autres.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">Aucune.</p>
      ) : (
        <ul className="mt-3 space-y-2 list-none p-0">
          {autres.map((v) => (
            <li key={v.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{v.libelleStatut}</span>
                <span className="text-sm font-semibold">{v.structure}</span>
                <span className="text-xs text-gray-500">modifiée le {date(v.majLe)}</span>
                <button type="button" onClick={() => setOuverte(ouverte === v.id ? null : v.id)} className="text-xs text-[#0B3D5C] underline">{ouverte === v.id ? "Réduire" : "Lire"}</button>
                {v.statut === "PUBLIE" && v.lienPublic && <a href={v.lienPublic} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0B3D5C] underline">Page publique</a>}
              </div>
              <p className="text-xs text-gray-600 mt-1 mb-0">{v.contenu.accroche}</p>
              {v.motif && <p className="text-xs text-gray-500 mt-1 mb-0">Dernier motif : {v.motif}</p>}
              {ouverte === v.id && (
                <div className="mt-2 rounded-xl border border-dashed border-gray-300 p-3">
                  <VitrineAffichee compacte vitrine={v.contenu} />
                </div>
              )}
              {v.statut === "PUBLIE" && (
                <>
                  {champMotif(v.id, "Motif du retrait (obligatoire)")}
                  <button type="button" onClick={() => { void decider(v.id, "retirer"); }} className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700">Retirer la vitrine</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
