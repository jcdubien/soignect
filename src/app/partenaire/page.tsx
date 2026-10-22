import { Metadata } from "next";
import Link from "next/link";
import type { TypeInstitution } from "@prisma/client";
import { COMMUNES_BY_ZONE, ZONE_LABELS, inseeOfCommune } from "@/lib/communes";
import { PROFESSION_LABELS } from "@/lib/professions";
import { PROFESSIONS_PARTENAIRE, TYPES_PARTENAIRE, TYPES_PARTENAIRE_ACCEPTES } from "@/lib/partenariat";
import FormulairePartenariat from "./FormulairePartenariat";

export const dynamic = "force-dynamic";

// Formulaire de demande de partenariat (22/10) — voir lib/partenariat. Hors index : c'est une
// page d'action, ouverte depuis les pages territoire et maison de santé.
export const metadata: Metadata = {
  title: "Demande de partenariat | Soignect",
  description: "CPTS, collectivités, maisons de santé, établissements : demandez à échanger sur un partenariat avec Soignect.",
  robots: { index: false, follow: true },
};

export default async function PartenairePage({ searchParams }: { searchParams: Promise<{ type?: string; src?: string }> }) {
  const sp = await searchParams;
  const type = (TYPES_PARTENAIRE_ACCEPTES as string[]).includes(sp.type ?? "") ? (sp.type as TypeInstitution) : "";
  const zones = COMMUNES_BY_ZONE.map((z) => ({
    zone: ZONE_LABELS[z.zone],
    communes: z.communes
      .map((c) => ({ libelle: c, code: inseeOfCommune(c) }))
      .filter((c): c is { libelle: string; code: string } => !!c.code),
  })).filter((z) => z.communes.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/" className="text-sm font-black text-kine-700">Soignect</Link>
        <h1 className="text-3xl font-black text-gray-900 mt-4 mb-2">Échanger sur un partenariat</h1>
        <p className="text-gray-500 text-base leading-relaxed mb-8">
          CPTS, collectivité, maison de santé, établissement : dites-nous qui vous êtes et ce que vous
          cherchez. Nous revenons vers vous pour en parler. Rien n&apos;est engagé ni facturé à ce stade.
        </p>
        <FormulairePartenariat
          typeInitial={type}
          source={sp.src?.slice(0, 80) ?? ""}
          types={TYPES_PARTENAIRE.map((t) => ({ ...t }))}
          professions={PROFESSIONS_PARTENAIRE.map((p) => ({ valeur: p, libelle: PROFESSION_LABELS[p] }))}
          zones={zones}
        />
        <p className="text-sm text-gray-500 mt-8">
          Vous êtes un professionnel de santé ou un établissement qui veut publier une offre ?{" "}
          <Link href="/register" className="underline text-kine-700">Créer un compte</Link>
          {" · "}
          <Link href="/login" className="underline text-kine-700">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
