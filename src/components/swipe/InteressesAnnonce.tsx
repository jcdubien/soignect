"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Liste nominative des intérêts reçus sur UNE annonce (section 207).
//
// Elle remplace un compteur qui savait dire « 3 » sans jamais dire QUI. Chaque ligne résulte
// d'un swipe « Intéressé » de la personne sur CETTE annonce : rien n'est exposé qui n'ait été
// explicitement consenti, et rien n'est visible hors du propriétaire de l'annonce (la route
// répond 403 aux autres).
//
// Deux natures de lignes, et la distinction est le cœur du sujet :
//   • avec recherche publiée → atteignable, elle est dans le fil, on peut se prononcer ;
//   • sans recherche publiée → aucune réciprocité possible aujourd'hui, le produit n'a rien
//     à apparier. Le dire ici évite de compter comme « en attente » ce qui n'attend rien.
interface Interesse {
  profileId: string;
  name: string | null;
  type: string;
  accroche: string | null;
  aPublieUneRecherche: boolean;
  date: string;
}

const TYPE_COURT: Record<string, string> = {
  REMPLACANT: "Remplaçant",
  ASSISTANT: "Assistant",
  TITULAIRE: "Cabinet",
  STRUCTURE: "Établissement",
};

function quand(iso: string): string {
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return "hier";
  if (j < 31) return `il y a ${j} jours`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function InteressesAnnonce({ missionId, onNavigate }: {
  missionId: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Interesse[] | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const r = await fetch(`/api/missions/${missionId}/interesses`);
        if (!r.ok) { if (!annule) setItems([]); return; }
        const d = await r.json();
        if (!annule) setItems(d.interesses ?? []);
      } catch { if (!annule) setItems([]); }
    })();
    return () => { annule = true; };
  }, [missionId]);

  if (items === null) {
    return <p className="px-4 pb-3 pt-1 text-xs text-gray-400">Chargement…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="px-4 pb-3 pt-1 text-xs text-gray-400">
        Personne ne s&apos;est encore signalé sur cette annonce.
      </p>
    );
  }

  return (
    <div className="px-4 pb-3 pt-1 space-y-1.5">
      {items.map((i) => (
        <div key={i.profileId} className="rounded-lg bg-white border border-gray-100 px-3 py-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">{i.name ?? "Sans nom"}</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              {TYPE_COURT[i.type] ?? i.type}
            </span>
            <span className="text-[11px] text-gray-400">{quand(i.date)}</span>
          </div>
          {i.accroche && (
            <p className="text-[11px] text-gray-500 italic mt-0.5 line-clamp-2">{i.accroche}</p>
          )}
          {i.aPublieUneRecherche ? (
            <button
              type="button"
              onClick={() => { router.push(`/annonces?missionId=${encodeURIComponent(missionId)}`); onNavigate?.(); }}
              className="mt-1.5 text-[11px] font-bold text-kine-600 hover:underline"
            >
              Se prononcer dans le fil →
            </button>
          ) : (
            // Ne pas offrir une action qui n'aboutirait pas : le fil présente des annonces,
            // cette personne n'en a aucune, elle n'y apparaîtra pas.
            <p className="mt-1.5 text-[11px] text-amber-700">
              Pas encore de recherche publiée — vous ne pouvez pas encore vous prononcer.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
