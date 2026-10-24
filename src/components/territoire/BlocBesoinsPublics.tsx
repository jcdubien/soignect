import type { BesoinPublic } from "@/lib/besoinsPublics";

// Besoins du territoire sur une page publique (24/10). Composant serveur, sans interaction :
// l'intérêt s'exprime une fois connecté, depuis le fil (consentement à la transmission du nom).
export default function BlocBesoinsPublics({ besoins, titre, libelleProfession, lienInscription }: {
  besoins: BesoinPublic[];
  titre: string;
  /** Profession à afficher dans chaque ligne — omise quand la page est déjà celle d'une profession. */
  libelleProfession?: (b: BesoinPublic) => string | null;
  lienInscription: string;
}) {
  if (besoins.length === 0) return null;
  return (
    <section aria-labelledby="besoins-publics" className="my-8">
      <h2 id="besoins-publics" className="text-lg font-bold text-gray-900">{titre}</h2>
      <p className="mt-1 text-sm text-gray-500">
        Des structures de santé du territoire signalent un manque. Ce ne sont pas des offres d&apos;emploi :
        elles cherchent à faire venir des soignants et disent ce qu&apos;elles proposent.
      </p>
      <ul className="mt-3 space-y-3 list-none p-0">
        {besoins.map((b) => (
          <li key={b.id} className="rounded-2xl border border-[#0B3D5C]/20 bg-[#0B3D5C]/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#0B3D5C] m-0">{b.etiquette}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 m-0">
              {libelleProfession?.(b) ? `${libelleProfession(b)} · ` : ""}{b.specialite ? `${b.specialite} · ` : ""}{b.commune} — {b.nature}
            </p>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-line m-0">{b.texte}</p>
            {b.proposition && <p className="mt-1 text-sm text-gray-700 m-0"><span className="text-xs font-semibold text-gray-500">{b.etiquetteProposition} :</span> {b.proposition}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-gray-700">
        Intéressé·e ? <a href={lienInscription} className="font-semibold text-[#0B3D5C] underline">Créez votre compte gratuit</a>
        {" "}ou <a href="/login?return_to=%2Fannonces" className="font-semibold text-[#0B3D5C] underline">connectez-vous</a> :
        vous pourrez signaler votre intérêt depuis votre fil, et la structure reviendra vers vous.
      </p>
    </section>
  );
}
