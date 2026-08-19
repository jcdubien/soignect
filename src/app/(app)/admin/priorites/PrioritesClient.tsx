"use client";

import { useState } from "react";

const PROFESSIONS = [
  { value: "KINESITHERAPEUTE", label: "Kinésithérapeute" },
  { value: "INFIRMIER", label: "Infirmier" },
  { value: "MEDECIN", label: "Médecin" },
  { value: "SAGE_FEMME", label: "Sage-femme" },
  { value: "ORTHOPHONISTE", label: "Orthophoniste" },
] as const;

const TYPES = ["CPTS", "MSP", "ARS", "CGSS", "COLLECTIVITE", "AUTRE"] as const;

const NATURES = [
  { value: "POC_GRATUIT", label: "PoC gratuit" },
  { value: "CLIENT_PAYANT", label: "Client payant" },
  { value: "GRATUITE_NEGOCIEE", label: "Gratuité négociée" },
] as const;

const LIBELLE_PROFESSION: Record<string, string> = Object.fromEntries(PROFESSIONS.map((p) => [p.value, p.label]));
const LIBELLE_NATURE: Record<string, string> = Object.fromEntries(NATURES.map((n) => [n.value, n.label]));

const FACTEUR = 3; // FACTEUR_PRIORITE_TERRITORIALE — voir src/lib/territoire.ts

interface Client {
  id: string;
  nom: string;
  type: string;
  nature: string;
  debutLe: string;
  revueLe: string;
  clotureLe: string | null;
  note: string | null;
  _count?: { priorites: number };
}

interface Priorite {
  id: string;
  codeInsee: string;
  commune: string;
  profession: string;
  niveau: number;
  declareLe: string;
  note: string | null;
  expireLe: string | null;
  saisiPar: { email: string } | null;
  client: { nom: string; nature: string; revueLe: string; clotureLe: string | null } | null;
}

const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : null);

// Une relation est active si personne ne l'a close ET si son échéance de revue n'est pas passée.
// Même règle que le SQL du feed (src/lib/territoire.ts) — si les deux divergent un jour, c'est
// l'écran qui mentira, pas le feed.
const clientActif = (c: { revueLe: string; clotureLe: string | null }) =>
  c.clotureLe === null && new Date(c.revueLe) > new Date();

const prioriteAgit = (p: Priorite) =>
  p.client !== null &&
  clientActif(p.client) &&
  (p.expireLe === null || new Date(p.expireLe) > new Date());

export default function PrioritesClient({
  initialData,
  initialClients,
  communes,
}: {
  initialData: Priorite[];
  initialClients: Client[];
  communes: string[];
}) {
  const [data, setData] = useState<Priorite[]>(initialData);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [ouvert, setOuvert] = useState<"aucun" | "client" | "priorite">("aucun");

  const actifs = clients.filter(clientActif);

  const dansSixMois = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  };

  const [formClient, setFormClient] = useState({
    nom: "",
    type: "CPTS",
    nature: "POC_GRATUIT",
    debutLe: new Date().toISOString().slice(0, 10),
    revueLe: dansSixMois(),
    note: "",
  });

  const [form, setForm] = useState({
    commune: "",
    profession: "KINESITHERAPEUTE",
    niveau: 2,
    clientId: "",
    declareLe: new Date().toISOString().slice(0, 10),
    note: "",
    expireLe: "",
  });

  async function creerClient(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const r = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formClient, note: formClient.note || undefined }),
    });
    const json = await r.json();
    if (r.ok) {
      setClients((prev) => [...prev, json]);
      setFormClient({ ...formClient, nom: "", note: "" });
      setOuvert("aucun");
    } else {
      setErreur(typeof json.error === "string" ? json.error : "Relation refusée.");
    }
    setEnvoi(false);
  }

  async function reconduire(c: Client) {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    const r = await fetch(`/api/admin/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revueLe: d.toISOString().slice(0, 10), clotureLe: null }),
    });
    if (r.ok) setClients((prev) => prev.map((x) => (x.id === c.id ? { ...x, revueLe: d.toISOString(), clotureLe: null } : x)));
  }

  async function clore(c: Client) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const r = await fetch(`/api/admin/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clotureLe: aujourdhui }),
    });
    if (r.ok) setClients((prev) => prev.map((x) => (x.id === c.id ? { ...x, clotureLe: aujourdhui } : x)));
  }

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
      setOuvert("aucun");
    } else {
      setErreur(typeof json.error === "string" ? json.error : "Déclaration refusée.");
    }
    setEnvoi(false);
  }

  async function supprimer(id: string) {
    const r = await fetch(`/api/admin/priorites/${id}`, { method: "DELETE" });
    if (r.ok) setData((prev) => prev.filter((p) => p.id !== id));
  }

  const champ = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800";

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Priorités territoriales</h1>

      {/* Ce bandeau n'est pas décoratif. L'écran /admin/apl a passé des mois à inviter à régler
          un curseur qui n'agissait sur rien, pendant que le feed affirmait le contraire à
          l'utilisateur. Dire ici ce que la saisie fait, et à quelle condition, est le minimum. */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900 leading-relaxed">
        Une déclaration remonte les <strong>postes</strong> de sa commune dans le feed des
        candidats de la profession concernée — jamais l&apos;inverse, et jamais dans le score de
        compatibilité. Elle n&apos;agit que si <strong>la relation institutionnelle qui la porte
        est active</strong> : le levier territorial est un service, il ne se distribue pas parce
        qu&apos;une valeur existe en base. Passée sa date de revue, une relation s&apos;éteint
        jusqu&apos;à ce qu&apos;un administrateur la reconduise.
      </div>

      {/* ── Relations institutionnelles ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-base font-semibold text-gray-700">
            Relations institutionnelles{" "}
            <span className="text-sm font-normal text-gray-400">({actifs.length} active{actifs.length > 1 ? "s" : ""})</span>
          </h2>
          <button
            onClick={() => setOuvert(ouvert === "client" ? "aucun" : "client")}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
          >
            {ouvert === "client" ? "Annuler" : "Ouvrir une relation"}
          </button>
        </div>

        {ouvert === "client" && (
          <form onSubmit={creerClient} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-gray-500 space-y-1 block">
                Institution
                <input required minLength={2} maxLength={160} placeholder="CPTS Nord Basse-Terre"
                  value={formClient.nom} onChange={(e) => setFormClient({ ...formClient, nom: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500 space-y-1 block">
                Type
                <select value={formClient.type} onChange={(e) => setFormClient({ ...formClient, type: e.target.value })} className={champ}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 space-y-1 block">
                Nature de la relation
                <select value={formClient.nature} onChange={(e) => setFormClient({ ...formClient, nature: e.target.value })} className={champ}>
                  {NATURES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 space-y-1 block">
                Début de la relation
                <input required type="date" value={formClient.debutLe}
                  onChange={(e) => setFormClient({ ...formClient, debutLe: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500 space-y-1 block sm:col-span-2">
                À revoir le — <strong>date de revue, pas preuve que la fonction est toujours exercée</strong>.
                Passée cette date le levier s&apos;éteint tant que personne ne reconduit. 6 à 12 mois.
                <input required type="date" value={formClient.revueLe}
                  onChange={(e) => setFormClient({ ...formClient, revueLe: e.target.value })} className={champ} />
              </label>
            </div>
            <label className="text-xs text-gray-500 space-y-1 block">
              Contexte (facultatif, 500 car.)
              <textarea rows={2} maxLength={500} placeholder="Gratuité accordée tant que J-C est secrétaire de la CPTS."
                value={formClient.note} onChange={(e) => setFormClient({ ...formClient, note: e.target.value })} className={champ} />
            </label>
            {erreur && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erreur}</p>}
            <button type="submit" disabled={envoi} className="text-sm px-4 py-2 rounded-lg bg-kine-600 text-white font-semibold disabled:opacity-50">
              {envoi ? "Enregistrement…" : "Ouvrir la relation"}
            </button>
          </form>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Institution</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Type</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Nature</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Depuis</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">À revoir le</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Déclarations</th>
                <th className="px-3 py-3 text-right text-gray-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-xs leading-relaxed">
                  Aucune relation institutionnelle.<br />
                  Tant qu&apos;il n&apos;y en a pas, aucune déclaration ne peut agir — c&apos;est
                  le gating, pas un blocage.
                </td></tr>
              )}
              {clients.map((c) => {
                const actif = clientActif(c);
                return (
                  <tr key={c.id} className={`hover:bg-gray-50 transition ${actif ? "" : "opacity-60"}`}>
                    <td className="px-3 py-2.5 text-gray-700 font-medium">{c.nom}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{c.type}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{LIBELLE_NATURE[c.nature] ?? c.nature}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{jour(c.debutLe)}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {c.clotureLe ? (
                        <span className="text-gray-500">close le {jour(c.clotureLe)}</span>
                      ) : actif ? (
                        <span className="text-gray-600">{jour(c.revueLe)}</span>
                      ) : (
                        <span className="text-red-600 font-semibold">{jour(c.revueLe)} — à revoir, levier éteint</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{c._count?.priorites ?? 0}</td>
                    <td className="px-3 py-2.5 text-right space-x-1.5">
                      <button onClick={() => reconduire(c)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                        Reconduire 6 mois
                      </button>
                      {!c.clotureLe && (
                        <button onClick={() => clore(c)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition">
                          Clore
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Déclarations ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-base font-semibold text-gray-700">
            Priorités déclarées{" "}
            <span className="text-sm font-normal text-gray-400">
              ({data.filter(prioriteAgit).length} agissante{data.filter(prioriteAgit).length > 1 ? "s" : ""} sur {data.length})
            </span>
          </h2>
          <button
            onClick={() => setOuvert(ouvert === "priorite" ? "aucun" : "priorite")}
            disabled={actifs.length === 0}
            title={actifs.length === 0 ? "Ouvrir d'abord une relation institutionnelle" : undefined}
            className="text-sm px-3 py-2 rounded-lg bg-kine-600 text-white font-semibold hover:bg-kine-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ouvert === "priorite" ? "Annuler" : "Déclarer une priorité"}
          </button>
        </div>

        {ouvert === "priorite" && (
          <form onSubmit={declarer} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-gray-500 space-y-1 block">
                Déclarée par — relations actives uniquement
                <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={champ}>
                  <option value="">— choisir —</option>
                  {actifs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 space-y-1 block">
                Commune
                <select required value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} className={champ}>
                  <option value="">— choisir —</option>
                  {communes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 space-y-1 block">
                Profession concernée
                <select value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} className={champ}>
                  {PROFESSIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 space-y-1 block">
                Déclarée le
                <input required type="date" value={form.declareLe} onChange={(e) => setForm({ ...form, declareLe: e.target.value })} className={champ} />
              </label>
              <label className="text-xs text-gray-500 space-y-1 block">
                Intensité (1 à 10) — pèse {form.niveau * FACTEUR} points d&apos;ordre
                <input required type="number" min={1} max={10} value={form.niveau}
                  onChange={(e) => setForm({ ...form, niveau: Number(e.target.value) })} className={champ} />
              </label>
              <label className="text-xs text-gray-500 space-y-1 block">
                Échéance de la déclaration (facultatif)
                <input type="date" value={form.expireLe} onChange={(e) => setForm({ ...form, expireLe: e.target.value })} className={champ} />
              </label>
            </div>
            <label className="text-xs text-gray-500 space-y-1 block">
              Contexte de l&apos;échange (facultatif, 500 car.)
              <textarea rows={2} maxLength={500} placeholder="Appel du 19/08 — manque signalé sur les remplacements d'été."
                value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={champ} />
            </label>
            {erreur && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erreur}</p>}
            <button type="submit" disabled={envoi} className="text-sm px-4 py-2 rounded-lg bg-kine-600 text-white font-semibold disabled:opacity-50">
              {envoi ? "Enregistrement…" : "Enregistrer la déclaration"}
            </button>
          </form>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Commune</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">INSEE</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Profession</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Niveau</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Déclarée par</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Le</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Agit ?</th>
                <th className="px-3 py-3 text-left text-gray-500 font-medium">Co-saisie par</th>
                <th className="px-3 py-3 text-right text-gray-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-xs leading-relaxed">
                  Aucune priorité déclarée.<br />
                  Le levier territorial est donc sans effet sur le feed — c&apos;est l&apos;état
                  correct tant qu&apos;aucune institution n&apos;a rien dit.
                </td></tr>
              )}
              {data.map((p) => {
                const agit = prioriteAgit(p);
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 transition ${agit ? "" : "opacity-60"}`}>
                    <td className="px-3 py-2.5 text-gray-700 font-medium">{p.commune}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs font-mono">{p.codeInsee}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{LIBELLE_PROFESSION[p.profession] ?? p.profession}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold text-kine-600">
                        {p.niveau} <span className="text-gray-400 font-normal">(+{p.niveau * FACTEUR} pts)</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs">{p.client?.nom ?? "—"}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{jour(p.declareLe)}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {agit ? (
                        <span className="text-kine-600 font-semibold">oui</span>
                      ) : (
                        <span className="text-red-500 font-semibold">
                          non — {p.client && !clientActif(p.client) ? "relation à revoir" : "déclaration échue"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{p.saisiPar?.email ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => supprimer(p.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition">
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
