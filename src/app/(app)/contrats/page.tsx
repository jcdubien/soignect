import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { mesContrats, LIBELLES_ETAT, type EtatContrat } from "@/lib/mesContrats";

export const dynamic = "force-dynamic";

// « Mes contrats » (04/11) — tous les contrats où une signature a été posée, signés ou en cours.
// Un contrat signé des deux côtés quitte /matches (section 183) : c'est ici qu'on le retrouve.
// Le PDF officiel se télécharge depuis la page du contrat (termes figés à la première signature).

const STYLE_ETAT: Record<EtatContrat, string> = {
  A_SIGNER: "bg-amber-100 text-amber-800",
  ATTENTE_AUTRE: "bg-sky-100 text-sky-800",
  SUIVI: "bg-gray-100 text-gray-700",
  SIGNE: "bg-emerald-100 text-emerald-800",
};

function fmtJour(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ContratsPage() {
  const session = await auth();
  const profileId = (session?.user as { profileId?: string } | undefined)?.profileId;
  if (!profileId) redirect("/login");

  const contrats = await mesContrats(profileId);
  const aSigner = contrats.filter((c) => c.etat === "A_SIGNER").length;

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-6 animate-fade-up">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h1 className="text-xl font-bold text-gray-800">
          Mes contrats
          {contrats.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({contrats.length})</span>}
        </h1>
        <Link href="/matches" className="text-xs px-3 py-1.5 bg-kine-100 text-kine-700 rounded-lg font-medium hover:bg-kine-200 transition">
          Mes mises en relation
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Les contrats signés ou en cours de signature sur Soignect. Ouvrez-en un pour le relire, le
        signer ou télécharger le PDF officiel.
        {aSigner > 0 && <strong className="text-amber-700"> {aSigner === 1 ? "Un contrat attend" : `${aSigner} contrats attendent`} votre signature.</strong>}
      </p>

      {contrats.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-8 text-center">
          <p className="text-sm text-gray-600 m-0">Aucun contrat pour l&apos;instant.</p>
          <p className="text-xs text-gray-400 mt-1 mb-0">
            Un contrat apparaît ici dès sa première signature, depuis une mise en relation.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {contrats.map((c) => (
            <li key={c.matchId}>
              <Link
                href={`/match/${c.matchId}/contrat`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 hover:border-kine-200 hover:shadow transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate m-0">{c.typePoste} — avec {c.avec}</p>
                    <p className="text-xs text-gray-500 mt-0.5 mb-0 truncate">
                      {[c.periode, c.lieu].filter(Boolean).join(" · ") || "Sans date"}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STYLE_ETAT[c.etat]}`}>
                    {LIBELLES_ETAT[c.etat]}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-2 mb-0">
                  {c.etat === "SIGNE" ? `Signé le ${fmtJour(c.derniereSignature)}` : `Dernière signature le ${fmtJour(c.derniereSignature)}`}
                  {c.attenduDe && ` · en attente de ${c.attenduDe}`}
                  {" · "}
                  <span className="text-kine-700 font-medium">
                    {c.etat === "A_SIGNER" ? "Relire et signer →" : c.etat === "SIGNE" ? "Voir et télécharger →" : "Voir le contrat →"}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
