import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DesirabilitySlider from "@/components/ui/DesirabilitySlider";

export const dynamic = "force-dynamic";

export default async function AdminDesirabilityPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/annonces");

  const profiles = await prisma.profile.findMany({
    where: { type: "TITULAIRE" },
    orderBy: [{ isFounding: "desc" }, { desirabilityScore: "desc" }, { createdAt: "desc" }],
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Désirabilité — Cabinets</h1>
        <p className="text-gray-500 text-sm mt-1">
          Curseur 0-10 par cabinet · Les cabinets fondateurs sont bloqués à 10
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Email</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Plan</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Score actuel</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium w-72">Override admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-gray-700">{p.user.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.subscriptionPlan === "BOOST"   ? "bg-orange-100 text-orange-700" :
                    p.subscriptionPlan === "PREMIUM" ? "bg-kine-100 text-kine-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {p.subscriptionPlan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-kine-600">{p.desirabilityScore.toFixed(1)}</span>
                  <span className="text-gray-300 text-xs">/10</span>
                </td>
                <td className="px-4 py-3">
                  <DesirabilitySlider
                    profileId={p.id}
                    initialOverride={p.desirabilityOverride}
                    initialExpiry={p.desirabilityExpiry ? p.desirabilityExpiry.toISOString() : null}
                    initialScore={p.desirabilityScore}
                    isFounding={p.isFounding}
                  />
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucun cabinet inscrit
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        La date d&apos;expiration est optionnelle — sans date, le boost est permanent jusqu&apos;à modification manuelle.
      </p>
    </div>
  );
}
