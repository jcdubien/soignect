import type { Metadata } from "next";
import Link from "next/link";
import { activationEnAttente } from "@/lib/confrereHorsSoignect";
import ActiverClient from "./ActiverClient";

export const dynamic = "force-dynamic";
// Lien porteur d'un secret : jamais indexé, jamais transmis en référent.
export const metadata: Metadata = { title: "Activer votre compte | Soignect", robots: { index: false, follow: false }, referrer: "no-referrer" };

const LIBELLE: Record<string, string> = { REMPLACEMENT: "votre remplacement", ASSISTANAT: "votre assistanat", COLLABORATION: "votre collaboration" };

export default async function ActiverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await activationEnAttente(token);
  if (!a) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900">Lien invalide ou déjà utilisé</h1>
        <p className="text-sm text-gray-500 mt-2">Si vous avez déjà activé votre compte, connectez-vous. Sinon, demandez un nouveau lien au confrère qui vous l&apos;a envoyé.</p>
        <Link href="/login" className="inline-block mt-6 rounded-xl bg-kine-600 px-5 py-3 text-sm font-bold text-white">Se connecter</Link>
      </div>
    );
  }
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-xl font-bold text-gray-900">Bonjour {a.nom.split(" ")[0]}</h1>
      <p className="text-sm text-gray-600 mt-2">
        {a.titulaire} vous a ajouté·e sur Soignect pour {a.missionType ? LIBELLE[a.missionType] : "votre contrat"}.
        Choisissez votre mot de passe pour activer votre compte et retrouver le contrat.
      </p>
      <ActiverClient token={token} email={a.email} />
    </div>
  );
}
