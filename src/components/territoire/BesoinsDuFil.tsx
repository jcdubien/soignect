"use client";

import { useEffect, useState } from "react";

// Besoins du territoire au-dessus du fil (24/10) — pour les soignants de la profession concernée.
// Hors du classement des annonces. « Je suis intéressé·e » demande d'abord le consentement à la
// transmission du nom (la structure n'a pas de messagerie Soignect), puis prévient ses éditeurs.

interface BesoinFil {
  id: string; commune: string; specialite: string | null; nature: string; texte: string;
  proposition: string | null; etiquetteProposition: string; etiquette: string; consentement: string;
  interesse: boolean;
}

const MASQUE_JOURS = 30;
const CLE = "besoins-masques";

function masques(): Record<string, number> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? "{}") as Record<string, number>;
    const limite = Date.now() - MASQUE_JOURS * 86_400_000;
    return Object.fromEntries(Object.entries(brut).filter(([, t]) => t > limite));
  } catch { return {}; }
}

export default function BesoinsDuFil() {
  const [besoins, setBesoins] = useState<BesoinFil[]>([]);
  const [caches, setCaches] = useState<Record<string, number>>({});
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [etat, setEtat] = useState<Record<string, string>>({});

  useEffect(() => {
    setCaches(masques());
    fetch("/api/besoins/fil").then((r) => (r.ok ? r.json() : null)).then((d) => setBesoins(d?.besoins ?? [])).catch(() => {});
  }, []);

  const visibles = besoins.filter((b) => !caches[b.id]);
  if (visibles.length === 0) return null;

  function masquer(id: string) {
    const v = { ...caches, [id]: Date.now() };
    setCaches(v);
    try { localStorage.setItem(CLE, JSON.stringify(v)); } catch { /* navigation privée */ }
  }

  async function interet(b: BesoinFil, exprimer: boolean) {
    const r = await fetch(`/api/besoins/${b.id}/interet`, {
      method: exprimer ? "POST" : "DELETE", headers: { "Content-Type": "application/json" },
      body: exprimer ? JSON.stringify({ consentement: true }) : undefined,
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) { setEtat((e) => ({ ...e, [b.id]: d?.error ?? "Action impossible." })); return; }
    setBesoins((l) => l.map((x) => (x.id === b.id ? { ...x, interesse: exprimer } : x)));
    setConfirmation(null);
    setEtat((e) => ({ ...e, [b.id]: exprimer ? "Votre intérêt a été transmis. La structure ou Soignect reviendra vers vous." : "Votre intérêt a été retiré." }));
  }

  return (
    <div className="mx-4 mt-2 space-y-2 shrink-0">
      {visibles.map((b) => (
        <section key={b.id} aria-label={b.etiquette} className="rounded-2xl border border-[#0B3D5C]/20 bg-[#0B3D5C]/5 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#0B3D5C] m-0">{b.etiquette}</p>
          <button type="button" onClick={() => setOuvert(ouvert === b.id ? null : b.id)} aria-expanded={ouvert === b.id}
            className="mt-0.5 w-full text-left text-sm font-semibold text-gray-900">
            {b.specialite ? `${b.specialite} · ` : ""}{b.commune} — {b.nature}
            <span className="ml-1 text-xs font-normal text-[#0B3D5C] underline">{ouvert === b.id ? "Réduire" : "Lire"}</span>
          </button>
          {ouvert === b.id && (
            <div className="mt-1">
              <p className="text-sm text-gray-700 whitespace-pre-line m-0">{b.texte}</p>
              {b.proposition && <p className="text-sm text-gray-700 mt-1 mb-0"><span className="text-xs font-semibold text-gray-500">{b.etiquetteProposition} :</span> {b.proposition}</p>}
              {confirmation === b.id ? (
                <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-700 m-0">{b.consentement}</p>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <button type="button" onClick={() => { void interet(b, true); }} className="rounded-lg bg-[#0B3D5C] px-3 py-1.5 text-xs font-bold text-white">Transmettre mon nom</button>
                    <button type="button" onClick={() => setConfirmation(null)} className="text-xs text-gray-600 underline">Annuler</button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-3 flex-wrap items-center">
                  {b.interesse ? (
                    <>
                      <span className="text-xs font-semibold text-emerald-700">Intérêt transmis</span>
                      <button type="button" onClick={() => { void interet(b, false); }} className="text-xs text-gray-600 underline">Retirer mon intérêt</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmation(b.id)} className="rounded-lg border border-[#0B3D5C] px-3 py-1.5 text-xs font-bold text-[#0B3D5C]">Je suis intéressé·e</button>
                  )}
                  <button type="button" onClick={() => masquer(b.id)} className="text-xs text-gray-500 underline">Masquer</button>
                </div>
              )}
              {etat[b.id] && <p role="status" className="mt-2 text-xs text-gray-700 m-0">{etat[b.id]}</p>}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
