/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { type ContractDataSalarieKineCdd, SIGNATURE_LEGAL_MENTION } from "./types";
import { DraftWatermark } from "./watermark";
import { PartyIdentityRows } from "./party-identity";
import { fmtDateUTC } from "@/lib/contrats/date";

// CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE POUR LE REMPLACEMENT D'UN MK LIBÉRAL (section 261).
//
// Dernier des quatre gabarits salariés. SOURCE : modèle du Conseil national de l'ordre des
// masseurs-kinésithérapeutes, 28 mars 2023 — 12 pages, 127 champs de formulaire, 20 articles.
//
// ── C'EST LE SEUL CONTRAT SALARIÉ KINÉ QUI EXISTE ────────────────────────────────────────────
//
// Vérifié trois fois le 28/08 : le CNOMK ne publie AUCUN CDI pour un kinésithérapeute salarié.
// Celui-ci, un CDD de remplacement, est le seul. C'est ce qui rend son voisin de fichier —
// `template-kine-salariat-cdi.tsx` — nécessairement COMPOSÉ, avec l'avertissement qui va avec.
// Ici, rien de tel : transcription d'un modèle officiel, pas de `composeSansModele`.
//
// ── CE MODÈLE N'EST PAS UNE VARIANTE DES CONTRATS INFIRMIERS ─────────────────────────────────
//
// Il en diffère par la structure, pas par le vocabulaire : 20 articles dans un autre ordre,
// aucune clause véhicule (le modèle traite les déplacements par une indemnité kilométrique
// inconditionnelle, article 7), et surtout une non-concurrence d'une AUTRE NATURE.
//
// ── LA NON-CONCURRENCE, ET POURQUOI SA DURÉE NE SE SAISIT PAS ────────────────────────────────
//
// Chez l'infirmier, la clause relève du seul droit du travail : durée et zone se négocient.
// Ici elle découle de l'article R.4321-130 du Code de la santé publique — le kiné qui a remplacé
// un confrère pendant au moins trois mois ne doit pas s'installer en concurrence directe pendant
// DEUX ANS. La durée est donc fixée par le code, et le gabarit l'imprime en toutes lettres.
// `nonConcurrence.dureeMois` du socle est sans effet ici ; l'exposer à la saisie aurait laissé
// croire qu'on peut en négocier une autre.
//
// Second écart, moins visible : l'indemnité due en cas de VIOLATION s'exprime en MOIS de
// rémunération brute, là où le modèle infirmier la fixe en euros. Convertir en euros pour
// réutiliser le champ existant aurait changé la clause.
//
// ── LES DEUX ARTICLES 5 ──────────────────────────────────────────────────────────────────────
//
// Le modèle publie deux versions de l'article 5, « pour un CDD à temps complet » et « pour un CDD
// à temps partiel », avec des clauses distinctes — délai de prévenance, heures complémentaires et
// leurs majorations. On en rend UNE, choisie par l'union `TempsDeTravail`. Rendre les deux, comme
// le fait le PDF de l'Ordre qu'on remplit à la main, produirait un contrat signé portant deux
// régimes horaires contradictoires.

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, paddingTop: 50, paddingBottom: 60, paddingHorizontal: 55, lineHeight: 1.5, color: "#1a1a1a" },
  header: { textAlign: "center", marginBottom: 14 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
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
  sigMention: { fontSize: 7.5, color: "#666", marginTop: 6, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 28, left: 55, right: 55, textAlign: "center", fontSize: 7.5, color: "#888", borderTopWidth: 0.5, borderTopColor: "#ddd", paddingTop: 5 },
});

function Val({ v, fallback }: { v?: string | number | null; fallback: string }) {
  const vide = v === null || v === undefined || v === "" || v === 0;
  return vide ? <Text style={S.placeholder}>{fallback}</Text> : <Text>{String(v)}</Text>;
}

export function buildKineSalariatCddPdf(d: ContractDataSalarieKineCdd) {
  const {
    employeur, salarie, nature, temps, urssafVille, lieuTravail, motifAbsence,
    dateDeclarationPrealable, conseilDepartemental, dureeMinimaleMois,
    periodeEssaiMois, remunerationBrutMensuelle, caisseRetraite, regimeFraisSante,
    regimePrevoyance, nonConcurrence, nonConcurrenceKine, indemnitePrecaritePct,
    generatedAt, signatureTitulaireImg, signatureRemplacantImg, draft,
  } = d;

  const remplace = employeur.name || "[le masseur-kinésithérapeute remplacé]";
  const remplacant = salarie.name || "[le remplaçant salarié]";

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {draft && <DraftWatermark />}

        <View style={S.header}>
          <Text style={S.title}>Contrat de travail à durée déterminée pour le remplacement d'un masseur-kinésithérapeute libéral</Text>
          <Text style={S.subtitle}>Modèle du Conseil national de l'ordre des masseurs-kinésithérapeutes</Text>
          <Text style={S.version}>Version du 28 mars 2023 · Généré le {fmtDateUTC(generatedAt)}</Text>
        </View>

        <View style={S.sectionTitle}><Text>Entre les soussignés</Text></View>
        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>L'employeur (masseur-kinésithérapeute remplacé) :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{remplace}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{employeur.profession}</Text></View>
          <PartyIdentityRows party={employeur} />
          <View style={S.infoRow}><Text style={S.infoLabel}>N° URSSAF :</Text><Text style={S.infoVal}>{urssafVille || "[URSSAF à compléter]"}</Text></View>
        </View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le salarié (masseur-kinésithérapeute remplaçant) :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{remplacant}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{salarie.profession}</Text></View>
          <PartyIdentityRows party={salarie} />
        </View>

        <Text style={[S.body, { fontFamily: "Helvetica-Bold", marginTop: 6 }]}>
          Il a été convenu ce qui suit :
        </Text>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 1er — Engagement, objet du contrat</Text>
          <Text style={S.body}>
            {remplacant} est engagé(e) en qualité de remplaçant(e) par {remplace}, sous réserve
            que {remplacant} soit dûment inscrit(e) au tableau de l'ordre des
            masseurs-kinésithérapeutes et ne fasse l'objet d'aucune mesure de suspension ou
            d'interdiction d'exercice.
            {"\n\n"}
            Ce contrat est conclu en vue d'assurer le remplacement temporaire de {remplace} pendant
            son absence pour cause de <Val v={motifAbsence} fallback="[motif de l'absence à compléter]" />.
            {"\n\n"}
            Ce contrat est conclu sous réserve des résultats de la première visite d'information et
            de prévention.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 2 — Fonctions et respect des règles de la profession</Text>
          <Text style={S.body}>
            {remplacant}, en sa qualité de remplaçant(e), exercera temporairement la profession de
            masseur-kinésithérapeute en lieu et place de {remplace} pendant la durée de son absence.
            {"\n\n"}
            Durant la durée du remplacement, {remplacant} s'engage à respecter les dispositions
            législatives et réglementaires relatives à l'exercice de sa profession et à faire en
            sorte que les patients bénéficient de soins consciencieux, éclairés, attentifs et
            prudents, conformes aux données acquises de la science.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 3 — Durée</Text>
          <Text style={S.body}>
            {nature.type === "CDD_TERME" ? (
              <>
                Cet engagement prend effet le {fmtDateUTC(nature.debut)} et se terminera le{" "}
                {fmtDateUTC(nature.fin)}. Il peut être renouvelé deux fois pour une durée déterminée
                qui, ajoutée à la durée du contrat initial, ne peut excéder 18 mois.
              </>
            ) : nature.type === "CDD_SANS_TERME" ? (
              <>
                {/* Le modèle kiné fait finir le contrat AU RETOUR du remplacé, là où l'infirmier
                    le fait finir à l'extinction du motif. Deux rédactions, deux transcriptions. */}
                Cet engagement prend effet le {fmtDateUTC(nature.debut)} pour une durée minimale de{" "}
                <Val v={dureeMinimaleMois} fallback="[durée minimale à compléter]" /> mois et prendra
                fin au retour de {remplace}.
              </>
            ) : (
              <Text style={S.placeholder}>
                [nature du contrat à déterminer — un contrat à durée indéterminée ne relève pas de ce modèle]
              </Text>
            )}
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 3.1 — Période d'essai</Text>
          <Text style={S.body}>
            {periodeEssaiMois !== null ? (
              <>
                Le présent contrat ne deviendra définitif qu'à l'issue d'une période d'essai de{" "}
                {periodeEssaiMois} mois, au cours de laquelle chacune des parties pourra librement
                et sans motivation mettre fin au contrat après respect d'un délai de prévenance dans
                les conditions fixées aux articles L.1221-25 et L.1221-26 du code du travail.
                {"\n\n"}
                La période d'essai s'entend comme du travail effectif ; toute suspension de
                l'exécution du contrat pendant la période d'essai, quel qu'en soit le motif (maladie,
                congé…), entraînera une prolongation d'une durée équivalente à celle de la
                suspension.
              </>
            ) : (
              <>
                Les parties conviennent qu'aucune période d'essai n'est prévue. L'engagement est
                définitif dès la prise d'effet du contrat.
              </>
            )}
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 4 — Lieu de travail</Text>
          <Text style={S.body}>
            {remplacant} exercera principalement ses fonctions au sein du cabinet de {remplace},
            situé <Val v={lieuTravail} fallback="[adresse du cabinet à compléter]" />.
          </Text>
        </View>

        {/* UNE SEULE des deux versions de l'article 5 — voir l'en-tête de ce fichier. */}
        {temps.type === "COMPLET" ? (
          <View style={S.article}>
            <Text style={S.articleTitle}>Article 5 — Horaires (CDD à temps complet)</Text>
            <Text style={S.body}>
              La durée de travail hebdomadaire de {remplacant} sera de {temps.heuresHebdomadaires}{" "}
              heures.
              {"\n\n"}
              Les horaires de {remplacant} pourront, en fonction des nécessités, être modifiés sans
              que cela constitue une modification de son contrat de travail.
              {"\n\n"}
              La durée légale étant de 35 heures, en cas de dépassement des heures réalisées par{" "}
              {remplacant}, celles-ci sont soit majorées au taux applicable aux heures
              supplémentaires, soit converties en repos compensateur.
            </Text>
          </View>
        ) : (
          <View style={S.article}>
            <Text style={S.articleTitle}>Article 5 — Horaires (CDD à temps partiel)</Text>
            <Text style={S.body}>
              {remplacant} est engagé(e) pour un horaire hebdomadaire de{" "}
              {temps.heuresHebdomadaires} heures par semaine. La répartition de la durée du travail
              est fixée de la manière suivante :
            </Text>
            {temps.repartition.map((r) => (
              <Text key={r.jour} style={S.bullet}>— {r.jour} : de {r.debut} à {r.fin}</Text>
            ))}
            <Text style={S.body}>
              Cette répartition pourra être modifiée en cas de situations exceptionnelles, et
              notamment surcroît temporaire d'activité ou formations.
              {"\n\n"}
              En cas de circonstances exceptionnelles, les conditions de modification seront
              notifiées à {remplacant} 7 jours ouvrés au moins avant la date à laquelle la
              modification devra prendre effet. Cette notification sera faite par lettre
              recommandée avec avis de réception ou par lettre remise en main propre contre
              décharge.
              {"\n\n"}
              {remplace} pourra demander à {remplacant} d'effectuer des heures complémentaires dans
              la limite de {temps.heuresComplementairesMax} heures. Cette demande doit être notifiée
              7 jours ouvrés au moins avant la date à laquelle les heures complémentaires doivent
              être exécutées. {remplacant} s'engage à effectuer ces heures complémentaires.
              {"\n\n"}
              Les heures complémentaires effectuées dans ces conditions sont majorées de 10 % pour
              chacune des heures accomplies dans la limite du dixième des heures prévues au contrat
              de travail, et de 25 % pour chacune des heures accomplies entre le dixième et le tiers
              des heures prévues au contrat de travail.
            </Text>
          </View>
        )}

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 6 — Rémunération</Text>
          <Text style={S.body}>
            En contrepartie de son travail, {remplacant} percevra une rémunération mensuelle brute
            de <Val v={remunerationBrutMensuelle} fallback="[rémunération à compléter]" /> euros.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 7 — Frais professionnels</Text>
          <Text style={S.body}>
            Les frais professionnels engagés par {remplacant} dans l'exercice de ses fonctions
            seront, sur justificatifs, pris en charge ou remboursés par {remplace} dans les
            conditions et limites fixées par ce dernier.
            {"\n\n"}
            Compte tenu des déplacements professionnels que {remplacant} sera amené(e) à effectuer
            pour le compte de {remplace}, il/elle bénéficiera d'une indemnité kilométrique
            correspondant au prix de revient kilométrique admis par l'administration des
            contributions directes, en fonction du véhicule utilisé.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 8 — Absence</Text>
          <Text style={S.body}>
            En cas d'absence prévisible, {remplacant} devra solliciter l'autorisation préalable de{" "}
            {remplace}.
            {"\n\n"}
            Si l'absence est imprévisible, et notamment si elle résulte de la maladie ou d'un
            accident, il appartiendra à {remplacant} d'informer ou de faire informer au plus tôt{" "}
            {remplace} et de fournir dans les 48 heures la justification de l'absence, notamment par
            l'envoi d'un avis d'arrêt de travail et des avis de prolongation éventuelle.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 9 — Congés payés</Text>
          <Text style={S.body}>
            {remplacant} bénéficiera des droits à congés payés dans les conditions prévues par les
            dispositions légales en vigueur (articles L.3141-1 et suivants du code du travail), dont
            les dates de prise de congés seront fixées en accord avec {remplace}, en fonction des
            impératifs d'organisation.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 10 — Retraite complémentaire, frais de santé et prévoyance</Text>
          <Text style={S.body}>
            {remplacant} sera affilié(e) à la caisse de retraite complémentaire{" "}
            <Val v={caisseRetraite} fallback="[caisse à compléter]" />.
            {"\n\n"}
            Il / Elle sera affilié(e) au régime de frais de santé géré par{" "}
            <Val v={regimeFraisSante} fallback="[régime à compléter]" />, et au régime de prévoyance
            géré par <Val v={regimePrevoyance} fallback="[régime à compléter]" />.
            {"\n\n"}
            {remplacant} ne saurait se soustraire au bénéfice des prestations ni refuser d'acquitter
            la quote-part mise à sa charge, telles que ces prestations et cotisations sont
            actuellement prévues ou telles qu'elles sont susceptibles pour le futur de résulter de
            modifications des régimes en cours.
            {"\n\n"}
            Le cas échéant, {remplacant} bénéficiera, dans les mêmes conditions que les autres
            salariés, des avantages accordés par {remplace}.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 11 — Indemnité de précarité d'emploi</Text>
          <Text style={S.body}>
            Au terme de son contrat de travail, {remplacant} percevra une indemnité de fin de contrat
            en application des dispositions légales en vigueur.
            {"\n\n"}
            Elle sera égale à <Val v={indemnitePrecaritePct} fallback="[pourcentage à compléter]" /> %
            de la rémunération totale brute perçue par {remplacant} au cours du présent contrat.
            {"\n\n"}
            Cette indemnité ne sera pas due en cas de rupture anticipée du présent contrat à
            l'initiative du salarié, ou en raison de sa faute grave, ou en cas de force majeure
            (article L.1243-10 du code du travail).
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 12 — Rupture du contrat</Text>
          <Text style={S.body}>
            Sauf accord des parties, le présent contrat ne peut être rompu avant l'échéance du terme
            qu'en cas de faute grave, de force majeure ou d'inaptitude constatée par le médecin du
            travail.
            {"\n\n"}
            Par dérogation et sous réserve de respecter le délai légal de préavis fixé à l'article
            L.1243-2 du code du travail, il peut être rompu avant l'échéance du terme à l'initiative
            de {remplacant} lorsque celui-ci justifie de la conclusion d'un contrat à durée
            indéterminée.
            {"\n\n"}
            La rupture anticipée du présent contrat à l'initiative de l'une ou l'autre des parties
            en dehors des cas prévus aux articles L.1243-2, L.1243-3 et L.1243-4 du code du travail
            ouvre droit pour l'autre partie à des dommages et intérêts correspondant au préjudice
            subi, dans les conditions fixées par ces dispositions légales.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 13 — Cumul d'activités</Text>
          <Text style={S.body}>
            Dans le cas où {remplacant} est autorisé(e) à exercer une autre activité professionnelle,
            dès lors qu'elle n'est pas incompatible avec les obligations découlant du présent contrat
            et qu'elle n'est pas de nature à porter préjudice aux intérêts légitimes de {remplace},{" "}
            {remplacant} s'engage à respecter les dispositions légales relatives au cumul d'emplois,
            notamment les durées de travail maximales quotidienne et hebdomadaire, et à informer{" "}
            {remplace} de l'exercice de toute autre activité.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 14 — Clause de non-concurrence</Text>
          <Text style={S.body}>
            Conformément à l'article R.4321-130 du code de la santé publique, le
            masseur-kinésithérapeute qui a remplacé un de ses confrères, pendant au moins trois mois
            consécutifs ou non, ne doit pas, pendant une période de deux ans, s'installer dans un
            cabinet où il puisse entrer en concurrence directe avec le masseur-kinésithérapeute
            remplacé et avec les masseurs-kinésithérapeutes qui, le cas échéant, exercent avec ce
            dernier, à moins qu'il n'y ait entre les intéressés un accord qui doit être notifié au
            conseil départemental.
            {"\n\n"}
            Par conséquent, il est convenu qu'au terme du présent contrat, si {remplacant} a
            remplacé {remplace} pendant une durée supérieure ou égale à trois mois, {remplacant}{" "}
            s'interdira d'exercer, à quelque titre que ce soit, dans un rayon de{" "}
            <Val v={nonConcurrence.rayonKm} fallback="[rayon à compléter]" /> kilomètres et pendant
            une durée de deux ans à compter de la date de la rupture effective du contrat.
            {"\n\n"}
            En contrepartie de l'obligation de non-concurrence, {remplacant} percevra, après la
            cessation effective de son contrat de travail et pendant toute la durée de cette
            interdiction, une indemnité spéciale{" "}
            {nonConcurrence.periodicite === "TRIMESTRIELLE" ? "trimestrielle" : "mensuelle"} et
            forfaitaire égale à{" "}
            <Val v={nonConcurrence.indemnitePct} fallback="[pourcentage à compléter]" /> % de la
            moyenne mensuelle du salaire brut perçu au cours des{" "}
            <Val v={nonConcurrenceKine.moisDeReference} fallback="[nombre]" /> derniers mois de
            présence au cabinet. Cette contrepartie sera soumise à cotisations sociales et
            contributions fiscales.
            {"\n\n"}
            {remplace} se réserve toutefois le droit de libérer {remplacant} de son obligation de
            non-concurrence, sans que celui-ci puisse prétendre au paiement d'une quelconque
            indemnité. Notification sera alors faite par lettre recommandée avec accusé de réception
            dans les <Val v={nonConcurrenceKine.renonciationJours} fallback="[délai à compléter]" />{" "}
            jours de la notification de la rupture du contrat, quel qu'en soit l'auteur.
            {"\n\n"}
            En cas de violation de la clause, {remplace} sera libéré du versement de la contrepartie
            et {remplacant} s'exposera au paiement d'une indemnité forfaitaire égale à la
            rémunération brute de ses{" "}
            <Val v={nonConcurrenceKine.indemniteViolationMois} fallback="[nombre]" /> derniers mois
            d'activité, sans préjudice du droit pour {remplace} de faire cesser ladite violation par
            tout moyen et de demander réparation de l'entier préjudice subi, et ce sans autre
            sommation que le simple constat d'un quelconque manquement.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 15 — Information liée aux déclarations sociales</Text>
          <Text style={S.body}>
            Le recrutement de {remplacant} a fait l'objet d'une déclaration préalable à l'embauche
            auprès de l'URSSAF de <Val v={urssafVille} fallback="[URSSAF à compléter]" /> en date du{" "}
            <Val v={fmtDateUTC(dateDeclarationPrealable)} fallback="[date à compléter]" />.
            {"\n\n"}
            En outre, chaque mois, {remplace} transmet, via le dispositif de la déclaration sociale
            nominative (DSN), des données utilisées pour le calcul de la paye, ainsi qu'à l'occasion
            de tout événement devant être déclaré par ce biais (arrêts de travail, fin du contrat…),
            toutes les informations nécessaires à l'exercice des droits de {remplacant}.
            {"\n\n"}
            En vertu de la loi n° 78-17 du 6 janvier 1978 modifiée, {remplacant} est informé(e) que
            les données nominatives sont enregistrées sur support informatique et communiquées à
            l'URSSAF de <Val v={urssafVille} fallback="[URSSAF à compléter]" />, auprès de laquelle
            il/elle peut exercer son droit d'accès et de modification.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 16 — Absence de contre-lettre</Text>
          <Text style={S.body}>
            Les cocontractants certifient sur l'honneur qu'il n'existe aucune contre-lettre au
            présent contrat.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 17 — Communication à l'Ordre</Text>
          <Text style={S.body}>
            Conformément à l'article L.4113-9 du code de la santé publique, le présent contrat ainsi
            que tout avenant sera communiqué par chaque partie au conseil départemental de l'ordre
            des masseurs-kinésithérapeutes dont elle relève, dans un délai d'un mois à compter de sa
            signature.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 18 — Conciliation et contentieux</Text>
          <Text style={S.body}>
            En cas de difficulté soulevée par l'application ou l'interprétation du présent contrat,
            les parties s'engagent, conformément à l'article R.4321-99 alinéa 2 du code de la santé
            publique, préalablement à toute action contentieuse, à soumettre leur différend à une
            tentative de conciliation confiée, au besoin, au conseil départemental de l'ordre des
            masseurs-kinésithérapeutes de{" "}
            <Val v={conseilDepartemental} fallback="[conseil départemental à compléter]" />.
            {"\n\n"}
            En cas d'échec de la conciliation, les litiges ou différends relatifs à la validité,
            l'interprétation ou l'exécution du présent contrat peuvent être soumis à la juridiction
            compétente.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 19 — Dispositions diverses</Text>
          <Text style={S.body}>
            {remplacant} déclare être libre de tout engagement et n'être lié(e) par aucune clause de
            non-concurrence avec un ou des précédent(s) employeur(s).
            {"\n\n"}
            Il/Elle s'engage à faire connaître dans les plus brefs délais à {remplace} tout
            changement dans sa situation personnelle.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 20 — Réglementation</Text>
          <Text style={S.body}>
            {remplacant} ne ressort d'aucune convention collective au jour de la signature. Les
            dispositions du contrat de travail sont donc régies par le code du travail et les
            accords collectifs en vigueur, et seraient éventuellement régies par une convention
            collective s'il en était appliqué une.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.body}>
            Fait le {fmtDateUTC(generatedAt)}, à{" "}
            <Val v={conseilDepartemental} fallback="[lieu à compléter]" />.
            {"\n"}
            En deux exemplaires.
          </Text>
        </View>

        <View style={S.sigBlock} wrap={false}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>L'employeur remplacé</Text>
            <Text style={S.body}>{remplace}</Text>
            {signatureTitulaireImg
              ? <Image src={signatureTitulaireImg} style={S.sigImg} />
              : <Text style={[S.sigLabel, { marginTop: 18 }]}>Signature</Text>}
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le salarié remplaçant</Text>
            <Text style={S.body}>{remplacant}</Text>
            {signatureRemplacantImg
              ? <Image src={signatureRemplacantImg} style={S.sigImg} />
              : <Text style={[S.sigLabel, { marginTop: 18 }]}>Signature</Text>}
          </View>
        </View>
        <Text style={S.sigMention}>{SIGNATURE_LEGAL_MENTION}</Text>

        <Text style={S.footer} fixed>
          Contrat de travail à durée déterminée — remplacement d'un masseur-kinésithérapeute libéral
          · Modèle CNOMK du 28/03/2023 · Généré par Soignect
        </Text>
      </Page>
    </Document>
  );
}
