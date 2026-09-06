import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { peutGererPriorites } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Espace PARTENAIRE TERRITORIAL (section 232) — hors de /admin, délibérément.
//
// `/admin/layout.tsx` protège 13 écrans d'un seul contrôle. Y admettre le partenaire aurait
// obligé à ajouter une garde sur les 12 autres, et surtout aurait ouvert par défaut tout écran
// admin créé ensuite. Le défaut doit rester « refusé » : ce segment n'expose que ce qu'il
// contient, et `/admin` n'a pas bougé d'une ligne.
export default async function TerritoireLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!peutGererPriorites(role)) redirect("/annonces");

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-3">
        <p className="text-sm font-bold text-gray-800">Priorisation territoriale</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Espace partenaire — vous n&apos;avez accès qu&apos;à cet écran.
        </p>
        <Link href="/territoire/priorites" className="sr-only">
          Priorités
        </Link>
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
