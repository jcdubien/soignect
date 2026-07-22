/* eslint-disable react/no-unescaped-entities */
import { prisma } from "@/lib/prisma";
import {
  DEEPSEEK_DAILY_USER_LIMIT,
  DEEPSEEK_DAILY_GLOBAL_LIMIT,
  DEEPSEEK_GLOBAL_ALERT_AT,
  BUDGET_TIMEZONE,
  startOfBudgetDay,
} from "@/lib/deepseekBudget";

export const dynamic = "force-dynamic";

// État des appels DeepSeek (protection facture, section 165). Compteur porté par TraceEvent :
// event "DEEPSEEK_CALL" par appel, "DEEPSEEK_ALERT" au franchissement du seuil 80 %.
const CALL_EVENT = "DEEPSEEK_CALL";
const ALERT_EVENT = "DEEPSEEK_ALERT";

const TYPE_LABEL: Record<string, string> = {
  REMPLACANT: "Remplaçant",
  ASSISTANT: "Assistant",
  TITULAIRE: "Cabinet",
};

export default async function AdminDeepSeekPage() {
  // Fenêtre de jour = minuit heure Guadeloupe (même borne que le limiteur, source unique).
  const todayStart = startOfBudgetDay(0);

  // Bornes des 7 derniers jours (aujourd'hui inclus).
  const dayBounds = Array.from({ length: 7 }, (_, i) => ({
    start: startOfBudgetDay(6 - i),
    end: startOfBudgetDay(5 - i),
  }));

  const [globalToday, alertToday, perUserRaw, dailyCounts] = await Promise.all([
    prisma.traceEvent.count({ where: { eventType: CALL_EVENT, occurredAt: { gte: todayStart } } }),
    prisma.traceEvent.findFirst({
      where: { eventType: ALERT_EVENT, occurredAt: { gte: todayStart } },
      select: { occurredAt: true },
    }),
    prisma.traceEvent.groupBy({
      by: ["profileId"],
      where: { eventType: CALL_EVENT, occurredAt: { gte: todayStart } },
      _count: { _all: true },
    }),
    Promise.all(
      dayBounds.map(({ start, end }) =>
        prisma.traceEvent.count({ where: { eventType: CALL_EVENT, occurredAt: { gte: start, lt: end } } }),
      ),
    ),
  ]);

  // Noms/types des profils consommateurs du jour.
  const ids = perUserRaw.map((u) => u.profileId).filter((x): x is string => !!x);
  const profiles = ids.length
    ? await prisma.profile.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, type: true } })
    : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const perUser = perUserRaw
    .map((u) => ({
      profileId: u.profileId,
      count: u._count._all,
      name: u.profileId ? byId.get(u.profileId)?.name ?? null : null,
      type: u.profileId ? byId.get(u.profileId)?.type ?? null : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  const globalPct = Math.min(100, Math.round((globalToday / DEEPSEEK_DAILY_GLOBAL_LIMIT) * 100));
  const overLimit = globalToday >= DEEPSEEK_DAILY_GLOBAL_LIMIT;
  const overAlert = globalToday >= DEEPSEEK_GLOBAL_ALERT_AT;
  const barColor = overLimit ? "bg-red-500" : overAlert ? "bg-amber-500" : "bg-emerald-500";
  const maxDaily = Math.max(1, ...dailyCounts);

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Appels DeepSeek</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Protection facture — plafonds quotidiens (reset à minuit, heure Guadeloupe). Au-delà, le
          score retombe sur une valeur neutre sans appel payant (le swipe/match reste enregistré).
        </p>
      </div>

      {/* Alerte si seuil 80 % franchi aujourd'hui */}
      {overAlert && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            overLimit ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {overLimit
            ? `⚠️ Plafond global atteint aujourd'hui (${globalToday}/${DEEPSEEK_DAILY_GLOBAL_LIMIT}). Les appels DeepSeek sont désormais en repli neutre jusqu'à minuit UTC.`
            : `⚠️ Seuil d'alerte (80 %) franchi aujourd'hui (${globalToday}/${DEEPSEEK_DAILY_GLOBAL_LIMIT}). Surveiller la facture.`}
          {alertToday && (
            <span className="block text-xs opacity-70 mt-0.5">
              Alerte enregistrée à{" "}
              {alertToday.occurredAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: BUDGET_TIMEZONE })} (heure Guadeloupe).
            </span>
          )}
        </div>
      )}

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium">Appels aujourd'hui (global)</p>
          <p className="text-2xl font-black mt-1 text-gray-800">
            {globalToday}
            <span className="text-sm text-gray-400 font-medium"> / {DEEPSEEK_DAILY_GLOBAL_LIMIT}</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium">Plafond par utilisateur / jour</p>
          <p className="text-2xl font-black mt-1 text-gray-800">{DEEPSEEK_DAILY_USER_LIMIT}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium">Utilisateurs actifs (aujourd'hui)</p>
          <p className="text-2xl font-black mt-1 text-gray-800">{perUser.length}</p>
        </div>
      </div>

      {/* Jauge globale du jour */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-600">Consommation globale du jour</h2>
          <span className="text-xs text-gray-400">
            {globalPct}% du plafond · alerte à {DEEPSEEK_GLOBAL_ALERT_AT}
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${globalPct}%` }} />
        </div>
      </div>

      {/* Tendance 7 jours */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">7 derniers jours (heure Guadeloupe)</h2>
        <div className="space-y-1.5">
          {dayBounds.map(({ start }, i) => {
            const n = dailyCounts[i];
            const isToday = i === dayBounds.length - 1;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-14 shrink-0 text-xs ${isToday ? "font-bold text-gray-700" : "text-gray-400"}`}>
                  {start.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", timeZone: BUDGET_TIMEZONE })}
                </span>
                <div className="flex-1 h-4 rounded bg-gray-50 overflow-hidden">
                  <div
                    className={`h-full rounded ${isToday ? "bg-kine-500" : "bg-kine-300"}`}
                    style={{ width: `${Math.round((n / maxDaily) * 100)}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs text-gray-500">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Détail par utilisateur (aujourd'hui) */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-600">Par utilisateur — aujourd'hui (top 25)</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-500 font-medium">Profil</th>
              <th className="px-4 py-2 text-right text-gray-500 font-medium">Appels</th>
              <th className="px-4 py-2 text-left text-gray-500 font-medium">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {perUser.map((u) => {
              const degraded = u.count >= DEEPSEEK_DAILY_USER_LIMIT;
              return (
                <tr key={u.profileId ?? "?"} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-2.5 text-gray-700">
                    {u.name ?? <span className="text-gray-400">(sans nom)</span>}
                    {u.type && <span className="text-xs text-gray-400"> · {TYPE_LABEL[u.type] ?? u.type}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">
                    {u.count}
                    <span className="text-xs text-gray-400"> / {DEEPSEEK_DAILY_USER_LIMIT}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {degraded ? (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                        Plafond atteint · repli neutre
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {perUser.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">
                  Aucun appel DeepSeek aujourd'hui
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
