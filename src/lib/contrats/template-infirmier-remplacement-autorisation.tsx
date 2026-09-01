/* eslint-disable react/no-unescaped-entities */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { type ContractDataRemplacementInfirmierAutorise, SIGNATURE_LEGAL_MENTION } from "./types";
import { DraftWatermark } from "./watermark";
import { PartyIdentityRows } from "./party-identity";
import { fmtDateUTC } from "@/lib/contrats/date";

// CONTRAT DE REMPLACEMENT INFIRMIER — variante « remplaçant titulaire d'une AUTORISATION ».
// Transcrit du modèle du Conseil national de l'Ordre des infirmiers, mis à jour le 15/11/2023.
//
// POURQUOI DEUX VARIANTES DE REMPLACEMENT, LÀ OÙ LE KINÉ N'EN A QU'UNE
// Le CNOI publie deux modèles distincts selon le statut du remplaçant : confrère déjà INSTALLÉ,
// ou titulaire d'une simple AUTORISATION d'exercice délivrée par le conseil de l'Ordre. Ce n'est
// pas une nuance de rédaction — les deux diffèrent sur qui facture, avec quels identifiants, et
// dans quel sens circule l'argent. Celui-ci couvre le second cas.
//
// LE SENS DE LA RÉTROCESSION EST INVERSÉ par rapport au gabarit kiné, et c'est le piège de ce
// document. Chez le CNOMK, le remplaçant encaisse et reverse un pourcentage au remplacé. Ici le
// remplaçant n'étant pas installé, c'est le REMPLACÉ qui perçoit et qui reverse. Réutiliser
// `retrocessionPct` aurait inversé un pourcentage sur un document signé — d'où un type dédié.
//
// CE QUI A ÉTÉ TRANSCRIT, ET CE QUI NE L'A PAS ÉTÉ
// Les PDF du CNOI sont les versions COMMENTÉES, qui portent la mention « vous ne devez pas
// l'utiliser comme contrat à signer ». Seul le texte contractuel est repris ; les blocs
// « Commentaire : » — 9 dans ce document — sont écartés. Ils expliquent le droit, ils ne
// l'énoncent pas.
//
// LES TROIS ALTERNATIVES DU MODÈLE, tranchées par Jean-Charles le 27/08 :
//   • art. 2  — période exprimée « du … au … » avec planning annexé, plutôt qu'en liste de jours
//               (Soignect porte startDate/endDate, rien qui décrive une liste de jours) ;
//   • art. 5  — le remplaçant facture avec SA carte CPS « remplaçant », plutôt qu'avec les
//               feuilles pré-identifiées au nom du remplacé ;
//   • art. 11 — zone de non-concurrence exprimée en RAYON de kilomètres, plutôt qu'en liste de
//               communes (rayonKm existe déjà et sert la clause équivalente côté kiné).
// Ces choix ne sont pas des détails d'implémentation : chacun change ce que les parties signent.
// Les inscrire ici plutôt que de les rendre configurables est délibéré — un choix par contrat
// aurait multiplié les combinaisons sans qu'aucun besoin réel ne le demande.
//
// LES CLAUSES MARQUÉES « clause réglementaire » portent un astérisque dans le modèle du CNOI.
// Son préambule est explicite : ce sont des clauses essentielles « auxquelles il n'est pas
// possible de déroger » (art. R.4312-73 CSP), qui doivent obligatoirement figurer au contrat.
// Même marquage que les gabarits kiné, pour la même raison : le lecteur doit voir ce qui ne se
// négocie pas.

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

const LEGAL_MENTION =
  "Document pré-rempli à titre indicatif — à faire valider par un avocat ou l'Ordre des infirmiers avant signature.";

/** Valeur saisie, ou repli visible plutôt qu'un blanc silencieux. */
function Val({ v, fallback }: { v?: string | number | null; fallback: string }) {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s.length > 0 ? <Text>{s}</Text> : <Text style={S.placeholder}>{fallback}</Text>;
}

export function buildRemplacementInfirmierAutorisePdf(data: ContractDataRemplacementInfirmierAutorise) {
  const {
    remplace, remplacant, startDate, endDate,
    reversementDirectPct, reversementDirectDelaiMois,
    reversementTiersPayantPct, reversementTiersPayantDelaiMois,
    rayonKm, preavisCommunAccordJours, preavisUnilateralJours,
    moyensMisADisposition, generatedAt,
    signatureTitulaireImg, signatureRemplacantImg, draft,
  } = data;

  return (
    <Document title="Contrat de remplacement infirmier" author="Soignect">
      <Page size="A4" style={S.page}>

        <View style={S.header}>
          <Text style={S.title}>Contrat de remplacement</Text>
          <Text style={S.subtitle}>Entre un infirmier libéral et un infirmier titulaire d'une autorisation</Text>
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
          {/* Trois mentions propres à cette variante, exigées par le modèle du CNOI. */}
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>N° d'autorisation :</Text>
            <Text style={S.infoVal}><Val v={remplacant.autorisationNumero} fallback="[n° d'autorisation à compléter]" /></Text>
          </View>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>Délivrée le :</Text>
            <Text style={S.infoVal}><Val v={remplacant.autorisationDate} fallback="[date de l'autorisation à compléter]" /></Text>
          </View>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>Autorisé par la CPAM de :</Text>
            <Text style={S.infoVal}><Val v={remplacant.cpamRattachement} fallback="[CPAM à compléter]" /></Text>
          </View>
        </View>

        <Text style={S.body}>Il a été convenu et arrêté ce qui suit :</Text>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 1er — Objet</Text>
          <Text style={S.body}>
            Le Remplaçant exercera, pendant la durée du remplacement prévue à l'article 2 du présent contrat,
            la profession d'infirmier en lieu et place du Remplacé, indisponible temporairement.
            {"\n\n"}
            Les patients devront être informés dès que possible de la présence d'un infirmier remplaçant,
            notamment lors de visites à domicile ou de rendez-vous au cabinet.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 2 — Durée (clause réglementaire)</Text>
          <Text style={S.body}>
            Le présent contrat est conclu du {fmtDateUTC(startDate)} au {fmtDateUTC(endDate)}, et selon un
            planning annexé au présent contrat daté et signé et déterminé dans un délai raisonnable.
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
            remplaçant, la durée et les dates de son remplacement, ainsi que le numéro et la date de
            délivrance de l'autorisation par le Conseil de l'Ordre ;
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
            Le Remplaçant utilisera la carte de professionnel de santé (CPS) remplaçant à l'occasion de
            son activité de soins et pendant la durée du présent contrat.
            {"\n\n"}
            En cas d'usage de feuilles de soins, il devra y faire mention de son identification personnelle.
            {"\n\n"}
            En cas de paiement direct par l'assuré au Remplaçant : le Remplaçant percevra lui-même pour le
            compte du Remplacé l'ensemble des honoraires correspondant aux actes effectués sur les patients
            à qui il aura donné ses soins. Un bordereau récapitulatif sera tenu à cet effet par le
            Remplaçant, et ces recettes seront remises au Remplacé au terme du remplacement.
            {"\n\n"}
            Dans ce cas, le Remplaçant devra justifier auprès du Remplacé l'ensemble brut des honoraires et
            rémunérations perçus par lui pour le compte du Remplacé pendant son activité de remplacement,
            par un relevé des actes effectués ou des rémunérations perçues, quels qu'en soient le montant
            et la forme, y compris les recettes devant être encaissées a posteriori.
            {"\n\n"}
            Sur le total des honoraires perçus pendant le remplacement au titre des soins que le Remplaçant
            a effectivement accomplis, à l'exception des indemnités kilométriques, le Remplacé lui en
            reversera <Val v={reversementDirectPct} fallback="[…]" /> %, et ce dans un délai de{" "}
            <Val v={reversementDirectDelaiMois} fallback="[…]" /> mois qui suit la fin du remplacement.
            {"\n\n"}
            En cas de tiers payant, le Remplacé continue de recevoir directement des caisses d'assurance
            maladie les honoraires remboursés pour les actes effectués par le Remplaçant. Sur le total de
            ces honoraires au titre des actes que le Remplaçant a effectivement effectués, le Remplacé lui
            en reversera <Val v={reversementTiersPayantPct} fallback="[…]" /> %, et ce dans un délai de{" "}
            <Val v={reversementTiersPayantDelaiMois} fallback="[…]" /> mois suivant la fin du remplacement.
          </Text>
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
            résiliation doit prendre effet, en spécifiant la nature du manquement et la manière selon
            laquelle il y a lieu d'y remédier. Si la partie qui reçoit la notification prend les mesures
            nécessaires spécifiées dans ladite notification et selon les modalités qui sont fixées, la
            résiliation ne prend pas effet. À défaut, la résiliation prendra effet au terme du préavis.
          </Text>
          <Text style={[S.articleTitle, { fontSize: 9.5, marginTop: 6 }]}>Article 8.3 — Résiliation de plein droit</Text>
          <Text style={S.body}>
            Le prononcé d'une sanction disciplinaire tenant dans une interdiction d'exercice égale ou
            supérieure à trois mois à l'encontre de l'infirmier remplaçant et/ou de l'infirmier remplacé
            entraîne la résiliation de plein droit du présent contrat, sans qu'il soit nécessaire de
            respecter un quelconque préavis.
            {"\n\n"}
            De même, le présent contrat est résilié de plein droit dès lors que l'indisponibilité
            temporaire de l'infirmier remplacé devient définitive.
            {"\n\n"}
            Enfin, le retrait de l'autorisation de remplacement par le Conseil (inter)départemental
            entraîne de plein droit la résiliation anticipée du contrat de remplacement.
          </Text>
        </View>

        <View style={S.article}>
          <Text style={S.articleTitle}>Article 9 — Renouvellement</Text>
          <Text style={S.body}>
            Le présent contrat est conclu pour la durée fixée à l'article 2. En cas de prolongement
            temporaire de l'indisponibilité de l'infirmier remplacé, le contrat pourra être prolongé pour
            une durée équivalente qui devra faire l'objet d'un avenant daté et signé par les parties, au
            plus tard au jour du terme du présent contrat.
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
          <Text style={S.articleTitle}>Article 11 — Non-concurrence (clause réglementaire — art. R.4312-87)</Text>
          <Text style={S.body}>
            Conformément à l'article R.4312-87 du Code de la santé publique, l'infirmier qui remplace un de
            ses confrères pendant une période supérieure à trois mois, consécutifs ou non, ne doit pas,
            pendant une période de deux ans, s'installer dans un cabinet où il puisse entrer en concurrence
            directe avec le confrère remplacé et, éventuellement, avec les infirmiers exerçant en
            association ou en société avec celui-ci, à moins qu'il n'y ait entre les intéressés un accord,
            lequel doit être notifié au conseil (inter)départemental de l'ordre. Cette zone géographique est
            fixée d'un commun accord à un rayon de {rayonKm} km autour du lieu d'exercice.
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
          <Text style={S.articleTitle}>Article 13 — Transmission à l'Ordre (clause réglementaire — art. L.4113-9)</Text>
          <Text style={S.body}>
            Conformément aux dispositions de l'article L.4113-9 du Code de la santé publique, ce contrat est
            communiqué par chacune des parties au Conseil (inter)départemental de l'Ordre des infirmiers du
            tableau auquel elles sont inscrites, dans un délai d'un mois à compter de sa signature.
            {"\n\n"}
            Les parties affirment sur l'honneur n'avoir passé aucune contre-lettre ou avenant relatif au
            présent contrat qui ne soit soumis au Conseil (inter)départemental de l'Ordre des infirmiers
            compétent.
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
