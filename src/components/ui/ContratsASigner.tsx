"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LigneContrat } from "@/lib/mesContrats";

// Contrats qui attendent MA signature (09/11). La notification « à votre tour » part une fois, au
// moment où l'autre signe ; elle se perd dans la cloche, et un contrat signé d'un seul côté ne
// conclut rien — les dates ne sont pas réservées. Le bandeau reste tant que je n'ai pas signé :
// il dit qui a signé et quand, et mène au contrat. Absent sur la page du contrat elle-même.
//
// Ton : un constat, pas une injonction (« vous ne l'avez pas encore signé »).

const fmtJour = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "America/Guadeloupe" });

export default function ContratsASigner({ contrats }: { contrats: LigneContrat[] }) {
  // Le layout ne se recalcule pas d'une page à l'autre : le masquage se décide ici, au chemin courant.
  const chemin = usePathname() ?? "";
  if (contrats.length === 0 || /^\/match\/[^/]+\/contrat/.test(chemin)) return null;
  return (
    <div className="flex-shrink-0 bg-kine-50 border-b border-kine-100 px-4 py-2 flex flex-col gap-1.5">
      {contrats.slice(0, 3).map((c) => (
        <div key={c.matchId} className="flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-kine-900 min-w-0">
            ✍️ Contrat signé le <strong>{fmtJour(c.derniereSignature)}</strong> par <strong>{c.avec}</strong>
            <span className="text-kine-700"> ({c.typePoste}{c.periode ? `, ${c.periode}` : ""})</span>
            {" "}— vous ne l&apos;avez pas encore signé.
          </p>
          <Link
            href={`/match/${c.matchId}/contrat`}
            className="shrink-0 px-3 py-1.5 bg-kine-600 text-white rounded-lg text-xs font-bold hover:bg-kine-700 transition"
          >
            Relire et signer
          </Link>
        </div>
      ))}
      {contrats.length > 3 && (
        <Link href="/contrats" className="text-xs font-semibold text-kine-700 underline self-start">
          {contrats.length - 3} autre{contrats.length - 3 > 1 ? "s" : ""} contrat{contrats.length - 3 > 1 ? "s" : ""} à signer
        </Link>
      )}
    </div>
  );
}
