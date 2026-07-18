"use client";

import { useState } from "react";
import BottomSheet from "@/components/ui/md3/BottomSheet";
import ActiveAnnoncesList, { type ActiveMission } from "./ActiveAnnoncesList";

// Point d'entrée MOBILE vers les annonces actives (section 141). Le résumé contextuel du
// header (et donc le compteur cliquable desktop ActiveAnnoncesMenu) est masqué sous `sm` ;
// ce bouton `sm:hidden` ouvre un bottom sheet listant les mêmes annonces (liste partagée
// ActiveAnnoncesList → même édition /missions/create?editId=<id>). Masqué s'il n'y en a aucune.
export default function ActiveAnnoncesMobile({ missions }: { missions: ActiveMission[] }) {
  const [open, setOpen] = useState(false);
  const count = missions.length;
  if (count === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Voir mes ${count} annonces actives`}
        className="sm:hidden shrink-0 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg font-semibold hover:bg-gray-50 transition"
      >
        <span>📢</span>
        <span className="font-bold">{count}</span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} zClass="z-[70]">
        <div className="pb-3 overflow-y-auto">
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <p className="text-sm font-black text-gray-900">Annonces actives</p>
            <span className="text-xs font-semibold text-gray-400">{count}</span>
          </div>
          <ActiveAnnoncesList missions={missions} onItemClick={() => setOpen(false)} />
          <button
            onClick={() => setOpen(false)}
            className="w-full mt-3 py-2.5 border-t border-gray-100 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            Fermer
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
