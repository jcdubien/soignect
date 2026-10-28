"use client";

import { MissionData, toDate } from "./modele";

/** Nomme le problème ET les deux issues. Un avertissement qui ne dit pas quoi faire laisse son
 *  lecteur exactement où il était — c'est ce que faisaient les briques marquées d'un ⚠️ seul. */
export function EncartPeriodeEcoulee() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-800">
      ⚠️ <strong>Période écoulée.</strong> Cette annonce n&apos;est plus visible par les candidats.
      Modifiez ses dates pour la proposer à nouveau, ou dépubliez-la.
    </div>
  );
}

/** Même forme que l'encart « période écoulée » : le fait, puis les deux issues. */
export function EncartPosteDejaTenu({ occupant }: { occupant: MissionData }) {
  const fin = toDate(occupant.departureDate) ?? toDate(occupant.endDate);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-800">
      ⚠️ <strong>Poste déjà tenu.</strong> {occupant.matchedName || occupant.title} occupe ce poste
      {fin ? ` jusqu'au ${fin.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}` : " sans terme connu"},
      et cette annonce reste proposée aux candidats sur la même période. Décalez ses dates après
      cette occupation, ou dépubliez-la.
    </div>
  );
}
