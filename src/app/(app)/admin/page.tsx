import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminWeightSlider from "@/components/ui/AdminWeightSlider";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/swipe");

  const profiles = await prisma.profile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
      missions: { where: { isActive: true }, select: { title: true, location: true }, take: 1 },
    },
  });

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard Admin</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Pondération : 1.0 = normal · 2.0 = boost payant · 3.0 = boost max
      </p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Email</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Type</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Dernière annonce</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Note</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Payant</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium w-48">Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-gray-700">{p.user.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.type === "REMPLACANT" ? "bg-blue-100 text-blue-700"
                    : p.type === "ASSISTANT" ? "bg-violet-100 text-violet-700"
                    : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {p.type === "REMPLACANT" ? "Remplaçant" : p.type === "ASSISTANT" ? "Assistant" : "Cabinet"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {p.missions[0]
                    ? <span>{p.missions[0].title} · {p.missions[0].location}</span>
                    : <span className="text-gray-300">Aucune annonce</span>}
                </td>
                <td className="px-4 py-3">
                  {p.ratingCount > 0 ? (
                    <span className="text-yellow-500 font-semibold">
                      ★ {p.ratingAvg?.toFixed(1)} ({p.ratingCount})
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.isPaid ? <span className="text-kine-600 font-semibold">✓</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <AdminWeightSlider profileId={p.id} initialWeight={p.weight} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
