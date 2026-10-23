"use client";

import { useState } from "react";
import type { LignePack } from "@/lib/packWhatsapp";
import type { MotifWhatsapp } from "@/lib/whatsapp";

const TYPE_LABEL: Record<string, string> = { REMPLACANT: "Remplaçant", ASSISTANT: "Assistant", TITULAIRE: "Cabinet" };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function PackClient({ lignes, jours, libelles }: { lignes: LignePack[]; jours: number; libelles: Record<MotifWhatsapp, string> }) {
  const [ouverts, setOuverts] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const cle = (l: LignePack) => `${l.userId}:${l.motif}`;
  const reste = lignes.filter((l) => !l.ouvertLe && !ouverts[cle(l)]).length;

  async function ouvrir(l: LignePack) {
    setErreur(null);
    // La fenêtre est ouverte AVANT l'appel : un navigateur bloque une fenêtre ouverte après un
    // `await`, hors du geste de l'utilisateur.
    const fenetre = window.open("", "_blank");
    const r = await fetch("/api/admin/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: l.userId, motif: l.motif }),
    });
    const d = await r.json().catch(() => null);
    // Le serveur revérifie le consentement : il a pu changer depuis l'affichage de la page.
    if (!r.ok || !d?.lien) { fenetre?.close(); setErreur(d?.error ?? "Ouverture impossible."); return; }
    if (fenetre) { fenetre.opener = null; fenetre.location.href = d.lien; }
    setOuverts((o) => ({ ...o, [cle(l)]: new Date().toISOString() }));
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">Pack WhatsApp de la semaine</h1>
      <p className="mt-1 text-sm text-gray-500">
        Comptes qui ont accepté WhatsApp, sur les {jours} derniers jours : inscriptions récentes et activités non lues.
        Chaque bouton ouvre WhatsApp avec un message pré-rempli, modifiable ; c&apos;est vous qui l&apos;envoyez.
        Rien ne part seul.
      </p>
      <p className="mt-3 text-sm font-semibold text-gray-700">{reste} message{reste > 1 ? "s" : ""} à envoyer · {lignes.length} au total</p>
      {erreur && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{erreur}</p>}
      {lignes.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">Rien à envoyer cette semaine.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {lignes.map((l) => {
            const ouvertLe = ouverts[cle(l)] ?? l.ouvertLe;
            return (
              <li key={cle(l)} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{l.nom ?? "Sans nom"}</p>
                  <p className="text-xs text-gray-500">
                    {libelles[l.motif]}
                    {l.motif === "activite" && ` · ${l.nonLues} non lue${l.nonLues > 1 ? "s" : ""}`}
                    {l.type && ` · ${TYPE_LABEL[l.type] ?? l.type}`}
                  </p>
                </div>
                {ouvertLe ? (
                  <span className="shrink-0 text-xs text-gray-400">Ouvert le {fmt(ouvertLe)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => ouvrir(l)}
                    className="shrink-0 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Ouvrir WhatsApp
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
