// Conseil du jour (04/11, ROADMAP « Splash screen avec tip aléatoire », demandé le 21/09).
//
// Une fois par jour, à l'ouverture de l'écran principal, un conseil sur une fonction réelle du
// produit. Les 30 conseils rédigés le 21/09 n'ont jamais été versés au dépôt ; ceux-ci sont
// réécrits À PARTIR DU CODE, chacun vérifié sur un écran existant au 04/11 (règle de la stratégie
// marketing § 8 : rien n'affirme ce qui n'a pas été vérifié). Un conseil qui deviendrait faux se
// retire ici — c'est la seule liste.

export type Public = "tous" | "candidat" | "recruteur" | "cabinet" | "etablissement";

export interface Conseil {
  id: string;
  pour: Public;
  texte: string;
  lien?: { libelle: string; href: string };
}

export const CONSEILS: Conseil[] = [
  // ── Pour tous ──
  { id: "ecartes", pour: "tous", texte: "Passé une carte trop vite ? Rien n'est perdu : tout ce que vous avez écarté se retrouve, et se remet dans votre fil d'un clic. Personne n'a été prévenu.", lien: { libelle: "Voir ce que j'ai écarté", href: "/ecartes" } },
  { id: "contrats", pour: "tous", texte: "Vos contrats signés ou en cours de signature sont réunis au même endroit, avec le PDF officiel de chacun.", lien: { libelle: "Mes contrats", href: "/contrats" } },
  { id: "clavier", pour: "tous", texte: "Sur ordinateur, les flèches du clavier décident pour vous : ← pour passer, → pour dire que vous êtes intéressé. Échap ferme une fiche." },
  { id: "pass-discret", pour: "tous", texte: "Passer une carte n'envoie rien à personne. Seul « Intéressé » se voit — et une mise en relation naît quand l'intérêt est réciproque." },
  { id: "score", pour: "tous", texte: "Le score de compatibilité compare vos dates et vos critères. Il ne dépend d'aucun abonnement." },
  { id: "silence", pour: "tous", texte: "Une mise en relation en attente, sans aucun échange depuis 12 jours, reçoit un préavis ; elle expire trois jours plus tard. Un seul message suffit à la garder vivante.", lien: { libelle: "Mes mises en relation", href: "/matches" } },
  { id: "termes-figes", pour: "tous", texte: "La première signature fige les termes du contrat : l'autre partie signe exactement ce que vous avez relu, et le PDF officiel est le même pour les deux." },
  { id: "signature", pour: "tous", texte: "À la signature d'un contrat, vous pouvez enregistrer votre signature pour les suivants. Elle reste privée, et se retire depuis la page de n'importe quel contrat." },
  { id: "identite", pour: "tous", texte: "Renseignez une fois pour toutes votre identité contractuelle (RPPS et n° d'Ordre, ou SIRET pour un établissement, et adresse) : elle remplit vos contrats automatiquement.", lien: { libelle: "Mon compte", href: "/compte" } },
  { id: "cloche", pour: "tous", texte: "La cloche en haut de l'écran rassemble ce qui vous concerne : nouveaux messages, mises en relation, signatures, consultations de votre annonce." },
  { id: "colonne", pour: "tous", texte: "La colonne de l'écran principal garde ce qui vit : une mise en relation sans échange depuis 7 jours la quitte, mais reste toujours dans « Mes mises en relation »." },
  { id: "autre-ile", pour: "tous", texte: "Vous pouvez voir aussi les annonces de l'autre île depuis votre compte, sans changer de territoire.", lien: { libelle: "Mon compte", href: "/compte" } },

  // ── Candidats ──
  { id: "publier", pour: "candidat", texte: "Les cabinets voient des disponibilités, pas des profils : tant que vous n'avez pas publié la vôtre, vous n'apparaissez dans aucun fil.", lien: { libelle: "Publier ma disponibilité", href: "/disponibilites/create" } },
  { id: "long-terme", pour: "candidat", texte: "Vous cherchez à vous installer durablement ? Une disponibilité sans date de fin vous présente aux cabinets qui recrutent un assistant ou un collaborateur.", lien: { libelle: "Mes disponibilités", href: "/disponibilites" } },
  { id: "salariat", pour: "candidat", texte: "Le fil montre aussi les postes salariés des établissements (badge « Poste salarié »). Dites dans votre compte si vous y êtes ouvert : les établissements le verront.", lien: { libelle: "Mon compte", href: "/compte" } },
  { id: "toujours-interesse", pour: "candidat", texte: "Sans réponse d'un cabinet ? Depuis « Vos choix », vous pouvez lui signaler à nouveau que vous vous intéressez toujours à son annonce." },
  { id: "tout-poste", pour: "candidat", texte: "Un cabinet peut vous proposer un autre type de poste que celui que vous cherchez — un assistanat à la place d'un remplacement, par exemple. Le contrat suit l'annonce de celui qui propose." },

  // ── Recruteurs (cabinets et établissements) ──
  { id: "vous-attendent", pour: "recruteur", texte: "« Vous attendent » liste les candidats qui ont retenu une de vos annonces. Mettez-les en relation d'un clic, ou déclinez : ils ne sont pas prévenus." },
  { id: "chips", pour: "recruteur", texte: "Les pastilles en haut du fil correspondent à vos annonces : en choisir une montre les candidats compatibles avec ses dates." },
  { id: "liste", pour: "recruteur", texte: "La vue Liste classe les candidats par compatibilité de dates avec l'annonce choisie, la plus forte en premier — pratique pour comparer d'un coup d'œil." },
  { id: "proposer-autre", pour: "recruteur", texte: "Un candidat qui cherche un remplacement peut se voir proposer votre assistanat ou votre poste durable : sa carte le rappelle, le contrat suit votre annonce." },
  { id: "planning", pour: "recruteur", texte: "Le Planning montre vos postes dans le temps : ce qui est pourvu, ce qui est en recherche, et vos absences.", lien: { libelle: "Ouvrir le Planning", href: "/planning" } },

  // ── Cabinets ──
  { id: "contrat-direct", pour: "cabinet", texte: "Vous avez déjà trouvé votre remplaçant hors de Soignect ? « Faire un contrat » vous permet quand même d'établir le contrat ici, avec un confrère que vous invitez." },

  // ── Établissements ──
  { id: "ouvert-salariat", pour: "etablissement", texte: "Sur la carte d'un candidat, « Ouvert·e au salariat » signale qu'il a dit accepter un poste salarié. Les autres restent visibles : vous pouvez leur proposer votre poste." },
];

/** Le public d'un lecteur, d'après son profil. */
export function publicDe(profil: { type?: string | null; titulaireKind?: string | null }): Exclude<Public, "tous" | "recruteur"> {
  if (profil.type !== "TITULAIRE") return "candidat";
  return profil.titulaireKind === "STRUCTURE" ? "etablissement" : "cabinet";
}

/** Les conseils qui concernent ce public. */
export function conseilsPour(p: ReturnType<typeof publicDe>): Conseil[] {
  return CONSEILS.filter((c) => c.pour === "tous" || c.pour === p || (c.pour === "recruteur" && p !== "candidat"));
}
