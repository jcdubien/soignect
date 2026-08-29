/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { type ContractDataSalarie, SIGNATURE_LEGAL_MENTION } from "./types";
import { DraftWatermark } from "./watermark";
import { PartyIdentityRows } from "./party-identity";

// ⚠️ CE GABARIT N'EST PAS LA TRANSCRIPTION D'UN MODÈLE OFFICIEL.
//
// Le CNOMK ne publie AUCUN contrat-type de CDI pour un masseur-kinésithérapeute
// salarié — vérifié le 28/08 sur les 23 documents de contrats.ordremk.fr, sur
// ses pages de catégorie, et sur les recherches internes des deux domaines.
// Les seuls fichiers « CDI » de l'Ordre concernent l'activité physique adaptée,
// dont le salarié n'est pas un kinésithérapeute.
//
// Ce document est COMPOSÉ : clauses déontologiques reprises du contrat-type de
// remplacement CNOMK (28/03/2023) là où elles sont générales, et dispositions
// standard du droit du travail pour ce qui relève du CDI.
//
// CE QUI N'A PAS ÉTÉ REPRIS, et pourquoi : R.4321-107 al. 3 (cessation
// d'activité du remplacé) et R.4321-130 (non-installation après remplacement)
// sont déclenchés par l'acte de remplacer. Sans objet ici.
//
// CONSÉQUENCE : la clause de non-concurrence ne peut plus s'appuyer sur
// R.4321-130. Elle relève du droit du travail, qui impose une contrepartie
// financière à peine de nullité — elle n'est donc pas facultative ici.
//
// À FAIRE VALIDER PAR UN AVOCAT avant tout usage réel.
//
// ── Deux précisions de méthode ───────────────────────────────────────────────
//
// D'OÙ VIENNENT LES ARTICLES. L'ossature suit celle du CDI infirmier du CNOI
// (15/11/2023) — secret professionnel, DPC, obligation d'assurance, résolution
// des différends, protection sociale détaillée. Décision du 28/08 : ces articles
// sont du texte fixe déontologique déjà vérifié sur une source officielle, et
// leur substance ne dépend pas de l'ordre professionnel. Le vocabulaire, lui,
// est celui du CNOMK.
//
// LES TROIS CLAUSES DÉONTOLOGIQUES CONSERVÉES du modèle kiné sont celles dont le
// texte ne mentionne aucun remplacement : inscription au tableau de l'Ordre,
// absence de contre-lettre, et communication à l'Ordre (L.4113-9, qui vise « le
// présent contrat ainsi que tout avenant » — la portée est le contrat, pas le
// mode d'exercice).

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, paddingTop: 50, paddingBottom: 60, paddingHorizontal: 55, lineHeight: 1.5, color: "#1a1a1a" },
  header: { textAlign: "center", marginBottom: 14 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 2 },
  version: { fontSize: 8, color: "#888" },
  // Avertissement IMPRIMÉ DANS LE DOCUMENT, pas seulement en commentaire de code : c'est le PDF
  // qui est signé, et c'est lui qui doit porter le fait qu'aucun modèle d'Ordre ne le couvre.
  avertissement: { borderWidth: 1, borderColor: "#b45309", backgroundColor: "#fffbeb", borderRadius: 3, padding: 9, marginBottom: 14 },
  avertTitre: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: "#92400e", marginBottom: 3 },
  avertTexte: { fontSize: 8.5, color: "#92400e", lineHeight: 1.5 },
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
  footer: { position: "absolute", bottom: 25, left: 55, right: 55, textAlign: "center", fontSize: 7.5, color: "#92400e", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 5 },
  pageNum: { position: "absolute", bottom: 12, right: 55, fontSize: 7.5, color: "#aaa" },
});

function fmtDate(iso: string | null): string {
  if (!iso) return "[date à compléter]";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Dates « jour seul » stockées à minuit UTC — formatées en UTC, sinon décalage d'un jour en
// fuseau négatif (Guadeloupe UTC−4). Un contrat est un document légal : le jour doit être exact.
function fmtDateUTC(iso: string | null): string {
  if (!iso) return "[date à compléter]";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// Mention de pied de page RENFORCÉE par rapport aux autres gabarits : ceux-là renvoient à un
// modèle d'Ordre, celui-ci n'en a aucun derrière lui.
const LEGAL_MENTION =
  "Document COMPOSÉ, sans modèle-type de l'Ordre — validation par un avocat indispensable avant signature.";

function Val({ v, fallback }: { v?: string | number | null; fallback: string }) {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s.length > 0 ? <Text>{s}</Text> : <Text style={S.placeholder}>{fallback}</Text>;
}

export function buildKineSalariatCdiPdf(data: ContractDataSalarie) {
  const {
    employeur, salarie, nature, temps, urssafVille, numeroSecuriteSociale,
    lieuTravail, periodeEssaiMois, remunerationBrutMensuelle,
    caisseRetraite, regimeFraisSante, regimePrevoyance, nonConcurrence,
    preavisJours, generatedAt, signatureTitulaireImg, signatureRemplacantImg, draft,
  } = data;

  const periodiciteLibelle = nonConcurrence.periodicite === "TRIMESTRIELLE" ? "trimestrielle" : "mensuelle";

  return (
    <Document title="Contrat de travail à durée indéterminée — masseur-kinésithérapeute" author="Soignect">
      <Page size="A4" style={S.page}>

        <View style={S.header}>
          <Text style={S.title}>Contrat de travail à durée indéterminée</Text>
          <Text style={S.subtitle}>Masseur-kinésithérapeute salarié</Text>
          <Text style={S.version}>Généré le {fmtDate(generatedAt)}</Text>
        </View>

        {/* L'avertissement est le PREMIER bloc du document, avant même les parties. Un lecteur
            qui signe doit savoir, avant de lire une clause, que ce texte n'émane d'aucun ordre. */}
        <View style={S.avertissement}>
          <Text style={S.avertTitre}>Document composé — aucun modèle-type de l'Ordre ne couvre ce cas</Text>
          <Text style={S.avertTexte}>
            Le Conseil national de l'ordre des masseurs-kinésithérapeutes ne publie pas de contrat-type
            de contrat à durée indéterminée pour un masseur-kinésithérapeute salarié. Les seuls modèles
            salariés qu'il diffuse concernent le remplacement (CDD) et l'activité physique adaptée, dont
            le salarié n'est pas masseur-kinésithérapeute.
            {"\n\n"}
            Le présent document a donc été composé à partir des clauses déontologiques confirmées du
            contrat-type de remplacement CNOMK du 28 mars 2023, lorsqu'elles sont générales, et des
            dispositions standard du droit du travail pour ce qui relève du contrat à durée indéterminée.
            {"\n\n"}
            Deux clauses du modèle de remplacement n'y figurent pas, faute d'objet : l'article R.4321-107
            alinéa 3 du code de la santé publique, qui impose au remplacé de cesser son activité, et
            l'article R.4321-130, dont l'interdiction de s'installer est déclenchée par l'acte de
            remplacer. La clause de non-concurrence ci-après relève par conséquent du seul droit du
            travail, qui exige une contrepartie financière à peine de nullité.
            {"\n\n"}
            Ce document ne vaut pas conseil juridique. Sa validation par un avocat est indispensable
            avant toute signature.
          </Text>
        </View>

        <View style={S.sectionTitle}><Text>Entre les soussignés</Text></View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>L'employeur :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{employeur.name || "[Nom de l'employeur]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{employeur.profession}</Text></View>
          <PartyIdentityRows party={employeur} />
        </View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le salarié :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{salarie.name || "[Nom du salarié]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{salarie.profession}</Text></View>
          <PartyIdentityRows party={salarie} />
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>N° de sécurité sociale :</Text>
            <Text style={S.infoVal}><Val v={numeroSecuriteSociale} fallback="[n° de sécurité sociale à compléter]" /></Text>
          </View>
        </View>

        <Text style={S.body}>Il a été convenu et arrêté ce qui suit :</Text>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 1er — Nature et objet du contrat</Text>
          <Text style={S.body}>
            Le présent contrat constitue un contrat de travail soumis aux dispositions du Code du travail.
            Chacune des parties demeure soumise aux règles déontologiques applicables à la profession de
            masseur-kinésithérapeute.
            {"\n\n"}
            L'employeur engage le salarié, qui l'accepte, en qualité de masseur-kinésithérapeute, pour une
            durée indéterminée. Il existe entre l'employeur et le salarié un lien de subordination : le
            salarié demeure soumis aux directives de son employeur pour ce qui relève de la gestion du
            cabinet, sans que cette subordination puisse s'étendre aux décisions de soins, qui relèvent de
            son indépendance professionnelle (article 8 ci-après).
            {"\n\n"}
            La déclaration préalable à l'embauche a été remise à l'URSSAF de{" "}
            <Val v={urssafVille} fallback="[ville de l'URSSAF à compléter]" />.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 2 — Engagement et inscription au tableau de l'Ordre</Text>
          <Text style={S.body}>
            Le salarié déclare être libre de tout engagement envers un précédent ou actuel employeur, et
            n'être soumis à aucune clause de non-concurrence.
            {"\n\n"}
            Le présent engagement est conclu sous réserve que le salarié soit dûment inscrit au tableau de
            l'ordre des masseurs-kinésithérapeutes et ne fasse l'objet d'aucune mesure de suspension ou
            d'interdiction d'exercice. Le salarié devra obligatoirement, lors de son embauche, transmettre
            son numéro d'inscription à l'Ordre à l'employeur, et l'informer sans délai de toute
            modification de sa situation ordinale.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 3 — Durée du contrat</Text>
          <Text style={S.body}>
            Le présent contrat est conclu pour une durée indéterminée. Il prend effet le{" "}
            {fmtDateUTC(nature.type === "CDI" ? nature.debut : null)}.
          </Text>
        </View>

        {periodeEssaiMois !== null && (
          <View style={S.article}>
            <Text style={S.articleTitle}>Article 4 — Période d'essai</Text>
            <Text style={S.body}>
              Le présent contrat ne deviendra définitif qu'à l'expiration d'une période d'essai fixée à{" "}
              {periodeEssaiMois} mois. Dans la mesure où cette période constitue une période de travail
              effectif, toute suspension du contrat en prolongera le terme d'une durée équivalente.
              {"\n\n"}
              Pendant cette période, chacune des parties pourra rompre le contrat dans le respect des
              délais de prévenance prévus par le Code du travail.
            </Text>
          </View>
        )}

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 5 — Lieu de travail</Text>
          <Text style={S.body}>
            Le salarié exercera ses fonctions au cabinet situé{" "}
            <Val v={lieuTravail} fallback="[adresse du lieu de travail à compléter]" />.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 6 — Temps de travail</Text>
          {temps.type === "COMPLET" ? (
            <Text style={S.body}>
              La durée de travail hebdomadaire du salarié est de {temps.heuresHebdomadaires} heures,
              réparties selon le planning établi par l'employeur dans le respect des durées maximales de
              travail et des temps de repos prévus par le Code du travail.
            </Text>
          ) : (
            <>
              <Text style={S.body}>
                Le salarié est engagé pour un horaire hebdomadaire de {temps.heuresHebdomadaires} heures,
                réparties comme suit :
              </Text>
              {temps.repartition.map((j) => (
                <Text key={j.jour} style={S.bullet}>
                  — {j.jour} : de {j.debut} à {j.fin}
                </Text>
              ))}
              <Text style={[S.body, { marginTop: 4 }]}>
                Cette répartition ne pourra être modifiée qu'après information du salarié sept jours
                ouvrés au moins avant la date à laquelle la modification devra prendre effet.
                {"\n\n"}
                Le salarié pourra être amené à effectuer des heures complémentaires dans la limite de{" "}
                {temps.heuresComplementairesMax} heures. Ces heures seront rémunérées conformément aux
                dispositions légales et ne pourront avoir pour effet de porter la durée du travail au
                niveau de la durée légale.
              </Text>
            </>
          )}
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 7 — Rémunération</Text>
          <Text style={S.body}>
            En contrepartie de son travail, le salarié percevra une rémunération mensuelle brute de{" "}
            <Val v={remunerationBrutMensuelle} fallback="[…]" /> euros, versée mensuellement.
            {"\n\n"}
            Les frais professionnels engagés par le salarié dans l'exercice de ses fonctions seront, sur
            justificatifs, pris en charge ou remboursés par l'employeur dans les conditions et limites
            fixées par ce dernier. Les déplacements professionnels effectués pour le compte de l'employeur
            ouvriront droit à une indemnité kilométrique correspondant au barème admis par
            l'administration fiscale, en fonction du véhicule utilisé.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 8 — Indépendance professionnelle</Text>
          <Text style={S.body}>
            Le lien de subordination prévu à l'article 1er ne saurait porter atteinte à l'indépendance
            professionnelle du salarié. Celui-ci conserve l'entière responsabilité de ses actes de soins
            et demeure soumis aux règles déontologiques de la profession.
            {"\n\n"}
            Le libre choix du praticien par le patient est respecté. Hors cas d'urgence et hors devoir
            d'humanité, si le salarié décide de ne pas effectuer des soins ou se trouve dans l'obligation
            de les interrompre, il se conforme aux règles applicables issues du Code de la santé publique.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 9 — Secret professionnel</Text>
          <Text style={S.body}>
            Le salarié est tenu au secret professionnel dans les conditions prévues par la loi. Cette
            obligation persiste après la cessation du présent contrat, quelle qu'en soit la cause.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 10 — Obligation de loyauté et cumul d'activités</Text>
          <Text style={S.body}>
            Le salarié s'engage à consacrer à son emploi le temps et le soin nécessaires, et à s'abstenir
            de tout acte de concurrence direct ou indirect au détriment de son employeur pendant
            l'exécution du contrat.
            {"\n\n"}
            Le salarié tient l'employeur informé de ses autres activités professionnelles. Tout cumul
            s'exerce dans le respect des durées maximales de travail prévues par le Code du travail et des
            règles déontologiques de la profession.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 11 — Absences et arrêts de travail</Text>
          <Text style={S.body}>
            En cas d'absence prévisible, le salarié devra solliciter l'accord préalable de l'employeur. En
            cas d'absence imprévisible, il devra informer ou faire informer l'employeur au plus tôt, et
            justifier de son absence dans les délais légaux.
            {"\n\n"}
            Les absences pour maladie ou accident, les congés de maternité et de paternité ouvrent droit
            aux garanties prévues par le Code du travail et, le cas échéant, par la convention collective
            applicable.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 12 — Congés payés</Text>
          <Text style={S.body}>
            Le salarié bénéficiera des congés payés dans les conditions prévues par le Code du travail.
            Les dates de congés seront fixées d'un commun accord entre les parties, dans le souci constant
            de répondre aux besoins de la patientèle, notamment en matière de continuité des soins.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 13 — Protection sociale</Text>
          <Text style={S.body}>
            Le salarié sera affilié à la caisse de retraite complémentaire{" "}
            <Val v={caisseRetraite} fallback="[caisse à compléter]" />, au régime de frais de santé géré
            par <Val v={regimeFraisSante} fallback="[organisme à compléter]" />, et au régime de
            prévoyance géré par <Val v={regimePrevoyance} fallback="[organisme à compléter]" />.
            {"\n\n"}
            Le salarié ne saurait se soustraire au bénéfice de ces prestations ni refuser d'acquitter la
            quote-part mise à sa charge, telles que ces prestations et cotisations sont actuellement
            prévues ou telles qu'elles pourraient résulter de modifications ultérieures des régimes.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 14 — Développement professionnel continu</Text>
          <Text style={S.body}>
            Le salarié satisfait à son obligation de développement professionnel continu et, le cas
            échéant, de certification périodique, dans les conditions prévues par le Code de la santé
            publique. Les parties s'entendront sur l'époque et la durée des absences consacrées à la
            formation.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 15 — Obligation d'assurance</Text>
          <Text style={S.body}>
            Le salarié apporte la preuve qu'il a contracté une police d'assurance responsabilité civile
            professionnelle. L'employeur justifie de sa propre couverture pour les activités exercées au
            sein du cabinet. Les attestations sont annexées au présent contrat.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 16 — Clause de non-concurrence</Text>
          <Text style={S.body}>
            Il est convenu, en raison des fonctions du salarié, qu'il ne pourra, sauf accord écrit de
            l'employeur, exercer sa profession pour son propre compte ou pour le compte d'autrui pendant
            une durée de {nonConcurrence.dureeMois} mois et dans un rayon de {nonConcurrence.rayonKm}{" "}
            kilomètres autour du cabinet.
            {"\n\n"}
            La clause trouvera à s'appliquer à compter de la rupture effective du contrat, et non en cas
            de rupture pendant la période d'essai.
            {"\n\n"}
            En contrepartie de cette obligation, le salarié percevra, après la cessation effective de son
            contrat de travail et pendant toute la durée de l'interdiction, une indemnité spéciale{" "}
            {periodiciteLibelle} et forfaitaire égale à {nonConcurrence.indemnitePct} % de la moyenne
            mensuelle du salaire brut perçu au cours de ses derniers mois de présence au cabinet. Cette
            contrepartie est soumise à cotisations sociales et contributions fiscales.
            {"\n\n"}
            L'employeur pourra renoncer à l'application de la présente clause, et se trouver ainsi libéré
            du versement de l'indemnité, par notification écrite adressée au salarié dans le délai prévu
            par la convention collective applicable ou, à défaut, dans un délai raisonnable suivant la
            notification de la rupture.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 17 — Rupture du contrat</Text>
          <Text style={S.body}>
            Le présent contrat pourra être rompu par l'une ou l'autre des parties dans les conditions
            prévues par le Code du travail, moyennant le respect d'un préavis de{" "}
            <Val v={preavisJours} fallback="[…]" /> jours, sauf faute grave ou lourde, ou dispense
            expresse de l'employeur.
            {"\n\n"}
            Les parties peuvent également convenir d'une rupture conventionnelle dans les conditions
            prévues par les articles L.1237-11 et suivants du Code du travail.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 18 — Résolution des différends</Text>
          <Text style={S.body}>
            En cas de difficultés soulevées sur la validité, l'exécution, l'interprétation ou la
            résolution du présent contrat, les parties s'engagent, préalablement à toute action
            contentieuse, à soumettre leur différend à une tentative de conciliation confiée au besoin au
            conseil départemental de l'ordre des masseurs-kinésithérapeutes, sans préjudice de la
            compétence du conseil de prud'hommes.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 19 — Absence de contre-lettre</Text>
          <Text style={S.body}>
            Les cocontractants certifient sur l'honneur qu'il n'existe aucune contre-lettre au présent
            contrat.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 20 — Communication à l'Ordre (art. L.4113-9)</Text>
          <Text style={S.body}>
            Conformément à l'article L.4113-9 du Code de la santé publique, le présent contrat ainsi que
            tout avenant sera communiqué par chaque partie au conseil départemental de l'ordre des
            masseurs-kinésithérapeutes dont elle relève, dans un délai d'un mois à compter de sa signature.
          </Text>
        </View>

        <View style={S.sigBlock}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>L'employeur</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{employeur.name || "[Nom de l'employeur]"}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            {signatureTitulaireImg ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- <Image> @react-pdf (PDF), pas une balise HTML img
              <Image style={S.sigImg} src={signatureTitulaireImg} />
            ) : (
              <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
            )}
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le salarié</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{salarie.name || "[Nom du salarié]"}</Text>
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
