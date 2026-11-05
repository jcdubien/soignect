import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { annoncesEcartees } from "@/lib/ecartes";
import RemettreDansLeFil from "./RemettreDansLeFil";

export const dynamic = "force-dynamic";

// Ce que j'ai écarté de mon fil (04/11) — voir lib/ecartes. Remettre une ligne la fait
// réapparaître dans le fil ; l'autre partie n'a jamais rien su du pass, elle ne sait rien non
// plus de son annulation.

function fmtJour(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default async function EcartesPage() {
  const session = await auth();
  const profileId = (session?.user as { profileId?: string } | undefined)?.profileId;
  if (!profileId) redirect("/login");

  const [moi, lignes] = await Promise.all([
    prisma.profile.findUnique({ where: { id: profileId }, select: { type: true } }),
    annoncesEcartees(profileId),
  ]);
  const recruteur = moi?.type === "TITULAIRE";
  const titre = recruteur ? "Candidats écartés" : "Annonces écartées";

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-6 animate-fade-up">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h1 className="text-xl font-bold text-gray-800">
          {titre}
          {lignes.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({lignes.length})</span>}
        </h1>
        <Link href="/annonces" className="text-xs px-3 py-1.5 bg-kine-100 text-kine-700 rounded-lg font-medium hover:bg-kine-200 transition">
          ← Retour au fil
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {recruteur
          ? "Les candidats que vous avez passés ou déclinés, encore disponibles."
          : "Les annonces que vous avez passées, encore ouvertes."}{" "}
        « Remettre dans mon fil » annule votre choix. Personne n&apos;a été prévenu de ce choix, personne
        ne le sera de son annulation.
      </p>

      {lignes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-8 text-center">
          <p className="text-sm text-gray-600 m-0">Rien d&apos;écarté pour l&apos;instant.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {lignes.map((l) => (
            <li key={l.missionId} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate m-0">{l.nom}</p>
                  <p className="text-xs text-gray-600 mt-0.5 mb-0 truncate">{l.typePoste} — {l.titre}</p>
                  <p className="text-xs text-gray-400 mt-0.5 mb-0 truncate">
                    {[l.periode, l.lieu].filter(Boolean).join(" · ") || "Sans date"} · écarté le {fmtJour(l.ecarteLe)}
                  </p>
                </div>
                <RemettreDansLeFil missionId={l.missionId} />
              </div>
              <Link href={`/annonces?card=${encodeURIComponent(l.missionId)}`} className="inline-block text-xs text-kine-700 font-medium mt-2 hover:underline">
                Voir la fiche →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
