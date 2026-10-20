"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Client {
  id: string; nom: string; type: string; nature: string; active: boolean; revueLe: string;
  max: number | null; priorites: number;
  page: { communes: string[]; lienPublic: string; lienEdition: string } | null;
}

export default function PagesClient({ clients, zones }: {
  clients: Client[];
  zones: { zone: string; communes: { libelle: string; code: string }[] }[];
}) {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold m-0">Pages clients</h1>
        <p className="text-sm text-gray-500 mt-1 mb-0">
          Une page par client, servie par un lien à diffuser — sans intégration sur son site. Le
          périmètre suit l&apos;offre souscrite ; le client règle message, contact, professions et
          priorités ajoutées depuis son lien d&apos;édition. Les clients se créent dans{" "}
          <a href="/admin/priorites" className="underline">Priorités territoriales</a>.
        </p>
      </div>
      {clients.map((c) => <CarteClient key={c.id} client={c} zones={zones} />)}
    </div>
  );
}

function CarteClient({ client, zones }: { client: Client; zones: { zone: string; communes: { libelle: string; code: string }[] }[] }) {
  const router = useRouter();
  const [communes, setCommunes] = useState<string[]>(client.page?.communes ?? []);
  const [etat, setEtat] = useState<string | null>(null);

  async function poster(body: object, ok: (r: { bilan?: Record<string, number> }) => string) {
    setEtat(null);
    const res = await fetch("/api/admin/pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, ...body }),
    });
    const r = await res.json().catch(() => ({}));
    if (res.ok) { setEtat(ok(r)); router.refresh(); } else setEtat(r.error ?? "Action impossible.");
  }
  const bilan = (r: { bilan?: Record<string, number> }) =>
    r.bilan ? `Priorités APL : ${r.bilan.creees} créées, ${r.bilan.modifiees} modifiées, ${r.bilan.retirees} retirées${r.bilan.ignorees ? `, ${r.bilan.ignorees} déjà tenues par une autre déclaration` : ""}.` : "Fait.";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="font-bold m-0">{client.nom}</p>
        <p className="text-xs text-gray-500 m-0">
          {client.type} · {client.nature} · {client.active ? `actif jusqu'au ${new Date(client.revueLe).toLocaleDateString("fr-FR", { timeZone: "UTC" })}` : "inactif"} · {client.priorites} priorité{client.priorites > 1 ? "s" : ""}
        </p>
      </div>

      {client.page && (
        <div className="text-xs space-y-1">
          {([["Lien public", client.page.lienPublic, "public"], ["Lien d'édition (au client seul)", client.page.lienEdition, "edition"]] as const).map(([titre, lien, quel]) => (
            <div key={quel} className="flex gap-2 items-center flex-wrap">
              <span className="text-gray-500 w-48 shrink-0">{titre}</span>
              <a href={lien} target="_blank" rel="noopener noreferrer" className="underline break-all flex-1 min-w-0">{lien}</a>
              <button onClick={() => poster({ action: "jeton", quel }, () => "Nouveau lien créé ; l'ancien ne répond plus.")} className="text-red-600 underline">
                Régénérer
              </button>
            </div>
          ))}
        </div>
      )}

      <details>
        <summary className="text-sm font-semibold cursor-pointer">
          Périmètre — {communes.length} commune{communes.length > 1 ? "s" : ""}{client.max !== null ? ` (offre : ${client.max} au plus)` : ""}
        </summary>
        <div className="mt-2 space-y-2">
          {zones.map((z) => (
            <div key={z.zone}>
              <p className="text-xs font-semibold text-gray-500 m-0">{z.zone}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                {z.communes.map((c) => (
                  <label key={c.code + c.libelle} className="text-xs flex items-center gap-1">
                    <input type="checkbox" checked={communes.includes(c.code)}
                      onChange={(e) => setCommunes(e.target.checked ? [...communes, c.code] : communes.filter((x) => x !== c.code))} />
                    {c.libelle}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <div className="flex gap-2 flex-wrap">
        <button disabled={communes.length === 0}
          onClick={() => poster({ action: "perimetre", communes }, bilan)}
          className="px-3 py-2 rounded-lg bg-[#0B3D5C] text-white text-xs font-bold disabled:opacity-40">
          {client.page ? "Enregistrer le périmètre" : "Ouvrir la page"}
        </button>
        {client.page && (
          <button onClick={() => poster({ action: "apl" }, bilan)}
            className="px-3 py-2 rounded-lg border border-[#0B3D5C] text-[#0B3D5C] text-xs font-bold">
            Recalculer depuis l&apos;APL
          </button>
        )}
      </div>
      {etat && <p className="text-xs text-gray-700 m-0">{etat}</p>}
    </div>
  );
}
