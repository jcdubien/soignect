"use client";

import { useState } from "react";
import Button from "@/components/ui/md3/Button";
import BottomSheet from "@/components/ui/md3/BottomSheet";
import { ConfirmState, UncoveredChoiceState } from "./modele";

// ── Modale choix zone non couverte (section 37.A) ────────────────────────────

export function UncoveredChoiceModal({
  modal,
  isEmployeur,
  onCreateMission,
  onClosePost,
  onDeleteAbsence,
  onEditAbsenceDates,
  onClose,
}: {
  modal: UncoveredChoiceState;
  isEmployeur: boolean;
  onCreateMission: () => void;
  onClosePost: () => void;
  onDeleteAbsence: () => void;
  onEditAbsenceDates: (startDate: string, endDate: string) => void;
  onClose: () => void;
}) {
  const createLabel = isEmployeur ? "Oui, ouvrir un poste" : "Oui, créer une annonce";
  // Édition des dates d'une absence déjà déclarée : aucun écran ne le permettait — le menu
  // « modifier » (avec ses champs de date) n'est atteignable que depuis un POSTE, jamais depuis
  // la ligne titulaire. Une correction de dates semblait enregistrée sans jamais l'être.
  const [editing, setEditing] = useState(false);
  const [eStart, setEStart] = useState(modal.suggestedStart);
  const [eEnd, setEEnd] = useState(modal.suggestedEnd);
  const datesValid = !!eStart && !!eEnd && eEnd >= eStart;

  if (editing) {
    return (
      <BottomSheet open onClose={onClose} zClass="z-[60]">
        <div className="p-6 flex flex-col gap-3">
          <h3 className="font-bold text-gray-900 text-base">Modifier les dates de l&apos;absence</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Du</label>
              <input type="date" value={eStart} onChange={(e) => setEStart(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Au</label>
              <input type="date" value={eEnd} min={eStart || undefined} onChange={(e) => setEEnd(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400" />
            </div>
          </div>
          {!datesValid && (eStart || eEnd) && (
            <p className="text-xs text-amber-600">La date de fin doit être postérieure à la date de début.</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="text" onClick={() => setEditing(false)} className="flex-1 !py-2.5 !text-gray-500">Retour</Button>
            <Button onClick={() => onEditAbsenceDates(eStart, eEnd)} disabled={!datesValid} className="flex-1 !py-2.5">
              Enregistrer
            </Button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} zClass="z-[60]">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-xl">📅</span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base leading-tight">
              {isEmployeur ? "Voulez-vous ouvrir un poste pour cette période ?" : "Voulez-vous proposer une annonce pour cette période ?"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{modal.post.label}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-5 text-sm text-gray-600">
          <p className="text-xs text-gray-400 mb-1">Période suggérée</p>
          <p className="font-medium">
            {new Date(modal.suggestedStart).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
            {" → "}
            {new Date(modal.suggestedEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <Button onClick={onCreateMission} className="w-full">{createLabel} →</Button>
          <Button variant="outlined" onClick={onClosePost} className="w-full !py-2.5 !border-red-200 !text-red-600 hover:!bg-red-50">
            Non, fermer cette période
          </Button>
          {modal.absenceMissionId && (
            <>
              <Button variant="outlined" onClick={() => setEditing(true)} className="w-full !py-2.5 !border-[#1B3A5C]/30 !text-[#1B3A5C] hover:!bg-[#1B3A5C]/5">
                📅 Modifier les dates de cette absence
              </Button>
              <Button variant="outlined" onClick={onDeleteAbsence} className="w-full !py-2.5 !border-[#1B3A5C]/30 !text-[#1B3A5C] hover:!bg-[#1B3A5C]/5">
                ↩ Je serai finalement présent — supprimer cette absence
              </Button>
            </>
          )}
          <Button variant="text" onClick={onClose} className="w-full !py-2 !text-gray-400 hover:!bg-gray-50">Annuler</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Composant ConfirmModal ─────────────────────────────────────────────────────

export function ConfirmModal({ modal, onClose }: { modal: ConfirmState; onClose: () => void }) {
  return (
    <BottomSheet open onClose={onClose} zClass="z-[60]">
      <div className="p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-2">{modal.title}</h3>
        <p className="text-gray-600 text-sm mb-6">{modal.body}</p>
        <div className="flex gap-3">
          <Button variant="outlined" onClick={onClose} className="flex-1 !py-2.5">Annuler</Button>
          <Button onClick={modal.onConfirm} className="flex-1 !py-2.5 !bg-red-600 hover:!bg-red-700">Confirmer</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
