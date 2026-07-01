"use client";

import { useState, useMemo } from "react";

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  profile: { id: string; type: string; name: string | null } | null;
}

const TYPE_LABEL: Record<string, string> = {
  REMPLACANT: "Remplaçant",
  ASSISTANT: "Assistant",
  TITULAIRE: "Cabinet",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      users.filter((u) =>
        u.email.toLowerCase().includes(search.toLowerCase())
      ),
    [users, search]
  );

  async function toggleRole(user: User) {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    if (newRole === "USER") {
      if (!confirm(`Rétrograder ${user.email} en USER ?`)) return;
    }
    setLoading(user.id);
    const r = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (r.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
    }
    setLoading(null);
  }

  async function deleteUser(user: User) {
    if (!confirm(`Supprimer définitivement ${user.email} et son profil ?`)) return;
    setLoading(user.id);
    const r = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (r.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    }
    setLoading(null);
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-800">
          Utilisateurs{" "}
          <span className="text-sm font-normal text-gray-400">({users.length})</span>
        </h1>
        <input
          type="text"
          placeholder="Rechercher par email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-kine-300"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Email</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Profil</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Rôle</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Inscrit le</th>
              <th className="px-4 py-3 text-right text-gray-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-gray-700 font-medium">{u.email}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.profile
                    ? `${TYPE_LABEL[u.profile.type] ?? u.profile.type}${
                        u.profile.name ? ` · ${u.profile.name}` : ""
                      }`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {u.role === "ADMIN" ? (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">
                      ADMIN
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">USER</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{fmt(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => toggleRole(u)}
                      disabled={loading === u.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      {u.role === "ADMIN" ? "Rétrograder USER" : "Passer ADMIN"}
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      disabled={loading === u.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Aucun utilisateur trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
