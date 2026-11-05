import { prisma } from "@/lib/prisma";
import { exigerAdmin } from "@/lib/exigerAdmin";
import { CONSERVATION_JOURNAL_EMAIL_JOURS } from "@/lib/email";

export const dynamic = "force-dynamic";

// Journal des emails (04/11) — retrouver un envoi quand quelqu'un dit ne pas l'avoir reçu.
// « Envoyé » veut dire ACCEPTÉ par Resend, pas reçu : l'id ouvre le message dans le tableau de
// bord Resend, qui dit s'il a été délivré, a rebondi ou a été signalé.

function fmt(d: Date): string {
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Guadeloupe" });
}

export default async function AdminEmailsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigerAdmin();
  const q = ((await searchParams).q ?? "").trim().toLowerCase();
  const [envois, refus24h] = await Promise.all([
    prisma.envoiEmail.findMany({
      where: q ? { destinataire: { contains: q } } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.envoiEmail.count({ where: { statut: "refuse", createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Emails envoyés</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chaque envoi, accepté ou refusé par Resend, conservé {CONSERVATION_JOURNAL_EMAIL_JOURS} jours. « Envoyé »
          veut dire accepté, pas reçu : ouvrez l&apos;id pour voir dans Resend s&apos;il a été délivré.
          {refus24h > 0 && <strong className="text-red-700"> {refus24h} refus ces dernières 24 h.</strong>}
        </p>
      </div>

      <form className="flex gap-2" action="/admin/emails">
        <input
          name="q" defaultValue={q} placeholder="Adresse ou partie d'adresse"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button className="px-4 py-2 rounded-lg bg-[#0B3D5C] text-white text-sm font-semibold">Chercher</button>
      </form>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Date</th>
              <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Destinataire</th>
              <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Sujet</th>
              <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Statut</th>
              <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Resend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {envois.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmt(e.createdAt)}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{e.destinataire}</td>
                <td className="px-3 py-2 text-xs text-gray-700 max-w-[260px] truncate" title={e.sujet}>{e.sujet}</td>
                <td className="px-3 py-2 text-xs">
                  {e.statut === "envoye"
                    ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Accepté</span>
                    : <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium" title={e.erreur ?? ""}>Refusé</span>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {e.resendId
                    ? <a href={`https://resend.com/emails/${e.resendId}`} target="_blank" rel="noopener noreferrer" className="text-kine-700 underline font-mono">{e.resendId.slice(0, 8)}…</a>
                    : <span className="text-gray-400">{e.erreur ? e.erreur.slice(0, 60) : "—"}</span>}
                </td>
              </tr>
            ))}
            {envois.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">{q ? "Aucun envoi pour cette adresse." : "Aucun envoi enregistré."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
