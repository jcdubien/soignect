"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Zone = { zone: string; communes: { libelle: string; code: string }[] };
type Demande = {
  id: string; statut: "NOUVELLE" | "CONVERTIE" | "CLASSEE"; type: string; typeLibelle: string;
  structure: string; nomPropose: string; contactNom: string; fonction: string | null; email: string;
  telephone: string | null; communes: string[]; communesLibelles: string[]; professions: string[];
  message: string | null; source: string | null; createdAt: string; communesMax: number | null;
  client: string | null;
  territoire: string; ile: string;
};

const NATURES = [
  { valeur: "POC_GRATUIT", libelle: "Essai gratuit (PoC)" },
  { valeur: "GRATUITE_NEGOCIEE", libelle: "Gratuité négociée" },
  { valeur: "CLIENT_PAYANT", libelle: "Client payant" },
];

export default function PartenariatsClient({ demandes, zonesParIle }: { demandes: Demande[]; zonesParIle: Record<string, Zone[]> }) {
  const nouvelles = demandes.filter((d) => d.statut === "NOUVELLE");
  const traitees = demandes.filter((d) => d.statut !== "NOUVELLE");
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Demandes de partenariat</h1>
        <p className="text-sm text-gray-500 mt-1">
          Formulaire public <code>/partenaire</code>. Convertir crée le client, sa page en démonstration
          (aucun effet sur le fil, nom non publié) et rattache le contact comme éditeur. Aucun email n&apos;est envoyé :
          le lien d&apos;activation s&apos;affiche ici, à transmettre vous-même.
        </p>
      </div>
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-gray-700">À traiter ({nouvelles.length})</h2>
        {nouvelles.length === 0 && <p className="text-sm text-gray-400">Aucune demande en attente.</p>}
        {nouvelles.map((d) => <CarteDemande key={d.id} d={d} zones={zonesParIle[d.territoire] ?? []} />)}
      </section>
      {traitees.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-gray-700">Traitées ({traitees.length})</h2>
          {traitees.map((d) => (
            <div key={d.id} className="text-sm text-gray-600 bg-white border border-gray-100 rounded-xl px-4 py-2">
              {new Date(d.createdAt).toLocaleDateString("fr-FR")} · {d.typeLibelle} · <strong>{d.structure}</strong> —{" "}
              {d.statut === "CONVERTIE" ? <>convertie{d.client ? <> en « {d.client} » (<Link href="/admin/pages" className="underline">Pages clients</Link>)</> : null}</> : "classée"}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function CarteDemande({ d, zones }: { d: Demande; zones: Zone[] }) {
  const router = useRouter();
  const [nom, setNom] = useState(d.nomPropose);
  const [nature, setNature] = useState("POC_GRATUIT");
  const [communes, setCommunes] = useState<string[]>(d.communes);
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [activation, setActivation] = useState<string | null | undefined>(undefined);

  async function agir(action: "convertir" | "classer") {
    setEnvoi(true); setErreur(null);
    const r = await fetch("/api/admin/partenariats", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "convertir" ? { action, id: d.id, nom, nature, communes } : { action, id: d.id }),
    });
    const j = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (!r.ok) { setErreur(typeof j.error === "string" ? j.error : "Échec."); return; }
    if (action === "convertir") setActivation(j.activation ?? null);
    else router.refresh();
  }

  if (activation !== undefined) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-2">
        <p><strong>{nom}</strong> créé, page en démonstration. Réglages dans <Link href="/admin/pages" className="underline">Pages clients</Link>.</p>
        {activation
          ? <p>Lien d&apos;activation de {d.email}, valable 7 jours, affiché une seule fois — à transmettre vous-même :<br /><code className="break-all text-xs">{activation}</code></p>
          : <p>{d.email} avait déjà un compte : rattaché comme éditeur, sans modification du compte.</p>}
        <button type="button" onClick={() => router.refresh()} className="text-xs underline">Fermer</button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold text-gray-900">{d.typeLibelle} · {d.structure} · {d.ile}</p>
        <p className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleString("fr-FR")}{d.source ? ` · depuis ${d.source}` : ""}</p>
      </div>
      <p className="text-sm text-gray-700">
        {d.contactNom}{d.fonction ? `, ${d.fonction}` : ""} · <a href={`mailto:${d.email}`} className="underline">{d.email}</a>
        {d.telephone ? <> · {d.telephone}</> : null}
      </p>
      {d.professions.length > 0 && <p className="text-xs text-gray-500">Professions : {d.professions.join(", ")}</p>}
      {d.communesLibelles.length > 0 && <p className="text-xs text-gray-500">Communes : {d.communesLibelles.join(", ")}</p>}
      {d.message && <p className="text-sm text-gray-600 whitespace-pre-line bg-gray-50 rounded-xl p-3">{d.message}</p>}

      {ouvert ? (
        <div className="border-t border-gray-100 pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-600">Nom du client
              <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={160} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
            </label>
            <label className="text-xs text-gray-600">Nature de la relation
              <select value={nature} onChange={(e) => setNature(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
                {NATURES.map((n) => <option key={n.valeur} value={n.valeur}>{n.libelle}</option>)}
              </select>
            </label>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">
              Périmètre de la page ({communes.length}{d.communesMax !== null ? ` / ${d.communesMax} au plus` : ""}) — au moins une commune
            </p>
            <div className="max-h-56 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-2">
              {zones.map((z) => (
                <div key={z.zone}>
                  <p className="text-[11px] font-semibold text-gray-500">{z.zone}</p>
                  <div className="flex flex-wrap gap-1">
                    {z.communes.map((c) => (
                      <label key={c.code} className={`px-2 py-0.5 rounded-full border text-[11px] cursor-pointer ${communes.includes(c.code) ? "border-kine-500 bg-kine-50 text-kine-800" : "border-gray-200 text-gray-600"}`}>
                        <input type="checkbox" className="sr-only" checked={communes.includes(c.code)}
                          onChange={() => setCommunes(communes.includes(c.code) ? communes.filter((x) => x !== c.code) : [...communes, c.code])} />
                        {c.libelle}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={envoi || communes.length === 0 || nom.trim().length < 2} onClick={() => agir("convertir")}
              className="px-4 py-2 bg-kine-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
              {envoi ? "…" : "Créer le client, la page démo et l'éditeur"}
            </button>
            <button type="button" onClick={() => setOuvert(false)} className="px-4 py-2 text-sm text-gray-500">Annuler</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOuvert(true)} className="px-4 py-2 bg-kine-600 text-white rounded-xl text-sm font-bold">Convertir…</button>
          <button type="button" disabled={envoi} onClick={() => agir("classer")} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm">Classer sans suite</button>
        </div>
      )}
      {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
