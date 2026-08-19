"use client";

import { useState } from "react";

const PROFESSIONS = [
  { value: "KINESITHERAPEUTE", label: "Kinésithérapeute" },
  { value: "INFIRMIER", label: "Infirmier" },
  { value: "MEDECIN", label: "Médecin" },
  { value: "SAGE_FEMME", label: "Sage-femme" },
  { value: "ORTHOPHONISTE", label: "Orthophoniste" },
] as const;

const LIBELLE_PROFESSION: Record<string, string> = Object.fromEntries(
  PROFESSIONS.map((p) => [p.value, p.label]),
);

interface Priorite {
  id: string;
  codeInsee: string;
  commune: string;
  profession: string;
  niveau: number;
  institution: string;
  declareLe: string;
  note: string | null;
  expireLe: string | null;
  saisiPar: { email: string } | null;
}

const FACTEUR = 3; // FACTEUR_PRIORITE_TERRITORIALE — voir src/lib/territoire.ts

const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : null);
const estEchue = (p: Priorite) => p.expireLe !== null && new Date(p.expireLe) <= new Date();

export default function PrioritesClient({
  initialData,
  communes,
}: {
  initialData: Priorite[];
  communes: string[];
}) {
  const [data, setData] = useState<Priorite[]>(initialData);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  const [form, setForm] = useState({
    commune: "",
    profession: "KINESITHERAPEUTE",
    niveau: 2,
    institution: "",
    declareLe: new Date().toISOString().slice(0, 10),
    note: "",
    expireLe: "",
  });

  async function declarer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const r = await fetch("/api/admin/priorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        niveau: Number(form.niveau),
        note: form.note || undefined,
        expireLe: form.expireLe || null,
      }),
    });
    const json = await r.json();
    if (r.ok) {
      setData((prev) => [...prev, json]);
      setForm({ ...form, commune: "", note: "", expireLe: "" });
      setOuvert(false);
    } else {
      setErreur(typeof json.error === "string" ? json.error : "Déclaration refusée.");
    }
    setEnvoi(false);
  }

  async function supprimer(id: string) {
    const r = await fetch(`/api/admin/priorites/${id}`, { method: "DELETE" });
    if (r.ok) setData((prev) => prev.filter((p) => p.id !== id));
  }

  const actives = data.filter((p) => !estEchue(p));

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">
          Priorités territoriales déclarées{" "}
          <span className="text-sm font-normal text-gray-400">({actives.length} active{actives.length > 1 ? "s" : ""})</span>
        </h1>
        <button
          onClick={() => setOuvert((v) => !v)}
          className="text-sm px-3 py-2 rounded-lg bg-kine-600 text-white font-semibold hover:bg-kine-700 transition"
        >
          {ouvert ? "Annuler" : "Déclarer une priorité"}
        </button>
      </div>

      {/* Ce bandeau n'est pas décoratif. L'écran /admin/apl a passé des mois à inviter à régler
          un curseur qui n'agissait sur rien, pendant que le feed affirmait le contraire à
          l'utilisateur. Dire ici ce que la saisie fait, et au nom de qui, est le minimum. */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900 leading-relaxed">
        Une déclaration remonte les <strong>postes</strong> de cette commune dans le feed des
        candidats de la profession concernée — jamais l&apos;inverse, et jamais dans le score de
        compatibilité. Elle est attribuée nommément à l&apos;institution saisie : c&apos;est cette
        ligne qui autorise le produit à écrire «&nbsp;déclarée prioritaire par&nbsp;»
        à l&apos;utilisateur. Ne rien saisir ici qu&apos;une institution n&apos;ait réellement dit.
      </div>

      {ouvert && (
        <form onSubmit={declarer} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-500 space-y-1 block">
              Commune
              <select
                required
                value={form.commune}
                onChange={(e) => setForm({ ...form, commune: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
              >
                <option value="">— choisir —</option>
                {communes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-500 space-y-1 block">
              Profession concernée
              <select
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
              >
                {PROFESSIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-500 space-y-1 block">
              Institution qui déclare
              <input
                required
                minLength={2}
                maxLength={160}
                placeholder="CPTS Nord Basse-Terre"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
              />
            </label>

            <label className="text-xs text-gray-500 space-y-1 block">
              Déclarée le
              <input
                required
                type="date"
                value={form.declareLe}
                onChange={(e) => setForm({ ...form, declareLe: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
              />
            </label>

            <label className="text-xs text-gray-500 space-y-1 block">
              Intensité déclarée (1 à 10) — pèse {form.niveau * FACTEUR} points d&apos;ordre
              <input
                required
                type="number"
                min={1}
                max={10}
                value={form.niveau}
                onChange={(e) => setForm({ ...form, niveau: Number(e.target.value) })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
              />
            </label>

            <label className="text-xs text-gray-500 space-y-1 block">
              Échéance (facultatif) — au-delà, la déclaration cesse d&apos;agir
              <input
                type="date"
                value={form.expireLe}
                onChange={(e) => setForm({ ...form, expireLe: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
              />
            </label>
          </div>

          <label className="text-xs text-gray-500 space-y-1 block">
            Contexte de l&apos;échange (facultatif, 500 car.)
            <textarea
              rows={2}
              maxLength={500}
              placeholder="Appel du 19/08 avec la présidente — manque signalé sur les remplacements d'été."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
            />
          </label>

          {erreur && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erreur}</p>
          )}

          <button
            type="submit"
            disabled={envoi}
            className="text-sm px-4 py-2 rounded-lg bg-kine-600 text-white font-semibold disabled:opacity-50"
          >
            {envoi ? "Enregistrement…" : "Enregistrer la déclaration"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Commune</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">INSEE</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Profession</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Niveau</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Déclarée par</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Le</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Échéance</th>
              <th className="px-3 py-3 text-left text-gray-500 font-medium">Co-saisie par</th>
              <th className="px-3 py-3 text-right text-gray-500 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-xs leading-relaxed">
                  Aucune priorité déclarée.<br />
                  Le levier territorial est donc sans effet sur le feed — c&apos;est l&apos;état
                  correct tant qu&apos;aucune institution n&apos;a rien dit.
                </td>
              </tr>
            )}
            {data.map((p) => {
              const echue = estEchue(p);
              return (
                <tr key={p.id} className={`hover:bg-gray-50 transition ${echue ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2.5 text-gray-700 font-medium">{p.commune}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs font-mono">{p.codeInsee}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">{LIBELLE_PROFESSION[p.profession] ?? p.profession}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-semibold text-kine-600">
                      {p.niveau} <span className="text-gray-400 font-normal">(+{p.niveau * FACTEUR} pts)</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 text-xs">{p.institution}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{jour(p.declareLe)}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {p.expireLe ? (
                      <span className={echue ? "text-red-500 font-semibold" : "text-gray-500"}>
                        {jour(p.expireLe)}{echue ? " — échue" : ""}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">{p.saisiPar?.email ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => supprimer(p.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
