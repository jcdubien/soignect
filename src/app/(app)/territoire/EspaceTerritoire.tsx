"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StatsTerritoire } from "@/lib/statsTerritoire";

interface Demande {
  id: string; commune: string; profession: string; niveau: number; motif: string;
  statut: "EN_ATTENTE" | "RETENUE" | "REFUSEE"; reponse: string | null; createdAt: string;
}

const STATUT = {
  EN_ATTENTE: { texte: "En attente", classe: "bg-amber-100 text-amber-800" },
  RETENUE:    { texte: "Retenue",    classe: "bg-emerald-100 text-emerald-800" },
  REFUSEE:    { texte: "Non retenue", classe: "bg-gray-200 text-gray-600" },
};

export default function EspaceTerritoire({
  stats, demandes, communes, professions,
}: {
  stats: StatsTerritoire;
  demandes: Demande[];
  communes: string[];
  professions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [commune, setCommune] = useState(communes[0] ?? "");
  const [profession, setProfession] = useState(professions[0]?.value ?? "");
  const [niveau, setNiveau] = useState(3);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    if (envoi) return;
    setEnvoi(true); setErreur(null);
    try {
      const r = await fetch("/api/territoire/demandes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commune, profession, niveau, motif }),
      });
      if (!r.ok) {
        setErreur(motif.trim().length < 10
          ? "Précisez le motif — au moins une phrase : c'est ce qui permet d'arbitrer."
          : "L'envoi a échoué. Réessayez.");
        return;
      }
      setMotif("");
      router.refresh();
    } catch { setErreur("Erreur réseau. Réessayez."); }
    finally { setEnvoi(false); }
  }

  const carte = (valeur: number, libelle: string, precision: string) => (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-2xl font-black text-gray-900 leading-none">{valeur}</p>
      <p className="text-xs font-semibold text-gray-700 mt-1.5">{libelle}</p>
      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{precision}</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {carte(stats.annoncesActives, "Postes ouverts", "annonces de cabinets actuellement publiées")}
        {carte(stats.candidatsDisponibles, "Praticiens disponibles", "recherches publiées, tous statuts")}
        {carte(stats.misesEnRelation90j, "Mises en relation", "confirmées sur les 90 derniers jours")}
        {carte(stats.prioritesEnVigueur.length, "Communes priorisées", "déclarations actuellement en vigueur")}
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Répartition par zone</h2>
        <table className="w-full mt-3 text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
              <th className="py-1.5">Zone</th><th className="py-1.5 text-right">Postes</th><th className="py-1.5 text-right">Praticiens</th>
            </tr>
          </thead>
          <tbody>
            {stats.parZone.map((z) => (
              <tr key={z.zone} className="border-t border-gray-50">
                <td className="py-2 text-gray-800">{z.zone}</td>
                <td className="py-2 text-right font-semibold text-gray-900">{z.annonces}</td>
                <td className="py-2 text-right font-semibold text-gray-900">{z.candidats}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Agrégats seulement : aucun nom, aucune annonce nominative. Le partenaire lit une
            tension, il ne consulte pas des personnes. */}
        <p className="text-[11px] text-gray-400 mt-2.5 leading-snug">
          Données agrégées. Aucune information nominative n&apos;est accessible depuis cet espace.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Priorités en vigueur</h2>
        {stats.prioritesEnVigueur.length === 0 ? (
          <p className="text-xs text-gray-400 mt-2">Aucune priorité déclarée actuellement.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {stats.prioritesEnVigueur.map((p, i) => (
              <li key={i} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">
                {p.commune} · niveau {p.niveau}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <h2 className="text-sm font-bold text-amber-900 uppercase tracking-wide">Signaler une zone en tension</h2>
        {/* Ce que cet écran NE fait PAS, dit avant le formulaire plutôt qu'après l'envoi. */}
        <p className="text-[11px] text-amber-800 mt-1 leading-snug">
          Cette demande ne modifie rien par elle-même : elle est transmise à l&apos;équipe Soignect,
          qui l&apos;examine et vous répond ici.
        </p>

        <div className="mt-3 grid sm:grid-cols-3 gap-2">
          <select value={commune} onChange={(e) => setCommune(e.target.value)}
            className="px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm">
            {communes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={profession} onChange={(e) => setProfession(e.target.value)}
            className="px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm">
            {professions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm">
            <span className="text-xs text-gray-500 shrink-0">Niveau</span>
            <input type="number" min={1} max={10} value={niveau}
              onChange={(e) => setNiveau(Number(e.target.value))}
              className="w-full min-w-0 outline-none" />
          </label>
        </div>

        <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} maxLength={500}
          placeholder="Pourquoi cette zone est-elle en tension ? Ce que vous savez du terrain et que la plateforme ne peut pas mesurer."
          className="mt-2 w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm" />

        {erreur && <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erreur}</p>}

        <button type="button" onClick={envoyer} disabled={envoi}
          className="mt-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition disabled:opacity-40">
          {envoi ? "Envoi…" : "Transmettre la demande"}
        </button>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Vos demandes</h2>
        {demandes.length === 0 ? (
          <p className="text-xs text-gray-400 mt-2">Aucune demande transmise pour l&apos;instant.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {demandes.map((d) => (
              <div key={d.id} className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">{d.commune} · niveau {d.niveau}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUT[d.statut].classe}`}>
                    {STATUT[d.statut].texte}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-snug">{d.motif}</p>
                {d.reponse && (
                  <p className="text-xs text-gray-700 mt-1.5 border-l-2 border-gray-200 pl-2">
                    <strong>Réponse :</strong> {d.reponse}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
