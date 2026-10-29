import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { filtreAnnoncesVivantes } from "@/lib/annoncesTerritoire";
import { tracerVueLanding } from "@/lib/traceLanding";
import { Porte, Profession, Territoire, cleTracePage, cheminPage, lienInscription, PAGES_PUBLIEES } from "@/lib/pagesDiffusion";
import BlocPartenaire from "@/components/diffusion/BlocPartenaire";
import { lienPartenariat } from "@/lib/partenariat";
import { libelleRoleSalariat, libelleTypePoste, estEtablissement } from "@/lib/libellesPoste";
import { isFreeAccessMode } from "@/lib/platform";
import { mentionGratuite } from "@/lib/gratuite";
import { besoinsPublics } from "@/lib/besoinsPublics";
import type { Profession as PrismaProfession } from "@prisma/client";
import BlocBesoinsPublics from "@/components/territoire/BlocBesoinsPublics";
import { inseeOfCommune } from "@/lib/communes";
import { contratFourniParEmployeur } from "@/lib/contrats/gabaritsSalarie";

// Gabarit commun des pages de diffusion « à annonces » (section 212) — toutes les portes sauf
// TERRITOIRE, pour toutes les professions et tous les territoires. Depuis la section 377 il sert
// aussi les trois pages historiques des kinés (Guadeloupe, Saint-Martin, Saint-Barth), qui en
// étaient restées des copies.
//
// Ce composant ne connaît NI profession NI territoire : il reçoit les trois axes et compose.
// C'est ce qui permet d'ajouter une porte, une profession ou un département sans le toucher.

export default async function PagePorte({
  porte, profession, territoire,
}: {
  porte: Porte;
  profession: Profession;
  territoire: Territoire;
}) {
  const { zones, communes } = territoire.perimetre;
  // Porte « emploi » (établissements, 24/10) : un établissement recrute des salariés — la page ne
  // montre que les candidats ouverts au salariat, comme son fil (sauf profession salariée par
  // nature, ex. aide-soignant). Les autres portes candidats (cabinets, maisons de santé) montrent
  // tout le monde : une MSP recrute un salarié ou un libéral.
  const salarieSeulement = porte.slug === "emploi" && !contratFourniParEmployeur(profession.enumBase);
  const filtre = filtreAnnoncesVivantes(zones, communes, profession.enumBase, porte.montre);
  const missions = await prisma.mission.findMany({
    // Le camp vient de la PORTE, qui le déclare : une porte employeur montre des candidats.
    where: salarieSeulement ? { ...filtre, profile: { ...filtre.profile, ouvertSalariat: true } } : filtre,
    include: { profile: { select: { type: true, name: true, titulaireKind: true, ouvertSalariat: true, ratingAvg: true } } },
    orderBy: [{ profile: { weight: "desc" } }, { createdAt: "desc" }],
    // Échantillon, pas inventaire : 8 suffisent à montrer qu'il se passe quelque chose.
    // Au-delà, la page devient une liste à faire défiler et le CTA disparaît sous le pli.
    take: 8,
  });

  await tracerVueLanding(cleTracePage(porte, profession, territoire), missions.length);
  const gratuite = porte.mentionGratuite ? mentionGratuite(await isFreeAccessMode()) : null;

  // La provenance voyage jusqu'à l'inscription (section 86) : sans elle, on compte les visites
  // d'une page sans jamais savoir si elles aboutissent. Même clé que la trace de visite.
  // La porte du chercheur de poste SALARIÉ préselectionne le compte candidat (section 305) : sans
  // ça, un aide-soignant devrait choisir entre « remplaçant » et « assistant / collaborateur »,
  // deux mots qui ne décrivent pas son métier.
  // La porte « emploi » des établissements préselectionne de même le compte établissement : il
  // devait sinon se retrouver lui-même parmi « Cabinet / Titulaire », « Remplaçant·e »…
  // Le compte présélectionné est déclaré par la porte (lib/pagesDiffusion, `typeCompte`), comme
  // l'île : une page de Martinique ouvre une inscription en Martinique.
  // Porte MSP (24/10) : l'appel ouvre la demande de partenariat — une MSP n'a pas de compte
  // recruteur. Les membres, eux, publient depuis leur compte cabinet (lien dédié plus bas).
  const inscription = porte.ctaPartenariat
    ? lienPartenariat(porte.ctaPartenariat, cleTracePage(porte, profession, territoire))
    : lienInscription(porte, profession, territoire);
  const inscriptionMembre = porte.ctaPartenariat
    ? lienInscription(porte, profession, territoire, { typeCompte: "CABINET", src: `membre-${cleTracePage(porte, profession, territoire)}` })
    : null;

  // Besoins du territoire (24/10) — seulement sur les portes qui s'adressent aux soignants (celles
  // qui leur montrent des employeurs), pour la profession de la page et les communes du territoire.
  const besoins = porte.montre === "EMPLOYEUR"
    ? await besoinsPublics({ profession: profession.enumBase as PrismaProfession, codesInsee: communes.map((c) => inseeOfCommune(c)).filter((c): c is string => !!c), lieu: "page-metier" })
    : [];
  const inscriptionSoignant = lienInscription(porte, profession, territoire, { typeCompte: "REMPLACANT" });
  // Une porte qui montre des employeurs montre des POSTES : on dit ce qui est proposé.
  const montrePostes = porte.montre === "EMPLOYEUR";

  const bas = porte.basDePage(profession, territoire);
  const ailleurs = PAGES_PUBLIEES.filter(
    (x) => x.porte.slug === porte.slug && x.profession.slug === profession.slug && x.territoire.slug !== territoire.slug,
  );

  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <span className="inline-block px-3 py-1 bg-kine-100 text-kine-700 rounded-full text-xs font-semibold mb-3">
          📍 {territoire.nom}
        </span>
        <h1 className="text-3xl font-black text-gray-900 mb-3">
          {porte.titre(profession, territoire)}
        </h1>
        <p className="text-gray-500 text-base leading-relaxed">
          {porte.accroche(profession, territoire)}
        </p>
      </div>

      <div className="bg-gradient-to-br from-kine-600 to-kine-800 rounded-2xl p-6 text-white mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-lg mb-1">{porte.titreAppel ?? "Rejoignez Soignect"}</p>
          <p className="text-kine-100 text-sm">{porte.ctaSous(profession, territoire)}</p>
          {gratuite && <p className="text-white text-sm font-semibold mt-1">{gratuite}</p>}
        </div>
        <Link
          // La profession de CETTE page de diffusion voyage jusqu'à l'inscription (section 283) :
          // quelqu'un qui arrive par « remplacement kiné Guadeloupe » a déjà dit ce qu'il
          // exerce, et le lui redemander serait une friction gratuite. C'est le SEUL cas de
          // présélection — ailleurs, le champ reste vide.
          href={inscription}
          className="flex-shrink-0 px-5 py-3 bg-white text-kine-700 rounded-xl font-bold text-sm hover:bg-kine-50 transition"
        >
          {porte.cta}
        </Link>
      </div>
      {inscriptionMembre && (
        <p className="-mt-4 mb-6 text-sm text-gray-600">
          Vous êtes membre de la MSP ?{" "}
          <Link href={inscriptionMembre} className="font-semibold text-kine-700 underline">Publiez votre poste depuis votre compte cabinet</Link>.
        </p>
      )}
      {/* Retour d'un compte déjà inscrit (22/10) : aucune page de diffusion ne menait à /login. */}
      <p className="-mt-5 mb-8 text-sm text-gray-500 text-right">
        Déjà inscrit ?{" "}
        <Link href="/login" className="font-semibold text-kine-700 underline">Se connecter</Link>
      </p>

      <h2 className="text-lg font-bold text-gray-800 mb-4">
        {missions.length > 0
          ? `${missions.length} ${montrePostes ? "poste" : "annonce"}${missions.length > 1 ? "s" : ""} ${territoire.preposition} ${territoire.nom}`
          : montrePostes
            ? "Aucune annonce pour le moment"
          : salarieSeulement
            // Page « emploi » sans candidat ouvert au salariat (24/10) : le dire, plutôt qu'« aucune
            // annonce », qui laisserait croire que personne n'est inscrit.
            ? `Aucun candidat ouvert au salariat ${territoire.preposition} ${territoire.nom} pour le moment — publiez votre offre, elle sera visible dès qu'il y en aura.`
            : "Aucune annonce pour le moment — soyez le premier à publier !"}
      </h2>

      {missions.length > 0 && (
        <div className="space-y-3">
          {missions.map((m) => {
            const periode =
              m.startDate && m.endDate ? `${fmt(m.startDate)} → ${fmt(m.endDate)}`
              : m.startDate ? `dès le ${fmt(m.startDate)}`
              : m.minMonths ? `${m.minMonths} mois min.`
              : null;
            // Une structure n'est pas un « Cabinet » : sur la page d'un aide-soignant, presque toutes
            // les offres viennent d'EHPAD et de SSIAD (section 305).
            // Un aide-soignant qui se propose n'est pas un « Remplaçant » non plus (section 304) : la
            // page est celle d'UNE profession, toutes ses annonces la partagent.
            // Sur la page « emploi », tout candidat montré est ouvert au salariat : « Candidat·e ». Sur
            // la page des maisons de santé, l'étiquette habituelle, et « ouvert·e au salariat »
            // quand le candidat l'a dit — une MSP voit d'un coup d'œil les deux possibilités.
            const estCand = m.profile.type !== "TITULAIRE";
            const label = (salarieSeulement && estCand ? "Candidat·e" : null)
              ?? libelleRoleSalariat({ ...m.profile, profession: profession.enumBase })
              ?? { REMPLACANT: "Remplaçant·e", ASSISTANT: "Assistant·e", TITULAIRE: "Cabinet" }[m.profile.type];
            const ouvertSalariat = porte.slug === "maison-de-sante" && estCand && m.profile.ouvertSalariat;
            if (montrePostes) {
              // Un POSTE : le badge dit ce qui est PROPOSÉ, dans le vocabulaire de qui publie — un
              // CDI d'établissement s'affichait « Collaboration libérale ». Table unique dans
              // lib/libellesPoste. Carte reprise de la page historique des kinés de Guadeloupe.
              const estEtab = estEtablissement(m.profile);
              return (
                <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      estEtab ? "bg-slate-100 text-slate-700" :
                      m.missionType === "ASSISTANAT" ? "bg-violet-100 text-violet-700" :
                      m.missionType === "COLLABORATION" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{libelleTypePoste(m.missionType, m.profile)}</span>
                    {m.profile.ratingAvg && (
                      <span className="text-xs text-yellow-600 font-semibold">★ {m.profile.ratingAvg.toFixed(1)}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-800 text-sm leading-snug">{m.title}</h3>
                  <p className="text-gray-400 text-xs mt-1">📍 {m.location}{periode ? ` · ${periode}` : ""}</p>
                  {m.pitch && (
                    <p className="text-gray-500 text-xs mt-2 italic border-l-2 border-kine-300 pl-2 line-clamp-2">{m.pitch}</p>
                  )}
                </div>
              );
            }
            return (
              <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    m.profile.type === "TITULAIRE" ? "bg-emerald-100 text-emerald-700" :
                    m.profile.type === "ASSISTANT" ? "bg-violet-100 text-violet-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>{label}</span>
                  {ouvertSalariat && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">ouvert·e au salariat</span>}
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">{m.title}</h3>
                <p className="text-gray-400 text-xs mt-1">
                  📍 {m.location}{periode ? ` · ${periode}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        {porte.ctaBas && <p className="text-gray-400 text-sm mb-3">{porte.ctaBas.intro}</p>}
        <Link href={inscription} className="inline-flex items-center gap-2 px-6 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 transition">
          {porte.ctaBas?.libelle ?? porte.cta}
        </Link>
      </div>

      {/* Les autres métiers de la MÊME porte (section 304) — dérivés du registre. Un EHPAD
          arrivé par « emploi kiné » recrute aussi des infirmiers et des aides-soignants. */}
      {(() => {
        // Pages EMPLOYEUR seulement (elles montrent des candidats) : « vous recrutez aussi »
        // ne se dit pas à quelqu'un qui cherche un poste.
        const soeurs = porte.montre !== "CANDIDAT" ? [] : PAGES_PUBLIEES.filter(
          (x) => x.porte.slug === porte.slug && x.territoire.slug === territoire.slug && x.profession.slug !== profession.slug,
        );
        return soeurs.length > 0 ? (
          <p className="mt-6 text-sm text-gray-500 text-center">
            {porte.ctaPartenariat ? "Votre MSP a aussi besoin" : "Vous recrutez aussi"}{" "}
            {soeurs.map((x, i) => (
              <span key={x.profession.slug}>
                {i > 0 && (i === soeurs.length - 1 ? " ou " : ", ")}
                <Link href={cheminPage(x.porte, x.profession, x.territoire)} className="underline text-kine-700">
                  {x.profession.unSingulier}
                </Link>
              </span>
            ))}{" "}?
          </p>
        ) : null;
      })()}

      {porte.offrePartenaire && (
        // Sur la porte « emploi », « Devenir partenaire » ouvre lui aussi le compte établissement
        // (22/10) : sans le type, l'établissement retombait sur « Je suis… » parmi les libéraux.
        // Sur la porte « maison de santé », il ouvre la demande de partenariat (lib/partenariat) :
        // l'offre partenaire d'une MSP se convient avec l'administrateur, pas à l'inscription.
        <BlocPartenaire profession={profession} facultative={gratuite !== null} inscription={porte.slug === "maison-de-sante"
          ? lienPartenariat("MSP", `partenaire-${porte.slug}-${profession.slug}`)
          : lienInscription(porte, profession, territoire, { typeCompte: porte.slug === "emploi" ? "ETABLISSEMENT" : null, src: `partenaire-${porte.slug}-${profession.slug}` })} porteSlug={porte.slug} />
      )}

      <BlocBesoinsPublics besoins={besoins} titre="Besoins du territoire" lienInscription={inscriptionSoignant} />

      {/* NE GARDER ICI QUE CE QUI EST VRAI PAR CONSTRUCTION (règle du 10/08, réaffirmée le
          12/08) : ce que fait Soignect, les types de poste, le statut du territoire. Aucune
          caractérisation de marché — personne ici ne peut la sourcer. */}
      <div className="mt-12 border-t border-gray-100 pt-8 space-y-3 text-sm text-gray-400">
        <h2 className="text-base font-semibold text-gray-600">{bas.titre}</h2>
        {bas.paragraphes.map((x, i) => <p key={i}>{x}</p>)}
        {/* La même page sur les autres territoires — dérivée du registre : un département ouvert y
            paraît sans qu'on ait à l'ajouter ici. */}
        {ailleurs.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            <span>Aussi sur Soignect :</span>
            {ailleurs.map((x, i) => (
              <span key={x.territoire.slug} className="flex gap-2">
                {i > 0 && <span>·</span>}
                <Link href={cheminPage(x.porte, x.profession, x.territoire)} className="underline hover:text-kine-600">{x.territoire.nom}</Link>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
