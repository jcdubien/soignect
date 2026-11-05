"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { conseilsPour, publicDe } from "@/lib/conseils";

// Conseil du jour (04/11) — une fois par jour, sur l'écran principal seulement : ailleurs (une
// signature ouverte depuis un email, une conversation), il interromprait un geste en cours.
// Mémoire par navigateur (localStorage) : le jour du dernier affichage, le dernier conseil montré
// (on avance dans la liste, pour ne pas revoir le même), et « ne plus afficher ». Sans stockage
// disponible, rien ne s'affiche — mieux vaut aucun conseil qu'un conseil à chaque page.

interface Memoire { jour: string; dernier: number; coupe: boolean }

const CLE = (profileId: string) => `soignect.conseil.${profileId}`;
const aujourdhui = () => new Date().toLocaleDateString("fr-CA"); // AAAA-MM-JJ, heure locale

function lire(profileId: string): Memoire | null {
  try {
    const brut = localStorage.getItem(CLE(profileId));
    return brut ? (JSON.parse(brut) as Memoire) : { jour: "", dernier: -1, coupe: false };
  } catch { return null; }
}
function ecrire(profileId: string, m: Memoire) {
  try { localStorage.setItem(CLE(profileId), JSON.stringify(m)); } catch { /* sans stockage : rien */ }
}

export default function ConseilDuJour({ profileId, type, titulaireKind }: { profileId: string; type?: string | null; titulaireKind?: string | null }) {
  const pathname = usePathname();
  const conseils = conseilsPour(publicDe({ type, titulaireKind }));
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (pathname !== "/annonces" || conseils.length === 0) return;
    const m = lire(profileId);
    if (!m || m.coupe || m.jour === aujourdhui()) return;
    const suivant = (m.dernier + 1) % conseils.length;
    // Un temps pour que le fil apparaisse d'abord : le conseil vient après, pas à sa place. Le jour
    // n'est noté qu'à l'AFFICHAGE : noté avant, un départ de la page (ou le double passage de
    // l'effet en développement) consommait le conseil du jour sans qu'il ait été vu.
    const t = setTimeout(() => {
      ecrire(profileId, { ...m, jour: aujourdhui(), dernier: suivant });
      setIndex(suivant);
    }, 1200);
    return () => clearTimeout(t);
  }, [pathname, profileId, conseils.length]);

  useEffect(() => {
    if (index === null) return;
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setIndex(null); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [index]);

  if (index === null) return null;
  const c = conseils[index];

  const suivant = () => {
    const n = (index + 1) % conseils.length;
    const m = lire(profileId);
    if (m) ecrire(profileId, { ...m, dernier: n });
    setIndex(n);
  };
  const couper = () => {
    const m = lire(profileId);
    if (m) ecrire(profileId, { ...m, coupe: true });
    setIndex(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-4 pb-20 sm:pb-0" onClick={() => setIndex(null)}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="conseil-titre"
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="conseil-titre" className="text-[11px] font-bold uppercase tracking-widest text-kine-700 m-0">💡 Conseil du jour</p>
        <p className="text-[15px] text-gray-800 leading-relaxed mt-2 mb-0">{c.texte}</p>
        {c.lien && (
          <Link href={c.lien.href} onClick={() => setIndex(null)} className="inline-block mt-3 text-sm font-semibold text-kine-700 hover:underline">
            {c.lien.libelle} →
          </Link>
        )}
        <div className="flex flex-wrap-reverse items-center justify-between gap-3 mt-5">
          <button type="button" onClick={couper} className="text-xs text-gray-400 hover:text-gray-600">
            Ne plus afficher
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={suivant} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
              Conseil suivant
            </button>
            <button type="button" onClick={() => setIndex(null)} className="px-4 py-2 rounded-lg bg-[#0B3D5C] text-white text-sm font-semibold">
              Compris
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
