"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ETIQUETTE_PROPOSITION } from "@/lib/besoinTerritoire";

interface Besoin {
  id: string; structure: string; commune: string; profession: string; nature: string;
  texte: string; proposition: string | null; demandeLe: string; liee: boolean;
}

export default function BesoinsClient({ besoins, criteres, mentionLien }: { besoins: Besoin[]; criteres: readonly string[]; mentionLien: string }) {
  const router = useRouter();
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [etat, setEtat] = useState<string | null>(null);

  async function decider(id: string, decision: "valider" | "refuser") {
    setEtat(null);
    const r = await fetch("/api/admin/besoins", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, motif: motifs[id] ?? null }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) { setEtat(d?.error ?? "Action impossible."); return; }
    setEtat(decision === "valider" ? "Besoin validé et publié." : "Besoin renvoyé en brouillon, avec le motif.");
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">Besoins du territoire à valider</h1>
      <p className="mt-1 text-sm text-gray-500">
        La première publication de chaque structure passe ici. Les suivantes sont publiées directement,
        et restent visibles dans le journal de la structure.
      </p>
      <details className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">Critères de validation</summary>
        <ol className="mt-2 mb-0 pl-5 text-sm text-gray-700 space-y-1">
          {criteres.map((c) => <li key={c}>{c}</li>)}
        </ol>
      </details>
      {etat && <p role="status" className="mt-3 text-sm text-gray-700">{etat}</p>}
      {besoins.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">Aucun besoin en attente.</p>
      ) : (
        <ul className="mt-4 space-y-3 list-none p-0">
          {besoins.map((b) => (
            <li key={b.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 m-0">{b.structure} · {b.commune} · {b.profession}</p>
              {b.liee && (
                <p className="mt-1 mb-0 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                  {mentionLien} — la validation sera inscrite comme telle au journal.
                </p>
              )}
              <p className="text-xs text-gray-500 mt-0.5 mb-2">{b.nature} · demandé le {new Date(b.demandeLe).toLocaleDateString("fr-FR")}</p>
              <p className="text-sm text-gray-800 whitespace-pre-line m-0">{b.texte}</p>
              {b.proposition && (
                <p className="text-sm text-gray-700 mt-2 mb-0"><span className="text-xs font-semibold text-gray-500">{ETIQUETTE_PROPOSITION} :</span> {b.proposition}</p>
              )}
              <textarea
                rows={2} maxLength={300} placeholder="Motif du refus (obligatoire pour refuser)"
                value={motifs[b.id] ?? ""} onChange={(e) => setMotifs({ ...motifs, [b.id]: e.target.value })}
                className="mt-3 w-full rounded-lg border border-gray-200 p-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => decider(b.id, "valider")} className="rounded-lg bg-[#0B3D5C] px-3 py-2 text-xs font-bold text-white">Valider et publier</button>
                <button type="button" onClick={() => decider(b.id, "refuser")} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700">Refuser</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
