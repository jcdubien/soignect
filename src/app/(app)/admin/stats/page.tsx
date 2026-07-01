import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TYPE_LABEL: Record<string, string> = {
  REMPLACANT: "Remplaçant",
  ASSISTANT: "Assistant",
  TITULAIRE: "Cabinet",
};

export default async function AdminStatsPage() {
  const [
    totalUsers,
    totalProfiles,
    totalActiveMissions,
    totalInactiveMissions,
    totalMatches,
    pendingRatings,
    profilesByType,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count(),
    prisma.mission.count({ where: { isActive: true } }),
    prisma.mission.count({ where: { isActive: false } }),
    prisma.match.count(),
    prisma.cabinetRating.count({ where: { isPublished: false } }),
    prisma.profile.groupBy({ by: ["type"], _count: { id: true } }),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: { select: { name: true, type: true } },
      },
    }),
  ]);

  const cards = [
    { label: "Utilisateurs", value: totalUsers },
    { label: "Profils", value: totalProfiles },
    { label: "Annonces actives", value: totalActiveMissions },
    { label: "Annonces inactives", value: totalInactiveMissions },
    { label: "Matches", value: totalMatches },
    { label: "Avis en attente", value: pendingRatings, alert: pendingRatings > 0 },
  ];

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Statistiques</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`bg-white rounded-xl border p-4 ${
              c.alert ? "border-red-200 bg-red-50" : "border-gray-100"
            }`}
          >
            <p className="text-xs text-gray-500 font-medium">{c.label}</p>
            <p
              className={`text-2xl font-black mt-1 ${
                c.alert ? "text-red-600" : "text-gray-800"
              }`}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">Profils par type</h2>
        <div className="flex gap-4 flex-wrap">
          {profilesByType.map((g) => (
            <div key={g.type} className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  g.type === "REMPLACANT"
                    ? "bg-blue-400"
                    : g.type === "ASSISTANT"
                    ? "bg-violet-400"
                    : "bg-emerald-400"
                }`}
              />
              <span className="text-sm text-gray-700">
                {TYPE_LABEL[g.type] ?? g.type} — {g._count.id}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-600">10 dernières inscriptions</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-500 font-medium">Email</th>
              <th className="px-4 py-2 text-left text-gray-500 font-medium">Profil</th>
              <th className="px-4 py-2 text-left text-gray-500 font-medium">Rôle</th>
              <th className="px-4 py-2 text-left text-gray-500 font-medium">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentUsers.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-2.5 text-gray-700">{u.email}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {u.profile
                    ? `${TYPE_LABEL[u.profile.type] ?? u.profile.type}${
                        u.profile.name ? ` · ${u.profile.name}` : ""
                      }`
                    : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {u.role === "ADMIN" ? (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                      ADMIN
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">USER</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{fmt(u.createdAt)}</td>
              </tr>
            ))}
            {recentUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">
                  Aucun utilisateur
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
