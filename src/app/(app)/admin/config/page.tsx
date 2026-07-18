import { prisma } from "@/lib/prisma";
import ConfigToggle from "./ConfigToggle";
import EnforceContractToggle from "./EnforceContractToggle";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const cfg = await prisma.platformConfig.findFirst();
  const freeAccessMode = cfg?.freeAccessMode ?? true;
  const enforceContractProfile = cfg?.enforceContractProfile ?? false;
  const cabinetCount = await prisma.profile.count({ where: { type: "TITULAIRE" } });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Configuration</h1>
      <p className="text-sm text-gray-400 mb-6">Paramètres globaux de la plateforme.</p>

      <div className="mb-6 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Cabinets actifs</p>
        <p className="text-2xl font-black text-gray-900">{cabinetCount}</p>
        <p className="text-xs text-gray-400">comptes de type cabinet (titulaire) créés</p>
      </div>

      <ConfigToggle initial={freeAccessMode} />
      <EnforceContractToggle initial={enforceContractProfile} />
    </div>
  );
}
