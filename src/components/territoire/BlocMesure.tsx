import { DELAI_LECTURE_MOIS, SEUIL_AGREGATION, type LigneMesure } from "@/lib/mesureRegles";

// Mesure de la mise en avant (point 10) — présentation seule, la règle vit dans
// lib/mesureTerritoriale. Verrouillée avant `ouvertureLe` ; sous le seuil, « moins de 5 ».

export type MesureAffichee =
  | { verrouillee: true; ouvertureLe: string }
  | { verrouillee: false; lignes: LigneMesure[] };

const cellule = (n: number | null) => (n === null ? `moins de ${SEUIL_AGREGATION}` : n.toLocaleString("fr-FR"));

export default function BlocMesure({ mesure }: { mesure: MesureAffichee }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm font-bold m-0">Mesure de la mise en avant</p>
      {mesure.verrouillee ? (
        <p className="text-xs text-gray-600 mt-1 mb-0">
          Mesure en cours. Les résultats s&apos;ouvrent le{" "}
          {new Date(mesure.ouvertureLe).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}
          {" "}: avant {DELAI_LECTURE_MOIS} mois, les volumes ne permettent pas de distinguer un effet du hasard.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Par mois, sur les postes de vos zones prioritaires. Aucun chiffre sous {SEUIL_AGREGATION} n&apos;est
            affiché, pour qu&apos;aucun soignant ne soit reconnaissable.
          </p>
          {mesure.lignes.length === 0 ? <p className="text-xs text-gray-500 m-0">Aucune donnée.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-1 pr-3 font-medium">Mois</th>
                    <th className="py-1 pr-3 font-medium">Affichages dans le fil</th>
                    <th className="py-1 pr-3 font-medium">dont remontés par la priorité</th>
                    <th className="py-1 pr-3 font-medium">Intérêts</th>
                    <th className="py-1 font-medium">Mises en relation</th>
                  </tr>
                </thead>
                <tbody>
                  {mesure.lignes.map((l) => (
                    <tr key={l.mois} className="border-t border-gray-100">
                      <td className="py-1 pr-3">{l.mois}</td>
                      <td className="py-1 pr-3">{cellule(l.servies)}</td>
                      <td className="py-1 pr-3">{cellule(l.remontees)}</td>
                      <td className="py-1 pr-3">{cellule(l.interets)}</td>
                      <td className="py-1">{cellule(l.misesEnRelation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
