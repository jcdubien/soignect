"use client";

import { useState } from "react";
import { ZONE_ORDER, ZONE_LABELS, zoneOfCommune, type ZoneGeo } from "@/lib/communes";

// ── PUBLIER SA DISPONIBILITÉ SANS QUITTER LE FIL (section 288) ───────────────────────────────
//
// CE QUE LA MESURE A TROUVÉ. Le 07/10 : **11 candidats totalisent 30 intérêts** sans avoir
// jamais rien publié. Simoni en a 10 depuis le 11/09, Hippolyte JUE 7 depuis le 23/08. Leur
// geste est bien enregistré — le swipe est en base, vérifié ligne à ligne — mais il ne peut
// RIEN produire : `lib/interetSignale` diffère le signal jusqu'à la publication, et
// `/api/interets-recus` les compte sans les servir, faute de fiche à ouvrir et de mission à
// swiper en retour. Des deux côtés, l'intérêt existe et personne ne peut l'exploiter.
//
// POURQUOI L'AVERTISSEMENT NE SUFFISAIT PAS. Le bandeau de la section 227 dit déjà la vérité
// (« Vous n'apparaissez dans aucun fil »), et il est honnête. Mais son appel à l'action SORT du
// fil : « Publier ma recherche → » mène à un formulaire complet, dans un autre écran, qui perd
// le contexte du geste qu'on venait de faire. Les 30 intérêts dormants mesurent le coût de ce
// détour. Ici la saisie se fait SUR PLACE, à l'instant où l'intention vient d'être prouvée.
//
// LE SWIPE EST ENREGISTRÉ AVANT, JAMAIS APRÈS. L'appelant n'ouvre cette feuille qu'une fois
// `POST /api/swipe` revenu. Deux conséquences voulues : on n'ouvre pas un formulaire pour un
// geste qui a échoué, et « Plus tard » ne perd rien — l'intérêt reste en base, et
// `rattraperInteretsDifferes` le signalera le jour où la personne publiera, par ce chemin ou
// par un autre.
//
// ELLE NE RÉÉCRIT AUCUNE RÈGLE. La publication passe par `POST /api/missions`, exactement comme
// le formulaire complet : photo obligatoire, dates exigées pour un remplacement en recherche,
// durée minimale pour un poste, rattrapage des intérêts différés. Une route express qui
// recopierait ces gardes finirait par en diverger — ce dépôt paie déjà cette facture ailleurs.
//
// CE QU'ELLE NE DEMANDE PAS, ET C'EST DÉLIBÉRÉ :
//   · le TITRE est généré, pas saisi — personne n'abandonne un formulaire sur un champ de
//     trois secondes, mais beaucoup abandonnent sur un champ dont ils ne savent quoi écrire ;
//   · l'ACCROCHE est sautée. Une dispo sans accroche est plus faible dans le fil, mais
//     faible-et-visible bat invisible ; elle se complète ensuite depuis /disponibilites ;
//   · la DIFFUSION FACEBOOK reste à `false` et n'est pas même posée en question. La section 234
//     en fait un choix explicite du candidat parce que sa disponibilité nomme une personne, ses
//     dates et son secteur : l'embarquer dans une feuille de trois secondes produirait une
//     publication publique qu'il n'a pas voulue.

type FormeRecherche = "REMPLACEMENT" | "POSTE";

interface Props {
  /** Nombre de CABINETS qui attendent des dates. 0 = la feuille s'ouvre sur un geste qui vient
   *  d'être fait, sans historique à rappeler. */
  cabinetsEnAttente: number;
  /** L'annonce qui vient d'être retenue, quand il y en a une : elle sert de pré-remplissage
   *  légitime — c'est à ces dates et à ce secteur que la personne vient de dire oui. Absente
   *  quand la feuille s'ouvre sur un intérêt ancien (le rattrapage des 11). */
  annonce?: {
    missionType: string | null;
    estSalariat?: boolean | null;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
  } | null;
  /** Type du profil — sert de forme par défaut quand aucune annonce ne la dicte. */
  profileType?: string;
  onPublie: () => void;
  onReporte: () => void;
}

/** Date ISO → `yyyy-mm-dd` pour un `<input type="date">`, ou chaîne vide. */
function pourChampDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin",
                     "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * `yyyy-mm-dd` → « 2 nov. », SANS passer par `Date`.
 *
 * VÉRIFIÉ À L'ÉCRAN, et c'est pour ça que cette fonction n'est pas une ligne de moins :
 * `new Date("2026-11-02").toLocaleDateString("fr-FR", …)` rend **« 1 nov. »** sur une machine
 * à l'ouest de Greenwich — la chaîne est lue comme minuit UTC, puis affichée en heure locale,
 * donc la veille au soir. La Guadeloupe est à UTC−4 : le décalage est systématique, pas
 * occasionnel. La dispo aurait porté un titre faux d'un jour aux deux bouts, lu par des
 * cabinets qui s'organisent sur ces dates.
 *
 * Les champs du formulaire donnent déjà la date en texte civil. Découper ce texte est la seule
 * lecture qui ne traverse aucun fuseau.
 */
function formatJour(valeur: string): string {
  const [a, m, j] = valeur.split("-").map(Number);
  if (!a || !m || !j) return valeur;
  return `${j} ${MOIS_COURTS[m - 1] ?? ""}`.trim();
}

export default function FeuilleDispoExpress({
  cabinetsEnAttente,
  annonce,
  profileType,
  onPublie,
  onReporte,
}: Props) {
  // La forme par défaut suit l'annonce retenue quand il y en a une. Sinon le type du profil —
  // un ASSISTANT cherche un poste, un REMPLACANT un remplacement. Dans tous les cas le choix
  // reste OUVERT : la mesure montre que les mêmes personnes retiennent les deux (Simoni a
  // swipé de l'assistanat ET du remplacement), donc le déduire sans le laisser changer
  // publierait une recherche qui n'est pas la leur.
  const formeInitiale: FormeRecherche = annonce
    ? annonce.estSalariat || annonce.missionType !== "REMPLACEMENT"
      ? "POSTE"
      : "REMPLACEMENT"
    : profileType === "ASSISTANT"
      ? "POSTE"
      : "REMPLACEMENT";

  const [forme, setForme] = useState<FormeRecherche>(formeInitiale);
  const [debut, setDebut] = useState(pourChampDate(annonce?.startDate));
  const [fin, setFin] = useState(pourChampDate(annonce?.endDate));
  const [minMonths, setMinMonths] = useState("6");
  // Pré-sélection depuis la commune de l'annonce retenue, et d'elle seule. Cocher « toute la
  // Guadeloupe » par défaut serait plus rapide mais ferait promettre une mobilité que personne
  // n'a déclarée — un cabinet des Saintes verrait remonter quelqu'un qui n'y mettra jamais
  // les pieds.
  const zoneAnnonce = annonce ? zoneOfCommune(annonce.location) : null;
  const [zones, setZones] = useState<ZoneGeo[]>(zoneAnnonce ? [zoneAnnonce] : []);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const datesCompletes = forme === "REMPLACEMENT" ? !!debut && !!fin : true;
  const valide = zones.length > 0 && datesCompletes && !envoi;

  function basculerZone(z: ZoneGeo) {
    setZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  }

  async function publier() {
    if (!valide) return;
    setEnvoi(true);
    setErreur("");

    // `location` dérivé des zones, comme le formulaire complet (section 148) : côté candidat
    // la commune ne se saisit pas, elle sert d'étiquette d'affichage et le matching passe par
    // les zones. Réécrire cette dérivation autrement ferait diverger les deux chemins.
    const etiquetteGeo =
      zones.length === ZONE_ORDER.length
        ? "Toute la Guadeloupe"
        : zones.map((z) => ZONE_LABELS[z]).join(", ");

    const titre =
      forme === "REMPLACEMENT"
        ? `Remplacement — ${etiquetteGeo} — ${formatJour(debut)} au ${formatJour(fin)}`
        : `Poste long terme — ${etiquetteGeo} — ${minMonths} mois minimum`;

    const r = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Tronqué à 100 : c'est le cap de `createMissionSchema`, et une étiquette géographique
        // longue (dix zones nommées) le dépasserait — un refus 400 sur un titre que la personne
        // n'a même pas écrit serait incompréhensible.
        title: titre.slice(0, 100),
        location: etiquetteGeo,
        zones,
        specialties: [],
        missionType: forme === "REMPLACEMENT" ? "REMPLACEMENT" : "ASSISTANAT",
        // Un poste long terme n'a pas de date de fin (section 179) : c'est `minMonths` qui le
        // place, et envoyer un `endDate` ferait buter sur la garde des 90 jours.
        startDate: debut ? new Date(debut).toISOString() : null,
        endDate: forme === "REMPLACEMENT" && fin ? new Date(fin).toISOString() : null,
        minMonths: forme === "POSTE" ? parseInt(minMonths, 10) : null,
        briqueStatus: "RECHERCHE",
        diffuserSurFacebook: false,
      }),
    }).catch(() => null);

    if (!r || !r.ok) {
      const data = r ? await r.json().catch(() => ({})) : {};
      // Le message du serveur PRIME quand il en donne un : c'est lui qui connaît la raison
      // exacte (photo manquante, dates incohérentes), et la paraphraser ici produirait deux
      // vérités concurrentes sur la même règle.
      setErreur(
        typeof data?.error === "string"
          ? data.error
          : "La publication a échoué. Votre intérêt reste enregistré — vous pouvez réessayer.",
      );
      setEnvoi(false);
      return;
    }
    onPublie();
  }

  // Le titre dit ce qui est EN JEU, avec le nombre réel. « 7 cabinets attendent vos dates » est
  // un fait vérifiable ; « complétez votre profil » n'en est pas un.
  const titre =
    cabinetsEnAttente > 1
      ? `${cabinetsEnAttente} cabinets attendent vos dates`
      : annonce
        ? "Ce cabinet ne peut pas encore vous répondre"
        : "Un cabinet attend vos dates";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-3 pb-3 sm:pb-0">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-100 p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-bold text-gray-800">{titre}</h2>
        <p className="mt-1 text-[12px] leading-snug text-gray-500">
          Votre intérêt est bien enregistré, mais vous n&apos;apparaissez dans aucun fil : sans
          disponibilité publiée, personne n&apos;a de fiche à ouvrir pour vous répondre. Deux
          champs suffisent.
        </p>

        {/* Forme de recherche — déduite, jamais imposée. */}
        <div className="mt-4 flex gap-2">
          {(["REMPLACEMENT", "POSTE"] as FormeRecherche[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setForme(f)}
              className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold transition ${
                forme === f
                  ? "border-[#0B3D5C] bg-[#0B3D5C]/[0.06] text-[#0B3D5C]"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {f === "REMPLACEMENT" ? "Un remplacement" : "Un poste long terme"}
            </button>
          ))}
        </div>

        {forme === "REMPLACEMENT" ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Disponible du</label>
              <input
                type="date"
                value={debut}
                onChange={(e) => setDebut(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#0B3D5C] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">au</label>
              <input
                type="date"
                value={fin}
                min={debut || undefined}
                onChange={(e) => setFin(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#0B3D5C] focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">
                Disponible à partir du
              </label>
              <input
                type="date"
                value={debut}
                onChange={(e) => setDebut(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#0B3D5C] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Durée minimale</label>
              <select
                value={minMonths}
                onChange={(e) => setMinMonths(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#0B3D5C] focus:outline-none"
              >
                {[3, 6, 12, 24].map((m) => (
                  <option key={m} value={String(m)}>
                    {m} mois
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="block text-[11px] text-gray-400 mb-1.5">
            Secteurs où vous pouvez exercer
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ZONE_ORDER.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => basculerZone(z)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  zones.includes(z)
                    ? "border-[#0B3D5C] bg-[#0B3D5C] text-white"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {ZONE_LABELS[z]}
              </button>
            ))}
          </div>
        </div>

        {erreur && (
          <p className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[11px] text-red-700">
            {erreur}
          </p>
        )}

        <button
          type="button"
          onClick={publier}
          disabled={!valide}
          className="mt-4 w-full rounded-lg bg-[#0B3D5C] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0B3D5C]/90 disabled:opacity-40"
        >
          {envoi
            ? "Publication…"
            : cabinetsEnAttente > 1
              ? `Publier — prévenir les ${cabinetsEnAttente} cabinets`
              : "Publier ma disponibilité"}
        </button>
        <button
          type="button"
          onClick={onReporte}
          disabled={envoi}
          className="mt-2 w-full px-4 py-1.5 text-[12px] text-gray-400 hover:text-gray-600"
        >
          Plus tard
        </button>
        {/* Dire ce que « Plus tard » ne coûte pas. Sans cette phrase, refuser la feuille se lit
            comme perdre le geste qu'on venait de faire — et c'est faux. */}
        <p className="mt-1 text-center text-[10px] text-gray-400">
          Votre intérêt reste enregistré dans tous les cas.
        </p>
      </div>
    </div>
  );
}
