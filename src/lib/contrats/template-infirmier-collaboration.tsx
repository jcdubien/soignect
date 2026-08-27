/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { type ContractDataCollaborationInfirmier, SIGNATURE_LEGAL_MENTION } from "./types";
import { DraftWatermark } from "./watermark";
import { PartyIdentityRows } from "./party-identity";

// CONTRAT DE COLLABORATION LIBÉRALE ENTRE INFIRMIERS.
// Transcrit du modèle du Conseil national de l'Ordre des infirmiers, mis à jour le 15/11/2023.
// Blocs « Commentaire : » du CNOI écartés (19 dans ce document).
//
// POURQUOI IL N'Y A PAS D'ASSISTANAT INFIRMIER, ET POURQUOI ÇA SE LIT ICI
// L'assistant renonce à se constituer une patientèle personnelle ; le collaborateur en a une.
// Chez les infirmiers, seul le second statut existe — l'Ordre ne publie aucun contrat
// d'assistanat, et pour cause : l'assistanat libéral n'est encadré par aucun texte, quand le
// collaborateur libéral tient son statut de la loi n°2005-882 du 2 août 2005 (art. 18) et de
// l'article R.4312-88 du Code de la santé publique. L'article 2 ci-dessous est exactement ce
// qui distingue les deux, et c'est le premier article de fond du contrat.
//
// LES SEPT ALTERNATIVES DU MODÈLE, tranchées par Jean-Charles les 27 et 28/08 :
//   • art. 2  — la clause facultative sur la réception des patients personnels EST incluse ;
//   • art. 3  — temps consacré « en vertu du planning établi en accord entre les parties »,
//               plutôt que « tout le temps nécessaire a minima » ou un nombre de journées ;
//   • art. 4  — individualisation incluse, avec dispositions en TEXTE LIBRE plutôt que les
//               critères détaillés proposés en variante, et recensement TRIMESTRIEL ;
//   • art. 6.2 — le partage des forfaits n'est PAS figé : il est choisi à la génération parmi
//               les trois modes du modèle (voir plus bas) ;
//   • art. 7  — redevance en POURCENTAGE du chiffre d'affaires, plutôt qu'un montant fixe ;
//   • art. 14 — contrat à durée DÉTERMINÉE, la variante indéterminée étant écartée ;
//   • art. 16 — résiliation SANS PRÉAVIS dans les deux cas (faute grave, puis
//               déconventionnement ou sanction disciplinaire).
//
// LE PARTAGE DES FORFAITS EST LE SEUL CHOIX LAISSÉ AU CONTRAT, et c'est délibéré. Les trois
// modes — à tour de rôle, à parts égales, au prorata de la charge de travail — décrivent des
// organisations de cabinet réellement différentes ; aucun n'est un défaut raisonnable pour les
// deux autres. Le figer aurait imposé une organisation à des parties qui n'en ont pas convenu.
//
// L'ARTICLE 6.2 EST PROPRE AUX INFIRMIERS et n'a aucun équivalent côté kiné : les forfaits de
// prise en charge (art. L.4312-15 CSP) sont une particularité de leur nomenclature. C'est la
// raison pour laquelle `ContractDataCollaborationInfirmier` ne réutilise pas le type kiné.
//
// LES CLAUSES MARQUÉES « clause réglementaire » portent un astérisque dans le modèle : clauses
// essentielles « auxquelles il n'est pas possible de déroger » (art. R.4312-73 CSP).

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, paddingTop: 50, paddingBottom: 60, paddingHorizontal: 55, lineHeight: 1.5, color: "#1a1a1a" },
  header: { textAlign: "center", marginBottom: 18 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 2 },
  version: { fontSize: 8, color: "#888" },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, textTransform: "uppercase", marginTop: 14, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: "#333", paddingBottom: 2 },
  article: { marginBottom: 8 },
  articleTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 3 },
  body: { fontSize: 9.5, lineHeight: 1.6 },
  bullet: { fontSize: 9.5, lineHeight: 1.6, marginLeft: 10, marginBottom: 2 },
  infoBox: { backgroundColor: "#f5f5f5", borderWidth: 0.5, borderColor: "#ccc", borderRadius: 3, padding: 8, marginBottom: 8, fontSize: 9 },
  infoRow: { flexDirection: "row", marginBottom: 2 },
  infoLabel: { fontFamily: "Helvetica-Bold", width: 140 },
  infoVal: { flex: 1 },
  placeholder: { color: "#b45309", fontFamily: "Helvetica-Bold" },
  sigBlock: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  sigCol: { width: "45%", borderTopWidth: 0.5, borderTopColor: "#555", paddingTop: 6 },
  sigLabel: { fontSize: 8.5, color: "#555" },
  sigImg: { height: 45, marginTop: 4, objectFit: "contain" },
  eidas: { marginTop: 18, fontSize: 7.5, color: "#777", fontFamily: "Helvetica-Oblique", lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 25, left: 55, right: 55, textAlign: "center", fontSize: 7.5, color: "#888", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 5 },
  pageNum: { position: "absolute", bottom: 12, right: 55, fontSize: 7.5, color: "#aaa" },
});

function fmtDate(iso: string | null): string {
  if (!iso) return "[date à compléter]";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function fmtDateUTC(iso: string | null): string {
  if (!iso) return "[date à compléter]";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const LEGAL_MENTION =
  "Document pré-rempli à titre indicatif — à faire valider par un avocat ou l'Ordre des infirmiers avant signature.";

function Val({ v, fallback }: { v?: string | number | null; fallback: string }) {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s.length > 0 ? <Text>{s}</Text> : <Text style={S.placeholder}>{fallback}</Text>;
}

export function buildCollaborationInfirmierPdf(data: ContractDataCollaborationInfirmier) {
  const {
    titulaire, collaborateur, startDate, dureeMois, renouvellementsMax, dureeMaxMois,
    redevancePct, jourVersementRedevance, moyensMisADisposition, recensementDispositions,
    forfaitPartage, forfaitRepartition, forfaitDelaiReversementJours,
    periodeEssaiMois, preavisEssaiJours, dureeInformationSollicitation,
    generatedAt, signatureTitulaireImg, signatureRemplacantImg, draft,
  } = data;

  return (
    <Document title="Contrat de collaboration libérale infirmier" author="Soignect">
      <Page size="A4" style={S.page}>

        <View style={S.header}>
          <Text style={S.title}>Contrat de collaboration libérale</Text>
          <Text style={S.subtitle}>Entre infirmiers</Text>
          <Text style={S.subtitle}>Infirmiers — modèle CNOI (15/11/2023)</Text>
          <Text style={S.version}>Généré le {fmtDate(generatedAt)}</Text>
        </View>

        <View style={S.sectionTitle}><Text>Entre les soussignés</Text></View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le titulaire :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{titulaire.name || "[Nom du titulaire]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{titulaire.profession}</Text></View>
          <PartyIdentityRows party={titulaire} />
        </View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le collaborateur :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{collaborateur.name || "[Nom du collaborateur]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{collaborateur.profession}</Text></View>
          <PartyIdentityRows party={collaborateur} />
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Préambule (clause réglementaire)</Text>
          <Text style={S.body}>
            Vu les dispositions du Code de la santé publique ;
            {"\n\n"}
            Vu les dispositions de la loi n°2005-882 du 2 août 2005 en faveur des petites et moyennes
            entreprises, et notamment son article 18 modifié par l'article 94 de la loi n°2021-1754 du
            23 décembre 2021 de financement de la sécurité sociale pour 2022 ;
            {"\n\n"}
            Vu les dispositions des articles 1er à 4 et des articles 7 à 10 de la loi n°2008-496 du
            27 mai 2008 portant diverses dispositions d'adaptation au droit communautaire dans le domaine
            de la lutte contre les discriminations, qui s'appliquent à tout contrat de collaboration
            libérale, y compris lors de sa rupture.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 1er — Objet du contrat</Text>
          <Text style={S.body}>
            Le Titulaire et le Collaborateur conviennent, pour l'exercice libéral de leur profession, de
            conclure le présent contrat de collaboration libérale ayant pour objet de définir les modalités
            d'une collaboration confraternelle et loyale, exclusive de tout lien de subordination entre les
            parties co-contractantes.
            {"\n\n"}
            La possibilité de développer sa patientèle personnelle laissée au Collaborateur est précisée à
            l'article 2 du présent contrat.
            {"\n\n"}
            Il est convenu que les parties pourront adapter les objectifs du contrat au cours de son
            exécution.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 2 — Développement de la patientèle propre au collaborateur (clause réglementaire)</Text>
          <Text style={S.body}>
            Dans le cadre de cette collaboration libérale, le Titulaire accorde au Collaborateur le temps
            et les moyens nécessaires à la constitution d'une patientèle qui lui sera personnelle.
            {"\n\n"}
            Progressivement et en complément de la prise en charge de la patientèle du Titulaire, le
            Collaborateur pourra ainsi satisfaire aux besoins de sa patientèle propre.
            {"\n\n"}
            Le Collaborateur pourra recevoir ses patients personnels au cabinet. Les parties pourront
            notamment prévoir des précisions sur les locaux et moyens mis à disposition (salle d'attente,
            secrétariat, accès internet…), le cas échéant des précisions sur le personnel mis à
            disposition, ainsi qu'un calendrier comprenant les plages horaires réservées à la patientèle
            du Collaborateur.
            {"\n\n"}
            Les coordonnées et la qualité du Collaborateur pourront figurer sur les documents, y compris
            électroniques (site internet), du cabinet. Le Collaborateur pourra apposer sa plaque
            professionnelle à l'adresse professionnelle.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 3 — Obligations des parties</Text>
          <Text style={S.body}>
            Le Titulaire s'engage à apporter au Collaborateur information et aide, tant dans l'exercice
            libéral de sa profession que pour la gestion du cabinet.
            {"\n\n"}
            Le Collaborateur s'engage à consacrer à la présente collaboration libérale et à la patientèle
            du Titulaire le temps prévu en vertu du planning de travail établi en accord entre les parties.
            {"\n\n"}
            Le Collaborateur tient informé le Titulaire de ses autres activités professionnelles.
            {"\n\n"}
            Il pourra, après information préalable du Titulaire, conclure un autre contrat de collaboration
            libérale dans le respect notamment des articles R.4312-25, R.4312-72 et R.4312-82 du Code de la
            santé publique.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 4 — Individualisation de la patientèle</Text>
          <Text style={S.body}>
            Les parties procèdent conjointement au recensement de leur patientèle respective. Elles en
            tiennent un état cosigné et l'actualisent régulièrement.
            {"\n\n"}
            À l'issue du présent contrat, au moment de la répartition de la patientèle, les parties se
            réfèrent au dernier recensement réalisé.
            {"\n\n"}
            Les parties procèdent trimestriellement et conjointement à un recensement de leur patientèle
            respective selon les dispositions suivantes :{" "}
            <Val v={recensementDispositions} fallback="[dispositions à préciser en fonction des modalités pratiques d'exercice et/ou des contraintes de secret professionnel]" />
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 5 — Lieu d'exercice professionnel</Text>
          <Text style={S.body}>
            Le cabinet où le Titulaire exerce son activité est situé à l'adresse professionnelle indiquée
            ci-dessus. Dans le cadre de la présente collaboration libérale, le Collaborateur exerce son
            activité à cette même adresse.
            {"\n\n"}
            Le Titulaire met à la disposition du Collaborateur l'ensemble des moyens de son lieu
            d'exercice —{" "}
            <Val v={moyensMisADisposition} fallback="[moyens mis à disposition à préciser]" /> — de telle
            façon que chacun puisse exercer sa profession dans les meilleures conditions matérielles.
            {"\n\n"}
            Le Titulaire permet et facilite au Collaborateur l'accès aux dossiers de ses patients que ce
            dernier est amené à suivre dans le cadre de la présente collaboration libérale.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 6 — Honoraires et forfaits (clause réglementaire)</Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 4 }]}>Article 6.1 — Honoraires</Text>
          <Text style={S.body}>
            Le Collaborateur signe personnellement ses feuilles de soins ainsi que tous les documents
            nécessaires à la prise en charge des actes réalisés, aussi bien auprès de sa patientèle
            personnelle que des patients du Titulaire. Chacun des co-contractants perçoit directement ses
            honoraires.
          </Text>

          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 6 }]}>Article 6.2 — Forfaits de prise en charge des patients</Text>
          <Text style={S.body}>
            Conformément à l'article L.4312-15 du Code de la santé publique, le Titulaire et le
            Collaborateur peuvent percevoir une rémunération forfaitaire par patient sans que ce partage
            puisse être assimilé à un partage illicite d'honoraires ou à du compérage.
            {"\n\n"}
            En cas de prise en charge du patient en commun, le forfait journalier est facturé par l'un des
            cocontractants. L'infirmier ayant facturé le forfait journalier devra rétrocéder la partie des
            honoraires correspondant aux soins réalisés par le ou les autres cocontractants ayant également
            pris en charge le patient le même jour, selon les modalités suivantes :
          </Text>
          {/* Mode de partage choisi à la génération — voir l'en-tête de fichier. */}
          {forfaitPartage === "TOUR_DE_ROLE" && (
            <Text style={[S.body, { marginTop: 4 }]}>
              Le forfait journalier est facturé et perçu à tour de rôle au regard du planning.
            </Text>
          )}
          {forfaitPartage === "PARTS_EGALES" && (
            <Text style={[S.body, { marginTop: 4 }]}>
              Le forfait journalier est partagé par parts égales.
            </Text>
          )}
          {forfaitPartage === "CHARGE_TRAVAIL" && (
            <Text style={[S.body, { marginTop: 4 }]}>
              Le forfait est partagé selon la charge de travail de chacun et suivant les pourcentages
              suivants :{" "}
              <Val v={forfaitRepartition} fallback="[répartition en pourcentages par praticien à compléter]" />
            </Text>
          )}
          <Text style={[S.body, { marginTop: 4 }]}>
            Il sera tenu un suivi précis des facturations afin de s'assurer de la stricte équité des
            parties au regard des remboursements de l'Assurance Maladie. Il est convenu entre les parties
            qu'un suivi partagé et transparent des soins réalisés sera tenu et mis à la disposition de
            chacune d'elles.
            {"\n\n"}
            Le partage ainsi prévu peut faire l'objet de modification par avenant au présent contrat,
            notamment en cas de changement de planning des prises en charge.
            {"\n\n"}
            Pour chaque passage dans la journée, chacun des infirmiers facture personnellement les
            majorations, les frais de déplacement et les actes techniques autorisés en association du
            forfait.
            {"\n\n"}
            La partie ayant perçu le forfait reversera à chacune des parties leur part déterminée ci-dessus
            dans un délai de <Val v={forfaitDelaiReversementJours} fallback="[…]" /> jours à compter de la
            perception du forfait.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 7 — Redevance de collaboration (clause réglementaire)</Text>
          <Text style={S.body}>
            Le Collaborateur verse mensuellement au Titulaire une redevance d'un montant équivalant à{" "}
            {redevancePct} % de son chiffre d'affaires, correspondant aux frais professionnels (mise à
            disposition du local, du petit matériel, des moyens de communication, etc.) pris en charge par
            le Titulaire.
            {"\n\n"}
            Ces frais sont justifiés par la présentation de documents comptables et cette redevance est
            soumise à un réexamen annuel.
            {"\n\n"}
            Le versement du montant total de cette redevance devra intervenir avant le{" "}
            <Val v={jourVersementRedevance} fallback="[…]" /> du mois suivant.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 8 — Indépendance professionnelle et respect des règles professionnelles</Text>
          <Text style={S.body}>
            Les parties co-contractantes demeurent chacune entièrement soumises à l'ensemble des règles
            professionnelles applicables à la profession d'infirmier.
            {"\n\n"}
            Elles exercent chacune leur profession en pleine indépendance et veillent à ce que le libre
            choix du patient soit respecté.
            {"\n\n"}
            Hors cas d'urgence et celui où elle manquerait à ses devoirs d'humanité, si l'une d'entre elles
            décide de ne pas effectuer des soins ou se trouve dans l'obligation de les interrompre, pour
            raisons professionnelles ou personnelles, elle doit se conformer à l'ensemble des règles
            applicables issues du Code de la santé publique.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 9 — Obligation d'assurance — charges fiscales</Text>
          <Text style={S.body}>
            Le Collaborateur apporte la preuve qu'il a contracté une police d'assurance responsabilité
            civile professionnelle avant le début de son activité. Une attestation est annexée au présent
            contrat.
            {"\n\n"}
            Les deux parties co-contractantes procéderont à des déclarations fiscales et sociales
            indépendantes et supporteront, chacune en ce qui la concerne, la totalité de leurs charges
            sociales et fiscales afférentes à leur exercice professionnel.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 10 — Planning de travail / congés</Text>
          <Text style={S.body}>
            La répartition du temps de travail ainsi que la détermination des dates et des durées des
            congés seront établies d'un commun accord entre les parties co-contractantes et, le cas
            échéant, au sein d'un règlement intérieur établi postérieurement au présent contrat.
            {"\n\n"}
            Elles s'effectueront dans le souci constant de répondre aux besoins de la patientèle, notamment
            en matière de continuité des soins.
            {"\n\n"}
            De même, le Titulaire et le Collaborateur s'entendront sur l'époque et la durée des absences
            consacrées à leur formation.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 11 — Maternité / paternité (clause réglementaire)</Text>
          <Text style={S.body}>
            La collaboratrice libérale en état de grossesse médicalement constaté a le droit de suspendre
            sa collaboration pendant au moins seize semaines à l'occasion de l'accouchement.
            {"\n\n"}
            Le père collaborateur libéral, le conjoint collaborateur libéral de la mère, la personne
            collaboratrice libérale liée à elle par un pacte civil de solidarité ou vivant maritalement
            avec elle, a le droit de suspendre la collaboration pendant vingt-cinq jours consécutifs
            suivant la naissance de l'enfant, et jusqu'à trente-deux jours en cas de naissances multiples.
            Le collaborateur libéral souhaitant suspendre le contrat en informe le titulaire avec qui il
            collabore au moins un mois avant le début de la suspension.
            {"\n\n"}
            Dans l'hypothèse de l'adoption d'un enfant, le collaborateur a le droit de suspendre la
            collaboration pendant une durée de seize semaines à compter de l'arrivée de l'enfant au foyer.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 12 — Maladie (clause réglementaire)</Text>
          <Text style={S.body}>
            En cas de maladie, le Collaborateur doit pourvoir, avec l'agrément du Titulaire, à son
            remplacement pendant la durée du congé de maladie, conformément aux dispositions des articles
            R.4312-83 et suivants du Code de la santé publique. Après deux refus successifs du Titulaire,
            le Collaborateur pourra librement choisir son remplaçant.
            {"\n\n"}
            À dater de la justification par le Collaborateur de sa maladie auprès du Titulaire et jusqu'à
            son retour au cabinet, le contrat de collaboration ne peut être rompu pour ce motif.
            {"\n\n"}
            Dans l'hypothèse où le Collaborateur sera remplacé, il demeurera assujetti à la redevance
            prévue à l'article 7 du présent contrat.
            {"\n\n"}
            Lorsque le Collaborateur n'a pas la capacité de trouver un remplaçant, il revient au Titulaire
            qui continue d'exercer d'aider son confrère dans sa démarche.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 13 — Information des patients</Text>
          <Text style={S.body}>
            À l'occasion des demandes de rendez-vous, les patients sont informés de la présence d'un
            collaborateur libéral et des jours et heures de son exercice.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 14 — Durée du contrat (clause réglementaire)</Text>
          <Text style={S.body}>
            Le présent contrat est conclu à compter du {fmtDateUTC(startDate)} pour une durée de{" "}
            <Val v={dureeMois} fallback="[…]" /> mois, renouvelable{" "}
            <Val v={renouvellementsMax} fallback="[…]" /> fois dans la limite d'une durée maximale de{" "}
            <Val v={dureeMaxMois} fallback="[…]" /> mois.
            {"\n\n"}
            Le contrat ne peut, en tout état de cause, être reconduit par tacite reconduction.
            {"\n\n"}
            Un avenant au contrat cosigné entre les parties devra être établi au plus tard au jour du terme
            du présent contrat, s'il y a lieu, pour une nouvelle période d'activité du Collaborateur.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 15 — Période d'essai</Text>
          <Text style={S.body}>
            Les <Val v={periodeEssaiMois} fallback="[…]" /> premiers mois de la collaboration libérale sont
            considérés comme une période d'essai à laquelle il peut être mis fin par la volonté de l'une ou
            l'autre des parties, sous réserve du respect d'un délai de préavis de{" "}
            <Val v={preavisEssaiJours} fallback="[…]" /> jours.
            {"\n\n"}
            Les modalités de rupture de la période d'essai par l'une ou l'autre des parties relèvent de
            l'application de l'article 16 du contrat.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 16 — Résiliation (clause réglementaire)</Text>
          <Text style={S.body}>
            Le présent contrat prend fin au terme visé à l'article 14, à défaut de reconduction expresse
            par les parties co-contractantes.
            {"\n\n"}
            Le présent contrat prend fin à tout moment d'un commun accord entre les parties. Un document
            cosigné par les parties en prend acte.
            {"\n\n"}
            En cas de faute grave dans l'exécution du présent contrat, il peut y être mis fin, par l'une ou
            l'autre des parties, par lettre recommandée avec accusé de réception, sans préavis. Ce courrier
            devra comporter les motifs de la rupture.
            {"\n\n"}
            Il peut également être mis fin au présent contrat par lettre recommandée avec accusé de
            réception, sans préavis, en cas de déconventionnement d'une durée égale ou supérieure à trois
            mois, ou en cas de sanction disciplinaire définitive de l'une ou de l'autre des parties lui
            interdisant d'exercer pendant une période égale ou supérieure à trois mois.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 17 — Présentation préférentielle</Text>
          <Text style={S.body}>
            La cessation d'activité du Titulaire met fin au présent contrat. En cas de cessation d'activité,
            le Titulaire s'engage alors à proposer en priorité au Collaborateur de lui succéder, sous
            réserve du principe de libre choix des patients.
            {"\n\n"}
            Si le Titulaire souhaite s'associer en cours d'exécution du présent contrat, il proposera
            prioritairement au Collaborateur d'intégrer le cabinet dans le cadre d'une association.
            {"\n\n"}
            En cas de décès ou de longue maladie de l'une ou l'autre des parties, le contrat prend fin. Le
            Titulaire, ou ses ayants droit en cas de décès, propose en priorité au Collaborateur de
            succéder au titulaire dans l'exercice de son activité, sous réserve du respect du principe de
            libre choix des patients.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 18 — Loyauté et absence de concurrence déloyale (art. R.4312-82)</Text>
          <Text style={S.body}>
            À l'issue du présent contrat, le Collaborateur conserve sa liberté d'installation et peut
            notamment continuer d'exercer sa profession auprès de sa patientèle propre.
            {"\n\n"}
            Toutefois, il s'interdit tout acte de concurrence déloyale, de démarchage et de détournement de
            la patientèle du Titulaire, conformément à l'article R.4312-82 du Code de la santé publique.
            {"\n\n"}
            Dans le respect du principe du libre choix du professionnel de santé par le patient, le
            Collaborateur s'engage à informer le Titulaire de toute sollicitation de la part de l'un de ses
            patients pendant une durée de{" "}
            <Val v={dureeInformationSollicitation} fallback="[durée à compléter]" /> à compter du terme du
            présent contrat, pour quelque cause que ce soit.
            {"\n\n"}
            À l'issue du présent contrat, le Collaborateur informe sa patientèle personnelle de sa nouvelle
            installation et conserve le cas échéant le fichier qui y est afférent.
            {"\n\n"}
            Le Collaborateur dispose également, à l'issue du présent contrat, de la faculté de céder sa
            patientèle personnelle. Dans ce cas, il doit prioritairement proposer cette cession au
            Titulaire. En cas de refus de celui-ci, le Collaborateur pourra céder sa patientèle personnelle
            à une tierce personne.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 19 — Incessibilité</Text>
          <Text style={S.body}>
            Compte tenu du caractère intuitu personae attaché au présent contrat de collaboration libérale,
            celui-ci n'est pas cessible.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 20 — Résolution des différends (clause réglementaire — art. R.4312-25)</Text>
          <Text style={S.body}>
            En cas de difficultés soulevées sur la validité, l'exécution, l'interprétation ou la résolution
            du présent contrat, les parties s'engagent préalablement à toute action contentieuse à
            soumettre leur différend à une tentative de conciliation confiée au besoin au conseil
            (inter)départemental de l'ordre des infirmiers, conformément à l'article R.4312-25 alinéa 2 du
            Code de la santé publique.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 21 — Transmission à l'Ordre (art. L.4113-9)</Text>
          <Text style={S.body}>
            Conformément aux dispositions de l'article L.4113-9 du Code de la santé publique, ce contrat est
            communiqué par chacune des parties au Conseil (inter)départemental de l'Ordre des infirmiers du
            tableau duquel elles sont inscrites, dans un délai d'un mois à compter de sa signature.
            {"\n\n"}
            Les parties affirment sur l'honneur n'avoir passé aucune contre-lettre ou avenant relatif au
            présent contrat qui ne soit soumis au Conseil (inter)départemental de l'Ordre des infirmiers
            compétent.
          </Text>
        </View>

        <View style={S.sigBlock}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le titulaire</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{titulaire.name || "[Nom du titulaire]"}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            {signatureTitulaireImg ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- <Image> @react-pdf (PDF), pas une balise HTML img
              <Image style={S.sigImg} src={signatureTitulaireImg} />
            ) : (
              <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
            )}
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le collaborateur</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{collaborateur.name || "[Nom du collaborateur]"}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            {signatureRemplacantImg ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- <Image> @react-pdf (PDF), pas une balise HTML img
              <Image style={S.sigImg} src={signatureRemplacantImg} />
            ) : (
              <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
            )}
          </View>
        </View>

        {(signatureTitulaireImg || signatureRemplacantImg) && (
          <Text style={S.eidas}>{SIGNATURE_LEGAL_MENTION}</Text>
        )}

        <Text style={S.footer}>{LEGAL_MENTION}</Text>
        <Text style={S.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        <DraftWatermark draft={draft} />
      </Page>
    </Document>
  );
}
