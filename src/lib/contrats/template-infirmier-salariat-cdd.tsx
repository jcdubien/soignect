/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { type ContractDataSalarieInfirmierCdd, SIGNATURE_LEGAL_MENTION } from "./types";
import { DraftWatermark } from "./watermark";
import { PartyIdentityRows } from "./party-identity";
import { fmtDateUTC } from "@/lib/contrats/date";

// CONTRAT SALARIÉ ENTRE INFIRMIERS À DURÉE DÉTERMINÉE (section 259).
//
// ── CE GABARIT EST UNE TRANSCRIPTION, PAS UNE COMPOSITION ────────────────────────────────────
//
// Différence majeure avec `template-kine-salariat-cdi.tsx`, qui porte un avertissement « document
// composé » : celui-ci suit un MODÈLE-TYPE OFFICIEL du Conseil national de l'Ordre des infirmiers.
// Il ne porte donc pas cet avertissement — il n'aurait aucun sens ici, et en mettre un affaiblirait
// celui du CDI kiné, qui lui est mérité.
//
// SOURCE : « Modèle de contrat salarié entre infirmiers à durée déterminée à remplir » (CNOI,
// version du 03/06/2025). La version À REMPLIR a été préférée à la version commentée : cette
// dernière fait trois à quatre fois le poids du contrat, et séparer le texte contractuel du
// commentaire à la main, c'est se donner une chance de transcrire un commentaire comme une clause.
//
// 22 articles, transcrits un à un. Les quatre articles marqués d'un astérisque par l'Ordre
// (1er, 8, 15, 22) sont ses clauses essentielles ; elles sont reprises sans reformulation.
//
// ── LES TROIS BRANCHES DU MODÈLE, ET CE QUI EN A ÉTÉ FAIT ────────────────────────────────────
//
// Le modèle pose trois choix par « ou » :
//
//   art. 3   terme précis / sans terme précis   → `nature`, union déjà structurelle (section 217)
//   art. 9   véhicule personnel / de l'employeur → `vehicule`, union (arbitrage du 22/09 :
//            les DEUX branches restent proposées, c'est une clause du modèle)
//   art. 11  s'installer / exercer pour son compte ou celui d'autrui → arbitrage du 22/09 :
//            formulation LARGE, qui couvre l'installation libérale et le salariat concurrent
//
// Et un quatrième, implicite : « rayon de … kilomètres OU dans les communes suivantes ». Arbitré
// le 22/09 sur le rayon, qui est déjà le vocabulaire de zone de tous les contrats libéraux du
// produit — deux représentations de zone auraient divergé.
//
// ── CE QUI RESTE FACULTATIF DANS LE MODÈLE, ET COMMENT ON LE REND ────────────────────────────
//
// L'article 4 (période d'essai) et l'article 11 (non-concurrence) sont marqués « facultatif » par
// l'Ordre. L'article est TOUJOURS RENDU et énonce son absence le cas échéant — décision du 22/09,
// déjà appliquée au CDI kiné : un contrat muet sur un point et un contrat qui l'écarte ne sont
// pas le même contrat. La numérotation étant écrite en dur et l'article 3 renvoyant nommément à
// d'autres, une renumérotation dynamique était exclue.

const S = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, paddingTop: 50, paddingBottom: 60, paddingHorizontal: 55, lineHeight: 1.5, color: "#1a1a1a" },
  header: { textAlign: "center", marginBottom: 14 },
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
  sigMention: { fontSize: 7.5, color: "#666", marginTop: 6, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 28, left: 55, right: 55, textAlign: "center", fontSize: 7.5, color: "#888", borderTopWidth: 0.5, borderTopColor: "#ddd", paddingTop: 5 },
});

/** Valeur saisie, ou repli visible en orange. JAMAIS de valeur inventée : un contrat incomplet
 *  doit se voir comme incomplet, pas se lire comme complet. Même règle que les autres gabarits. */
function Val({ v, fallback }: { v?: string | number | null; fallback: string }) {
  const vide = v === null || v === undefined || v === "" || v === 0;
  return vide ? <Text style={S.placeholder}>{fallback}</Text> : <Text>{String(v)}</Text>;
}

export function buildInfirmierSalariatCddPdf(d: ContractDataSalarieInfirmierCdd) {
  const {
    employeur, salarie, nature, temps, urssafVille, numeroSecuriteSociale, lieuTravail,
    periodeEssaiMois, remunerationBrutMensuelle, nonConcurrence, nonConcurrenceDetail,
    vehicule, indemnitePrecaritePct, preavisMois, generatedAt,
    signatureTitulaireImg, signatureRemplacantImg, draft,
  } = d;

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {draft && <DraftWatermark />}

        <View style={S.header}>
          <Text style={S.title}>Contrat salarié entre infirmiers à durée déterminée</Text>
          <Text style={S.subtitle}>Modèle-type du Conseil national de l'Ordre des infirmiers</Text>
          <Text style={S.version}>Version du 3 juin 2025 · Généré le {fmtDateUTC(generatedAt)}</Text>
        </View>

        <View style={S.sectionTitle}><Text>Entre</Text></View>
        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>L'employeur :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{employeur.name || "[Nom de l'employeur]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Qualité :</Text><Text style={S.infoVal}>Infirmier Diplômé d'État</Text></View>
          <PartyIdentityRows party={employeur} />
        </View>
        <Text style={S.body}>Ci-après dénommé l'employeur, d'une part,</Text>

        <View style={[S.infoBox, { marginTop: 8 }]}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le salarié :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{salarie.name || "[Nom du salarié]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Qualité :</Text><Text style={S.infoVal}>Infirmier Diplômé d'État</Text></View>
          <PartyIdentityRows party={salarie} />
        </View>
        <Text style={S.body}>Ci-après dénommé le salarié, d'autre part,</Text>

        <View style={S.sectionTitle}><Text>Préambule</Text></View>
        <View style={S.article}>
          <Text style={S.body}>
            Vu les dispositions du Code du travail ;{"\n"}
            Vu les dispositions du Code de la santé publique ;{"\n"}
            Vu la Convention nationale des infirmières et infirmiers libéraux, notamment son avenant
            n° 6 en date du 29 mars 2019.
          </Text>
          <Text style={[S.body, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>
            Il a été convenu et arrêté ce qui suit :
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 1er — Nature et objet du contrat</Text>
          <Text style={S.body}>
            Le présent contrat constitue un contrat de travail soumis aux dispositions du Code du
            travail. Chacune des parties demeure soumise aux règles professionnelles applicables à la
            profession d'infirmier.
            {"\n\n"}
            Sous réserve de la visite d'information et de prévention décidant de son aptitude au poste
            proposé, l'employeur engage le salarié dans les conditions définies ci-après.
            {"\n\n"}
            Il existe entre l'employeur et le salarié un lien de subordination. Ainsi, concernant la
            gestion du cabinet, le salarié se conforme aux directives de son employeur.
            {"\n\n"}
            La déclaration préalable à l'embauche de {salarie.name || "[nom du salarié]"} a été remise
            à l'URSSAF de <Val v={urssafVille} fallback="[ville de l'URSSAF à compléter]" />.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 2 — Engagement</Text>
          <Text style={S.body}>
            Le salarié déclare formellement être libre de tout engagement envers son précédent et/ou
            actuel employeur.
            {"\n\n"}
            L'employeur informe le salarié de ses engagements conventionnels. Si une convention est
            applicable, le salarié en est informé.
            {"\n\n"}
            Par ailleurs, le salarié s'engage à remettre à l'employeur les différents renseignements
            nécessaires à la constitution de son dossier. Son numéro de sécurité sociale est le{" "}
            <Val v={numeroSecuriteSociale} fallback="[n° de sécurité sociale à compléter]" />.
            {"\n\n"}
            En cas de modification intervenant postérieurement dans sa situation, le salarié doit en
            informer immédiatement l'employeur.
            {"\n\n"}
            Enfin, le salarié atteste avoir pris connaissance du Code de déontologie des infirmiers et
            s'engage à le respecter. Le salarié devra obligatoirement, lors de son embauche,
            transmettre son numéro d'inscription à l'Ordre à l'employeur.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 3 — Durée du contrat</Text>
          <Text style={S.body}>
            Le présent contrat est conclu pour une durée déterminée.
            {"\n\n"}
            {/* Les deux branches du modèle. Rendre celle qui ne s'applique pas — même barrée —
                aurait reproduit sur un document signé l'ambiguïté que le modèle demande de lever
                en rayant la mention inutile. */}
            {nature.type === "CDD_TERME" ? (
              <>
                Il débute le {fmtDateUTC(nature.debut)} et prend fin le {fmtDateUTC(nature.fin)}.
                {"\n\n"}
                Il ne peut être renouvelé que deux fois et ne peut excéder dix-huit mois,
                renouvellement compris. Dans ce cas, un avenant au contrat devra être signé.
              </>
            ) : nature.type === "CDD_SANS_TERME" ? (
              <>
                Il débute le {fmtDateUTC(nature.debut)} pour une durée minimale de{" "}
                <Val v={nature.dureeMinimaleMois} fallback="[durée minimale à compléter]" /> mois et
                prendra fin à l'extinction du motif initialement prévu dans le présent contrat.
              </>
            ) : (
              <Text style={S.placeholder}>
                [nature du contrat à déterminer — un contrat à durée indéterminée ne relève pas de ce modèle]
              </Text>
            )}
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 4 — Période d'essai</Text>
          <Text style={S.body}>
            {periodeEssaiMois !== null ? (
              <>
                Le CDD ne devient définitif qu'à l'expiration d'une période d'essai fixée à{" "}
                {periodeEssaiMois} mois.
                {"\n\n"}
                La période d'essai pourra être renouvelée, d'un commun accord, une fois pour une durée
                équivalente. Ce renouvellement fera l'objet d'une confirmation écrite des deux parties
                sous forme d'avenant au présent contrat.
                {"\n\n"}
                Au cours de la période d'essai, chacune des parties peut rompre le contrat à condition
                de respecter le délai de prévenance prévu aux articles L.1221-25 et L.1221-26 du Code
                du travail.
                {"\n\n"}
                Il est expressément convenu que la période d'essai s'entend d'un travail effectif.
                S'agissant d'une période de travail effectif, toute suspension qui l'affecterait
                (maladie, congés…) la prolongerait d'une durée égale.
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
          <Text style={S.articleTitle}>Article 5 — Rémunération et temps de travail</Text>
          <Text style={S.body}>
            Le salarié agit en toute circonstance dans l'intérêt des patients qu'il prend en charge
            dans le cadre de son contrat de travail. Il devra consacrer à cette activité tout le temps
            nécessaire selon les modalités habituelles de fonctionnement du cabinet.
            {"\n\n"}
            Le salarié percevra une rémunération mensuelle brute de{" "}
            <Val v={remunerationBrutMensuelle} fallback="[rémunération brute à compléter]" /> euros
            correspondant aux horaires du cabinet, soit {temps.heuresHebdomadaires} heures
            hebdomadaires. Elle inclut les majorations pour heures supplémentaires.
            {"\n\n"}
            Les horaires de travail du salarié et leur aménagement peuvent être modifiés en fonction
            des impératifs du cabinet. Toute modification des horaires est notifiée au salarié par son
            employeur sept jours au moins avant la date à laquelle cette modification doit prendre
            effet.
          </Text>
          {/* Le temps partiel EXIGE la répartition des heures : sans elle, le contrat est
              requalifiable en temps complet. Le type l'impose (section 217) ; on l'imprime. */}
          {temps.type === "PARTIEL" && (
            <>
              <Text style={[S.body, { marginTop: 6 }]}>
                Le présent contrat étant conclu à temps partiel, la répartition de la durée du travail
                est fixée comme suit :
              </Text>
              {temps.repartition.map((r) => (
                <Text key={r.jour} style={S.bullet}>• {r.jour} : de {r.debut} à {r.fin}</Text>
              ))}
              <Text style={S.body}>
                Le nombre d'heures complémentaires ne pourra excéder {temps.heuresComplementairesMax} %
                de la durée hebdomadaire prévue au présent contrat.
              </Text>
            </>
          )}
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 6 — Facturation des honoraires</Text>
          <Text style={S.body}>
            Conformément à l'article 17.3 de l'avenant 6 à la Convention nationale des infirmières et
            infirmiers libéraux, les feuilles de soins sur lesquelles sont portés les actes doivent
            comprendre l'identification nominale et codée de l'employeur, suivie de l'identification
            du salarié.
            {"\n\n"}
            Les honoraires encaissés par le salarié seront déposés sur le compte de l'employeur. Les
            chèques devront être adressés à son ordre et un bordereau de remise de chèques devra lui
            être transmis. En cas de remise d'espèces, un bordereau devra également être remis à
            l'employeur.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 7 — Missions et attributions</Text>
          <Text style={S.body}>
            Par le présent contrat, le salarié est recruté en qualité d'infirmier. Il doit exercer sa
            profession dans le respect de son décret de compétences, et dans le cadre des missions que
            lui attribue son contrat de travail.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 8 — Lieu d'exercice professionnel</Text>
          <Text style={S.body}>
            Dans le cadre du présent contrat, le salarié exercera ses fonctions sur le ou les lieux
            suivants : <Val v={lieuTravail} fallback="[lieu d'exercice à compléter]" />.
            {"\n\n"}
            Pour le cas où l'employeur exerce sur plusieurs sites distincts, ce dernier s'engage à
            respecter les dispositions de l'article R.4312-72 du Code de la santé publique.
            {"\n\n"}
            Le salarié effectue en outre les visites à domicile qui seront rendues nécessaires à
            l'exercice de ses fonctions.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 9 — Exercice et moyens de travail</Text>
          <Text style={S.body}>
            Conformément à l'article R.4312-67 du Code de la santé publique, l'employeur met à la
            disposition du salarié une installation adaptée et les moyens techniques pertinents pour
            assurer l'accueil, la bonne exécution des soins, la sécurité des patients ainsi que le
            respect du secret professionnel.
            {"\n\n"}
            L'employeur prend en charge les frais de transport du salarié dans les conditions prévues
            aux articles L.3261-1 et suivants du Code du travail. Il prend en charge 50 % du coût des
            titres d'abonnements souscrits par le salarié pour ses déplacements entre sa résidence
            habituelle et son lieu de travail accomplis au moyen de transports publics de personnes ou
            de services publics de location de vélos (articles L.3261-2 et R.3261-1 du Code du
            travail).
          </Text>

          {vehicule.type === "PERSONNEL" ? (
            <Text style={[S.body, { marginTop: 6 }]}>
              Le salarié s'engage à souscrire à ses frais, pour le véhicule personnel qu'il est tenu
              d'utiliser pour l'exercice de ses fonctions, une police d'assurance garantissant
              expressément et en totalité la responsabilité civile dans le cadre d'un usage
              professionnel. Le salarié doit en justifier auprès de son employeur à chaque échéance
              contractuelle.
              {"\n\n"}
              En cas d'accident, le salarié est tenu de prévenir dans un délai maximum de 48 heures,
              par lettre recommandée avec accusé de réception, l'employeur ainsi que les compagnies
              d'assurance.
              {"\n\n"}
              Pour rembourser le salarié des frais occasionnés par l'utilisation de son véhicule
              personnel pour ses déplacements professionnels, l'employeur s'engage à lui verser, pour
              chaque kilomètre parcouru dans ces conditions, des indemnités kilométriques d'un montant
              égal aux montants prévus par le barème de l'administration fiscale. Le règlement de ces
              indemnités a lieu en même temps que la rémunération mensuelle, sur la seule présentation
              par le salarié d'un état justificatif faisant ressortir les déplacements effectués.
            </Text>
          ) : (
            <Text style={[S.body, { marginTop: 6 }]}>
              L'employeur met à disposition du salarié le véhicule suivant :{" "}
              <Val v={vehicule.designation} fallback="[véhicule à désigner]" />.
              {"\n\n"}
              Ce véhicule pourra être utilisé{" "}
              {vehicule.usage === "PROFESSIONNEL"
                ? "uniquement à des fins professionnelles."
                : "également en dehors des horaires de travail."}
              {"\n\n"}
              L'employeur met à disposition du salarié les papiers du véhicule. Conformément à
              l'article L.211-1 du Code des assurances, l'employeur, en tant que propriétaire du
              véhicule, affirme avoir souscrit une assurance pour le véhicule concerné.
              {"\n\n"}
              Pour rembourser le salarié des frais occasionnés par l'utilisation du véhicule mis à sa
              disposition par l'employeur, ce dernier s'engage à lui verser, pour chaque kilomètre
              parcouru pour ses déplacements professionnels, des indemnités kilométriques d'un montant
              égal aux montants prévus par le barème de l'administration fiscale. Le règlement de ces
              indemnités a lieu en même temps que la rémunération mensuelle, sur la seule présentation
              par le salarié d'un état justificatif faisant ressortir les déplacements effectués.
            </Text>
          )}
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 10 — Obligation de loyauté et cumul d'activités</Text>
          <Text style={S.body}>
            Dans le cadre de son obligation de loyauté et dans le cas où le salarié serait amené à
            exercer une autre activité, ce dernier s'engage à respecter les dispositions légales
            relatives au cumul d'emplois, notamment les durées de travail maximales quotidiennes et
            hebdomadaires, et à veiller à ce que celles-ci soient compatibles avec l'exercice de ses
            fonctions au sein du cabinet. Il devra en informer son employeur.
            {"\n\n"}
            Il devra également s'abstenir de tout acte de concurrence direct ou indirect au détriment
            de son employeur.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 11 — Clause de non-concurrence</Text>
          <Text style={S.body}>
            {nonConcurrence.dureeMois > 0 ? (
              <>
                Il est convenu, en raison des fonctions du salarié, qu'il ne pourra, sauf accord écrit
                de l'employeur, exercer sa profession pour son propre compte ou pour le compte
                d'autrui pendant une durée de {nonConcurrence.dureeMois} mois et dans un rayon de{" "}
                <Val v={nonConcurrence.rayonKm} fallback="[rayon à compléter]" /> kilomètres autour du
                cabinet.
                {"\n\n"}
                La clause de non-concurrence trouvera à s'appliquer à compter de la rupture du contrat
                et non en cas de rupture du contrat pendant la période d'essai.
                {"\n\n"}
                Durant l'interdiction, le salarié percevra une contrepartie financière correspondant à{" "}
                <Val v={nonConcurrence.indemnitePct} fallback="[pourcentage à compléter]" /> % de la
                moyenne mensuelle du salaire brut perçu par le salarié au cours des{" "}
                <Val v={nonConcurrenceDetail.moisDeReference} fallback="[nombre]" /> derniers mois de
                présence dans l'entreprise.
                {"\n\n"}
                En cas de non-respect de la présente clause par le salarié, l'employeur se réserve le
                droit de demander le versement de dommages-intérêts dont le montant est fixé
                forfaitairement à{" "}
                <Val v={nonConcurrenceDetail.dommagesInteretsEuros} fallback="[montant à compléter]" />{" "}
                euros.
                {"\n\n"}
                Lors de la rupture du contrat de travail, quel qu'en soit le motif, l'employeur se
                réserve le droit de libérer le salarié de l'interdiction de concurrence, sans que ce
                dernier puisse prétendre au paiement d'une quelconque indemnité. La décision de
                renonciation à l'application de la présente clause devra toutefois intervenir dans un
                délai de{" "}
                <Val v={nonConcurrenceDetail.renonciationJours} fallback="[délai à compléter]" /> jours
                suivant la notification de la rupture par l'une des deux parties, par lettre
                recommandée avec accusé de réception.
              </>
            ) : (
              <>
                Les parties conviennent qu'aucune clause de non-concurrence n'est stipulée au présent
                contrat. Le salarié demeure libre, à l'issue du contrat, d'exercer sa profession sans
                restriction de lieu ni de durée.
              </>
            )}
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 12 — Secret professionnel</Text>
          <Text style={S.body}>
            Le salarié sera tenu à une obligation de discrétion absolue en ce qui concerne les
            informations et renseignements dont il pourra avoir connaissance par l'exercice de ses
            fonctions. Il s'interdit donc de divulguer à qui que ce soit des renseignements ou
            informations.
            {"\n\n"}
            Tout manquement par le salarié à l'obligation de discrétion prévue ci-dessus conduirait
            l'employeur à envisager la rupture du présent contrat, et ceci indépendamment de la
            réparation éventuelle du préjudice subi par le cabinet. Le salarié est, en outre, tenu au
            secret professionnel.
            {"\n\n"}
            Durant l'exécution du contrat et après sa rupture, le salarié veille à respecter les
            dispositions applicables en matière de confidentialité des informations de santé reçues
            dans le cadre de son exercice.
            {"\n\n"}
            L'employeur s'engage à prendre les dispositions nécessaires afin que le salarié puisse
            exercer sa profession dans des conditions lui permettant d'assurer le respect du secret
            professionnel.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 13 — Absences et arrêts de travail</Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 4 }]}>13.1 — Absences pour maladie et accident</Text>
          <Text style={S.body}>
            En cas d'absence prévisible, le salarié devra solliciter une autorisation préalable de son
            employeur.
            {"\n\n"}
            Si l'absence est imprévisible, et notamment si elle résulte de la maladie ou d'un accident,
            le salarié est tenu de prévenir immédiatement l'employeur et de fournir, sauf en cas de
            force majeure, dans les 48 heures, une justification de l'absence, notamment par l'envoi
            d'un avis d'arrêt de travail et des avis de prolongation éventuelle.
            {"\n\n"}
            À défaut d'information ou de justification dans les conditions prévues ci-dessus,
            l'employeur pourra être amené à prendre toutes mesures, notamment disciplinaires, qu'il
            estimerait nécessaires.
          </Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 6 }]}>13.2 — Maternité</Text>
          <Text style={S.body}>
            La salariée en état de grossesse médicalement constatée a le droit de suspendre son contrat
            de travail pendant une durée qui commence six semaines avant la date présumée de
            l'accouchement et se termine dix semaines après la date de celui-ci, ou, en cas de
            naissances multiples ou à partir du troisième enfant, conformément aux durées prévues aux
            articles L.1225-18 et L.1225-19 du Code du travail.
            {"\n\n"}
            À l'expiration du congé maternité, toute mère comptant au moins un an de présence au jour
            de la naissance et désirant se consacrer à son enfant a droit, sur sa demande écrite, à un
            congé non rémunéré de six mois maximum pendant lequel elle conserve son poste de plein
            droit. Passé ce délai de six mois, elle bénéficie d'une priorité de réembauche.
            {"\n\n"}
            Le bénéfice de cet article nécessite que l'intéressée en fasse la demande au minimum un
            mois avant la date prévue de sa reprise.
          </Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 6 }]}>13.3 — Congé paternité</Text>
          <Text style={S.body}>
            Après la naissance de son enfant et dans un délai de six mois suivant celle-ci, le salarié
            bénéficie d'un congé de paternité de vingt-cinq jours calendaires, ou de trente-deux jours
            calendaires en cas de naissances multiples.
            {"\n\n"}
            Le bénéfice de cet article nécessite que l'intéressé en fasse la demande au minimum un mois
            avant la date prévue de sa reprise.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 14 — Congés payés</Text>
          <Text style={S.body}>
            Le salarié bénéficie d'un droit à congés payés tel que prévu par la législation en vigueur.
            {"\n\n"}
            La date de ses congés est déterminée par accord entre l'employeur et lui-même dans un délai
            raisonnable à l'avance, de telle façon que la continuité des soins soit assurée.
            {"\n\n"}
            Si le salarié n'a pas soldé ses congés au terme du contrat, une indemnité compensatrice de
            congés payés lui sera versée dans les conditions de l'article L.3141-28 du Code du travail.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 15 — Indépendance professionnelle et respect des règles professionnelles</Text>
          <Text style={S.body}>
            Les parties co-contractantes demeurent chacune entièrement soumises à l'ensemble des règles
            professionnelles applicables à la profession d'infirmier.
            {"\n\n"}
            Elles exercent chacune leur profession en pleine indépendance et veillent à ce que ce
            principe ne soit pas entravé, conformément à l'article R.4312-6 du Code de la santé
            publique.
            {"\n\n"}
            Le salarié est soumis à un lien de subordination à l'égard de son employeur en ce qui
            concerne la gestion administrative et financière du cabinet et l'organisation du travail.
            {"\n\n"}
            Hors cas d'urgence et celui où il manquerait à ses devoirs d'humanité, si le salarié décide
            de ne pas effectuer des soins ou se trouve dans l'obligation de les interrompre, pour des
            raisons professionnelles ou personnelles, il doit se conformer aux règles prévues à
            l'article R.4312-12 du Code de la santé publique et informer son employeur.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 16 — Protection sociale</Text>
          <Text style={S.body}>
            Le salarié bénéficiera de tous les avantages de retraite, mutuelle et prévoyance accordés
            par son employeur.
            {"\n\n"}
            Le salarié ne saurait donc se soustraire au bénéfice de ces prestations, ni refuser
            d'acquitter la quote-part mise à sa charge, telles que ces prestations et cotisations sont
            actuellement prévues, ou telles qu'elles sont susceptibles pour le futur de résulter des
            modifications du régime en cours.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 17 — Développement professionnel continu et certification périodique</Text>
          <Text style={S.body}>
            L'employeur s'engage à donner au salarié toutes facilités pour participer à des activités
            destinées à lui permettre de tenir à jour, d'étendre et de communiquer ses connaissances.
            {"\n\n"}
            Aux termes de l'article R.4312-46 du Code de la santé publique, le salarié est tenu à une
            obligation de développement professionnel continu (DPC). Cette obligation triennale est
            posée par l'article L.4021-1 du Code de la santé publique.
            {"\n\n"}
            L'évaluation des pratiques professionnelles, qui est obligatoire pour tout infirmier, fait
            partie intégrante, avec le perfectionnement des connaissances, du développement
            professionnel continu ainsi que de la certification périodique.
            {"\n\n"}
            De même, à cette obligation de DPC s'ajoute une obligation de certification périodique
            posée par l'article L.4022-3 du Code de la santé publique, qui s'impose depuis le
            1er janvier 2023 à tous les infirmiers en exercice.
            {"\n\n"}
            Conformément aux dispositions de l'article R.4022-7 du Code de la santé publique, le
            salarié devra satisfaire à l'obligation de certification périodique en réalisant tous les
            six ans au moins deux actions prévues dans les référentiels de certification applicables
            aux infirmiers.
            {"\n\n"}
            Les parties conviennent dès lors :
          </Text>
          <Text style={S.bullet}>• que le salarié précise l'organisme de formation, nécessairement enregistré, qui dispense l'action de formation visée ;</Text>
          <Text style={S.bullet}>• que l'action de formation visée soit conforme à l'orientation nationale ou régionale du DPC enregistrée et évaluée favorablement par l'ANDPC ;</Text>
          <Text style={S.bullet}>• que l'action de certification périodique visée soit conforme aux référentiels de formation prévus à l'article L.4022-2 du Code de la santé publique.</Text>
          <Text style={S.body}>
            Les actions de formation professionnelle sont prises en charge par l'employeur. Les parties
            au présent contrat s'entendent sur l'époque et la durée des absences consacrées à leur
            formation.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 18 — Résolution des différends découlant du présent contrat</Text>
          <Text style={S.body}>
            En cas de difficultés soulevées sur la validité, l'exécution, l'interprétation ou la
            résolution du présent contrat, les parties s'engagent, préalablement à toute action
            contentieuse, à soumettre leur différend à une tentative de conciliation confiée au besoin
            au Conseil (inter)départemental de l'Ordre des infirmiers, conformément à l'article
            R.4312-25 alinéa 4 du Code de la santé publique.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 19 — Obligation d'assurance</Text>
          <Text style={S.body}>
            L'employeur est tenu de souscrire, à ses frais, une assurance destinée à garantir la
            responsabilité civile susceptible d'être engagée en raison des dommages subis par des tiers
            et résultant d'atteintes à la personne, survenant dans le cadre de l'activité exercée par
            le salarié pour le compte de son employeur.
            {"\n\n"}
            Le salarié peut s'assurer, à ses frais, en ce qui concerne sa responsabilité civile.
            {"\n\n"}
            Les parties co-contractantes doivent se justifier mutuellement au moins une fois par an du
            respect de cette obligation.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 20 — Indemnité de précarité</Text>
          <Text style={S.body}>
            À compter de la rupture du CDD, le salarié percevra une indemnité de fin de contrat en
            application des dispositions légales en vigueur.
            {"\n\n"}
            Elle sera égale à{" "}
            <Val v={indemnitePrecaritePct} fallback="[pourcentage à compléter]" /> % de la rémunération
            totale brute perçue par le salarié au cours du présent contrat, en application de l'article
            L.1243-8 du Code du travail.
            {"\n\n"}
            Cette indemnité ne sera pas due dans les cas listés à l'article L.1243-10 du Code du
            travail.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 21 — Rupture</Text>
          <Text style={S.body}>
            À l'issue de la période d'essai, il pourra être mis fin au présent contrat dans les
            conditions fixées à cet effet par la loi, sous réserve de respecter, sauf cas de faute
            grave ou lourde, un délai de préavis fixé à{" "}
            <Val v={preavisMois} fallback="[préavis à compléter]" /> mois, sans préjudice des
            dispositions de l'article 3.
          </Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 6 }]}>21.1 — Rupture du contrat pour cause de décès de l'employeur</Text>
          <Text style={S.body}>
            Le décès de l'employeur met fin au contrat de travail qui le liait à son salarié.
            {"\n\n"}
            En cas de cessation de l'activité, le contrat ne se poursuit pas avec les héritiers. En
            revanche, si l'activité se poursuit en dépit du décès de l'employeur, les héritiers doivent
            poursuivre les relations contractuelles avec l'infirmier salarié.
            {"\n\n"}
            La date du décès de l'employeur fixe le départ du préavis. Sont dus au salarié :
          </Text>
          <Text style={S.bullet}>• le dernier salaire ;</Text>
          <Text style={S.bullet}>• les indemnités de préavis et de licenciement auxquelles le salarié peut prétendre compte tenu de son ancienneté lorsque l'employeur décède ;</Text>
          <Text style={S.bullet}>• l'indemnité de congés payés.</Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 22 — Transmission à l'Ordre</Text>
          <Text style={S.body}>
            Conformément aux dispositions des articles L.4113-9 et R.4312-65 du Code de la santé
            publique, ce contrat ainsi que tout avenant est communiqué par chacune des parties au
            Conseil (inter)départemental de l'Ordre des infirmiers du tableau duquel elles sont
            inscrites, dans un délai d'un mois à compter de sa signature.
            {"\n\n"}
            Les parties affirment sur l'honneur n'avoir passé aucune contre-lettre ou avenant relatif
            au présent contrat qui ne soit soumis au Conseil (inter)départemental de l'Ordre des
            infirmiers compétent.
          </Text>
        </View>

        <View style={S.sigBlock} wrap={false}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>L'employeur</Text>
            <Text style={S.body}>{employeur.name || "[Nom]"}</Text>
            {signatureTitulaireImg
              ? <Image src={signatureTitulaireImg} style={S.sigImg} />
              : <Text style={[S.sigLabel, { marginTop: 18 }]}>Signature</Text>}
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le salarié</Text>
            <Text style={S.body}>{salarie.name || "[Nom]"}</Text>
            {signatureRemplacantImg
              ? <Image src={signatureRemplacantImg} style={S.sigImg} />
              : <Text style={[S.sigLabel, { marginTop: 18 }]}>Signature</Text>}
          </View>
        </View>
        <Text style={S.sigMention}>{SIGNATURE_LEGAL_MENTION}</Text>

        <Text style={S.footer} fixed>
          Contrat salarié entre infirmiers à durée déterminée — modèle-type du Conseil national de
          l'Ordre des infirmiers (03/06/2025) · Généré par Soignect
        </Text>
      </Page>
    </Document>
  );
}
