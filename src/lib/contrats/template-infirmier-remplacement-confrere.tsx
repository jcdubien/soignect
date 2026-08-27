/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { type ContractDataRemplacementInfirmierConfrere, SIGNATURE_LEGAL_MENTION } from "./types";
import { DraftWatermark } from "./watermark";
import { PartyIdentityRows } from "./party-identity";

// CONTRAT DE REMPLACEMENT INFIRMIER — variante « remplaçant CONFRÈRE DÉJÀ INSTALLÉ ».
// Transcrit du modèle du Conseil national de l'Ordre des infirmiers, mis à jour le 15/11/2023.
// Blocs « Commentaire : » du CNOI écartés (10 dans ce document).
//
// CE QUI LE DISTINGUE DE LA VARIANTE « AUTORISATION »
// Ici le remplaçant est installé : il a son cabinet, sa patientèle et sa propre CPS. Trois
// conséquences que le modèle tire explicitement :
//   • il facture avec SES identifiants, donc il encaisse — et verse une redevance au remplacé
//     pour les frais de cabinet. Le sens est celui de `retrocessionPct` côté kiné, et l'INVERSE
//     de la variante « autorisation », où c'est le remplacé qui reverse ;
//   • il peut recevoir les patients confiés dans son propre cabinet (art. 3) ;
//   • l'article 11 ne cite pas R.4312-87 (non-installation) mais R.4312-82 (concurrence
//     déloyale) : quelqu'un de déjà installé ne peut pas « s'installer » à nouveau.
//
// LES CINQ ALTERNATIVES DU MODÈLE, tranchées par Jean-Charles les 27 et 28/08 :
//   • art. 2 — période « du … au … » avec planning annexé, plutôt qu'en liste de jours ;
//   • art. 3 — la clause autorisant le remplaçant à recevoir dans SON cabinet EST incluse ;
//   • art. 5 — le remplaçant facture avec ses propres identifiants, et l'option de redevance
//     est retenue.
//
// ⚠️ CONSÉQUENCE DE CE DERNIER CHOIX, à relire si le contrat paraît court. Dans le modèle, le
// « OU » de l'article 5 sépare deux économies entières, pas deux formulations :
//     A) le remplaçant facture avec SES identifiants → il encaisse → option de redevance ;
//     B) il utilise les identifiants DU REMPLACÉ → « il perçoit POUR LE COMPTE du remplacé »
//        → suivent le bordereau récapitulatif et les deux pourcentages que le remplacé lui
//        reverse (paiement direct, puis tiers payant).
// Le choix A ayant été retenu, tout le bloc B est écarté — y compris ces reversements. Les
// conserver aurait produit un contrat où le remplaçant garde les honoraires ET reçoit une
// rétrocession : économiquement absurde et juridiquement incohérent. C'est une lecture de la
// structure du document, pas une évidence typographique ; elle est signalée comme telle.

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

// Dates « jour seul » stockées à minuit UTC — formatées en UTC, sinon décalage d'un jour en
// fuseau négatif (Guadeloupe UTC−4). Un contrat est un document légal : le jour doit être exact.
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

export function buildRemplacementInfirmierConfrerePdf(data: ContractDataRemplacementInfirmierConfrere) {
  const {
    remplace, remplacant, startDate, endDate, redevancePct,
    moyensMisADisposition, cabinetRemplacant,
    preavisCommunAccordJours, preavisUnilateralJours, dureeInformationSollicitation,
    generatedAt, signatureTitulaireImg, signatureRemplacantImg, draft,
  } = data;

  return (
    <Document title="Contrat de remplacement infirmier" author="Soignect">
      <Page size="A4" style={S.page}>

        <View style={S.header}>
          <Text style={S.title}>Contrat de remplacement</Text>
          <Text style={S.subtitle}>Entre un infirmier d'exercice libéral et un confrère installé</Text>
          <Text style={S.subtitle}>Infirmiers — modèle CNOI (15/11/2023)</Text>
          <Text style={S.version}>Généré le {fmtDate(generatedAt)}</Text>
        </View>

        <View style={S.sectionTitle}><Text>Entre les soussignés</Text></View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le remplacé :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{remplace.name || "[Nom du remplacé]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{remplace.profession}</Text></View>
          <PartyIdentityRows party={remplace} />
        </View>

        <View style={S.infoBox}>
          <Text style={[S.articleTitle, { marginBottom: 4 }]}>Le remplaçant :</Text>
          <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoVal}>{remplacant.name || "[Nom du remplaçant]"}</Text></View>
          <View style={S.infoRow}><Text style={S.infoLabel}>Profession :</Text><Text style={S.infoVal}>{remplacant.profession}</Text></View>
          <PartyIdentityRows party={remplacant} />
        </View>

        <Text style={S.body}>Il a été convenu et arrêté ce qui suit :</Text>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 1er — Objet</Text>
          <Text style={S.body}>
            Le Remplaçant exercera, pendant la durée du remplacement prévue à l'article 2 du présent
            contrat, la profession d'infirmier en lieu et place du Remplacé, indisponible temporairement.
            {"\n\n"}
            Les patients devront être informés dès que possible de la présence d'un infirmier remplaçant,
            notamment lors de visites à domicile ou de rendez-vous au cabinet.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 2 — Durée (clause réglementaire)</Text>
          <Text style={S.body}>
            Le présent contrat est conclu du {fmtDateUTC(startDate)} au {fmtDateUTC(endDate)}, et selon un
            planning annexé au présent contrat et déterminé dans un délai raisonnable.
            {"\n\n"}
            Il pourra être prolongé dans les conditions prévues à l'article 9 du présent contrat si
            l'indisponibilité du Remplacé le justifie.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 3 — Lieu d'exercice professionnel</Text>
          <Text style={S.body}>
            Le Remplacé met à disposition du Remplaçant son cabinet comprenant :{" "}
            <Val v={moyensMisADisposition} fallback="[locaux, installations, appareils, matériel à usage unique, secrétariat… à préciser]" />
            , sans qu'aucun lien contractuel, de location, de sous-location ou d'occupation emportant
            indemnité ne soit créé entre les deux parties nonobstant les dispositions de l'article 5 du
            présent contrat.
            {"\n\n"}
            Le Remplaçant en fera un usage exclusivement professionnel et s'interdira toute modification
            des lieux et/ou de leur destination.
            {"\n\n"}
            Notamment, le Remplaçant devra veiller à l'entretien et la maintenance du local professionnel,
            des installations et des appareils mis à disposition par le Remplacé pendant toute la durée
            du remplacement.
            {"\n\n"}
            Les parties conviennent expressément que le Remplaçant pourra recevoir les patients confiés
            par le Remplacé dans son propre cabinet sis{" "}
            <Val v={cabinetRemplacant} fallback="[adresse du cabinet du remplaçant à compléter]" />{" "}
            pendant toute la durée du présent contrat de remplacement.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 4 — Obligations des parties (clause réglementaire)</Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 4 }]}>Article 4.1 — Obligations du Remplaçant</Text>
          <Text style={S.body}>Le Remplaçant :</Text>
          <Text style={S.bullet}>
            — Agit en toute circonstance dans l'intérêt des patients qui lui sont confiés par le Remplacé.
            Il leur délivre des soins consciencieux, attentifs et conformes aux données acquises de la
            science, dans le respect des règles applicables à la profession d'infirmier, notamment du
            Code de déontologie ;
          </Text>
          <Text style={S.bullet}>
            — Devra consacrer à cette activité tout le temps nécessaire selon les modalités habituelles
            de fonctionnement du cabinet ;
          </Text>
          <Text style={S.bullet}>
            — Entretient avec les autres infirmiers avec qui il est en relation durant le contrat de
            remplacement des rapports de bonne confraternité ;
          </Text>
          <Text style={S.bullet}>
            — S'engage à respecter les dispositions légales, réglementaires, conventionnelles et
            déontologiques applicables à la profession d'infirmier, et le cas échéant le règlement
            intérieur du cabinet du Remplacé qui lui est temporairement mis à disposition ;
          </Text>
          <Text style={S.bullet}>
            — Apporte la preuve qu'il a contracté une police d'assurance responsabilité civile
            professionnelle avant le début de son activité. Son attestation est annexée au présent contrat ;
          </Text>
          <Text style={S.bullet}>
            — Sera seul responsable vis-à-vis des patients et des tiers des conséquences de son activité
            professionnelle dans le cadre du remplacement temporaire ;
          </Text>
          <Text style={S.bullet}>
            — S'assure en tout état de cause que les cotations sont conformes à la NGAP, en particulier
            lorsque c'est le Remplacé qui procède à la facturation.
          </Text>

          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 6 }]}>Article 4.2 — Obligations du Remplacé</Text>
          <Text style={S.body}>Le Remplacé :</Text>
          <Text style={S.bullet}>
            — S'interdit pendant la durée du présent contrat toute activité professionnelle d'infirmier,
            à l'exception toutefois du suivi d'une formation professionnelle et sous réserve des articles
            R.4312-7 (assistance aux personnes en péril) et R.4312-8 (collaboration à un dispositif de
            secours) du Code de la santé publique ;
          </Text>
          <Text style={S.bullet}>
            — S'engage à mettre à la disposition du Remplaçant des locaux et du matériel professionnel en
            état et en nombre suffisant afin qu'il soit en mesure de remplir au mieux la mission qui lui
            est confiée ;
          </Text>
          <Text style={S.bullet}>
            — S'engage à mettre à la disposition du Remplaçant l'ensemble des informations nécessaires au
            bon déroulement et à la continuité des soins ;
          </Text>
          <Text style={S.bullet}>
            — S'engage à porter à la connaissance du Remplaçant les dispositions de la convention nationale
            des infirmiers et à l'informer des droits et obligations qui s'imposent à lui dans ce cadre ;
          </Text>
          <Text style={S.bullet}>
            — S'engage à informer les organismes d'assurance maladie en leur indiquant le nom du
            remplaçant, la durée et les dates de son remplacement ;
          </Text>
          <Text style={S.bullet}>
            — Fournit au Remplaçant les documents permettant de vérifier la concordance entre la cotation
            des actes facturés et la rémunération due, lorsque c'est l'infirmier remplacé qui procède à
            la facturation.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 5 — Honoraires (clause réglementaire)</Text>
          <Text style={S.body}>
            Le Remplaçant perçoit lui-même l'ensemble des honoraires correspondant aux actes effectués sur
            les patients à qui il aura donné ses soins, en faisant usage, conformément aux règles fixées
            par les caisses d'Assurance maladie, de ses propres feuilles de soins imprimées ou
            électroniques ou de sa Carte Professionnelle de Santé (CPS).
            {"\n\n"}
            En cas d'usage de feuilles de soins, le Remplaçant devra y faire mention de son identification
            personnelle.
          </Text>
          {redevancePct > 0 && (
            <Text style={[S.body, { marginTop: 6 }]}>
              Une redevance de {redevancePct} % correspondant aux frais engagés pour le cabinet par le
              titulaire est reversée par le Remplaçant au Remplacé.
            </Text>
          )}
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 6 — Obligations fiscales et sociales</Text>
          <Text style={S.body}>
            Chaque partie contractante procédera à ses déclarations fiscales et sociales de manière
            indépendante et supportera personnellement, chacune en ce qui la concerne, la totalité de ses
            charges fiscales et sociales afférentes audit remplacement.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 7 — Incessibilité</Text>
          <Text style={S.body}>
            Compte tenu du caractère intuitu personae attaché au présent contrat de remplacement,
            celui-ci n'est pas cessible.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 8 — Résiliation anticipée</Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 4 }]}>Article 8.1 — Résiliation d'un commun accord</Text>
          <Text style={S.body}>
            Le présent contrat pourra être résilié d'un commun accord entre les parties co-contractantes
            moyennant le respect d'un préavis de <Val v={preavisCommunAccordJours} fallback="[…]" /> jours.
            Un document cosigné par les parties en prend acte.
          </Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 6 }]}>Article 8.2 — Résiliation unilatérale</Text>
          <Text style={S.body}>
            Au cas où, pendant la durée du présent contrat, l'une des parties ne respecterait pas l'une de
            ses obligations contractuelles et déontologiques, l'autre partie pourra à tout moment adresser
            à la partie défaillante une notification écrite par lettre recommandée avec accusé de réception,
            avec un préavis de <Val v={preavisUnilateralJours} fallback="[…]" /> jours avant la date où la
            résiliation prendra effet, en spécifiant la nature du manquement et la manière selon laquelle
            il y a lieu d'y remédier. Si la partie qui reçoit la notification prend les mesures nécessaires
            spécifiées dans ladite notification et selon les modalités qui y sont fixées, la résiliation ne
            prend pas effet. À défaut, la résiliation prendra effet au terme du préavis.
          </Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 6 }]}>Article 8.3 — Résiliation de plein droit</Text>
          <Text style={S.body}>
            Le prononcé d'une sanction disciplinaire tenant dans une interdiction d'exercice égale ou
            supérieure à trois mois à l'encontre du Remplaçant et/ou du Remplacé entraîne la résiliation de
            plein droit du présent contrat, sans qu'il soit nécessaire de respecter un quelconque préavis.
            {"\n\n"}
            De même, le présent contrat est résilié de plein droit dès lors que l'indisponibilité
            temporaire du Remplacé devient définitive.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 9 — Renouvellement</Text>
          <Text style={S.body}>
            Le présent contrat est conclu pour la durée fixée à l'article 2. En cas de prolongement
            temporaire de l'indisponibilité du Remplacé, le contrat pourra être prolongé pour une durée
            équivalente qui devra faire l'objet d'un avenant daté et signé par les parties, au plus tard
            au jour du terme du présent contrat.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 10 — Fin du remplacement (clause réglementaire)</Text>
          <Text style={S.body}>
            Au terme du présent contrat, le Remplaçant qui a assuré la continuité des soins délivrés aux
            patients du Remplacé cesse l'ensemble de ses activités de remplacement auprès des patients de
            ce dernier et lui transmet l'ensemble des informations nécessaires à la mise en œuvre de la
            continuité des soins.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 11 — Loyauté et absence de concurrence déloyale (clause réglementaire — art. R.4312-82)</Text>
          <Text style={S.body}>
            Au terme du remplacement, le Remplaçant continue d'exercer en son lieu habituel d'exercice
            professionnel auprès de sa patientèle propre.
            {"\n\n"}
            Toutefois, il s'interdit tout acte de concurrence déloyale, de démarchage et de détournement
            de la patientèle du Remplacé, conformément à l'article R.4312-82 du Code de la santé publique.
            {"\n\n"}
            Dans le respect du principe du libre choix du professionnel de santé par le patient, le
            Remplaçant s'engage à informer le Remplacé de toute sollicitation de la part de l'un de ses
            patients pendant une durée de{" "}
            <Val v={dureeInformationSollicitation} fallback="[durée à compléter]" /> à compter du terme du
            présent contrat, pour quelque cause que ce soit.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 12 — Résolution des différends (clause réglementaire — art. R.4312-25)</Text>
          <Text style={S.body}>
            En cas de difficultés soulevées sur la validité, l'exécution, l'interprétation ou la résolution
            du présent contrat, les parties s'engagent préalablement à toute action contentieuse à
            soumettre leur différend à une tentative de conciliation confiée au besoin au conseil
            (inter)départemental de l'ordre des infirmiers, conformément à l'article R.4312-25 alinéa 4 du
            Code de la santé publique.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 13 — Transmission du contrat (clause réglementaire — art. L.4113-9)</Text>
          <Text style={S.body}>
            Il est obligatoirement transmis par chacune des parties au Conseil (inter)départemental de
            l'Ordre des infirmiers compétent dans le mois qui suit sa conclusion, en vertu de l'article
            L.4113-9 du Code de la santé publique.
            {"\n\n"}
            Les parties s'engagent sur l'honneur à n'avoir passé aucune contre-lettre ou avenant du présent
            contrat qui n'ait été soumis au Conseil (inter)départemental de l'Ordre des infirmiers.
            {"\n\n"}
            Fait en trois exemplaires, dont un pour le Conseil (inter)départemental de l'Ordre des infirmiers.
          </Text>
        </View>

        <View style={S.sigBlock}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le remplacé</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{remplace.name || "[Nom du remplacé]"}</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Date et signature :</Text>
            {signatureTitulaireImg ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- <Image> @react-pdf (PDF), pas une balise HTML img
              <Image style={S.sigImg} src={signatureTitulaireImg} />
            ) : (
              <Text style={[S.sigLabel, { marginTop: 20 }]}> </Text>
            )}
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>Le remplaçant</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{remplacant.name || "[Nom du remplaçant]"}</Text>
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
