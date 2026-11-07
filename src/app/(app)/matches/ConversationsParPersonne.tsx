import Image from "next/image";
import Link from "next/link";

// Vue « Conversations » de /matches (06/11) — UNE LIGNE PAR PERSONNE. Une même personne se
// retrouvait éclatée en plusieurs relations (une par couple d'annonces : jusqu'à 4 pour un même
// candidat), une relation déclinée partait dans un groupe replié avec tous ses messages, et la
// colonne de l'écran principal lâche une relation après 7 jours sans échange. On réunit ici tout
// ce qui a été échangé avec quelqu'un, quel que soit le statut — signé et décliné compris —,
// trié par dernier message. Chaque relation ouvre sa conversation (/match/[id]?chat=1).

export interface RelationConv {
  matchId: string;
  statut: string;
  signe: boolean;
  annonce: string | null;
  messages: number;
  nonLus: number;
}

export interface Personne {
  profileId: string;
  nom: string;
  photoUrl: string | null;
  role: string;
  dernier: { contenu: string; at: Date; deMoi: boolean } | null;
  activite: number;
  relations: RelationConv[];
}

const LIBELLE_STATUT: Record<string, string> = {
  EN_ATTENTE: "en attente",
  DISCUSSION: "discussion",
  CONFIRME: "confirmée",
  DECLINE: "déclinée",
  EXPIRE: "expirée",
};

function fmtJour(d: Date): string {
  const now = new Date();
  const memeJour = d.toDateString() === now.toDateString();
  return memeJour
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function ConversationsParPersonne({ personnes, q }: { personnes: Personne[]; q: string }) {
  return (
    <div>
      <form action="/matches" className="mb-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un nom ou une annonce…"
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-kine-200"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-kine-600 text-white text-sm font-semibold hover:bg-kine-700">
          Chercher
        </button>
      </form>

      {personnes.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">
          {q ? <>Aucune conversation ne correspond à « {q} ». <Link href="/matches" className="text-kine-700 underline">Tout afficher</Link></> : "Aucune conversation pour l'instant."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {personnes.map((p) => {
            const nonLus = p.relations.reduce((n, r) => n + r.nonLus, 0);
            const total = p.relations.reduce((n, r) => n + r.messages, 0);
            return (
              <li key={p.profileId} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-start gap-3 px-4 pt-3">
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-br from-kine-200 to-kine-400 flex-shrink-0">
                    {p.photoUrl && <Image src={p.photoUrl} alt="" fill className="object-cover" unoptimized />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 truncate m-0">{p.nom}</p>
                      <span className="text-[11px] text-gray-400 shrink-0">{p.role}</span>
                      {nonLus > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                          {nonLus > 9 ? "9+" : nonLus}
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-gray-400 shrink-0">{fmtJour(new Date(p.activite))}</span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 mb-0 ${nonLus > 0 ? "text-gray-700 font-semibold" : "text-gray-500"}`}>
                      {p.dernier
                        ? <>{p.dernier.deMoi ? "Vous : " : ""}{p.dernier.contenu}</>
                        : <span className="italic text-gray-400">Aucun message échangé</span>}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 mb-0">
                      {p.relations.length > 1 ? `${p.relations.length} mises en relation` : "1 mise en relation"}
                      {total > 0 && ` · ${total} message${total > 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <ul className="list-none m-0 mt-2 p-0 border-t border-gray-50">
                  {p.relations.map((r) => (
                    <li key={r.matchId}>
                      <Link
                        href={`/match/${r.matchId}?chat=1`}
                        className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-gray-50"
                      >
                        <span className="flex-1 min-w-0 truncate text-gray-700">{r.annonce ?? "Mise en relation"}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.signe ? "bg-emerald-100 text-emerald-800"
                          : r.statut === "DECLINE" || r.statut === "EXPIRE" ? "bg-gray-100 text-gray-500"
                          : "bg-kine-50 text-kine-700"
                        }`}>
                          {r.signe ? "contrat signé" : LIBELLE_STATUT[r.statut] ?? r.statut}
                        </span>
                        <span className="shrink-0 text-gray-400 w-14 text-right">{r.messages} msg{r.messages > 1 ? "s" : ""}</span>
                        <span className="shrink-0 text-kine-700 font-semibold">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
