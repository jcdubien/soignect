import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { BriqueStatus } from "@prisma/client";
import { phraseIntentionPartage } from "@/lib/libellesPoste";

// Image de partage Open Graph générée dynamiquement par annonce (section 158) — 1200×630.
// Priorité aux 3 infos essentielles pour un candidat qui scrolle (mobile) : TYPE, DATES, COMMUNE.
// Tout est borné pour ne JAMAIS déborder du cadre : titre en police dynamique + 2 lignes max,
// dates/commune chacune sur sa ligne (ellipsis si trop long).
export const runtime = "nodejs"; // accès Prisma (DB) → runtime Node, pas edge
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Annonce Soignect";

/** Opacité du voile posé sur la photo de fond. Réglable ici seul — voir la mesure de contraste
 *  au point de pose. Surchargeable en développement pour rejouer le protocole de mesure. */
const OPACITE_VOILE = Number(process.env.OG_OPACITE_VOILE ?? "0.38");

/** Opacité du bandeau central, posé UNIQUEMENT derrière la colonne de texte. C'est lui qui porte
 *  le contraste ; le voile global ci-dessus ne fait plus qu'unifier la photo. */
const OPACITE_BANDEAU = Number(process.env.OG_OPACITE_BANDEAU ?? "0.58");

/** Ombre portée des textes. Reprend LOCALEMENT le contraste que le voile assurait globalement :
 *  un halo sombre serré suit le texte au lieu d'assombrir toute la photo.
 *
 *  TOUJOURS POSÉE PAR SPREAD (`...(photo ? { textShadow: OMBRE_TEXTE } : {})`), jamais par un
 *  ternaire retombant sur `undefined` : ce moteur lit la propriété dès qu'elle EXISTE, et plante
 *  sur une valeur absente — « Cannot read properties of undefined ». La règle était déjà écrite
 *  plus bas pour `backgroundImage` ; l'ignorer ici a bel et bien renvoyé un 500 sur le repli sans
 *  photo, constaté le 01/09 avant correction. */
const OMBRE_TEXTE = "0 2px 10px rgba(0,0,0,0.85), 0 0 26px rgba(0,0,0,0.6)";

// Le badge est cadré selon le PROPRIÉTAIRE de l'annonce : un cabinet PROPOSE un poste, un
// candidat SE PROPOSE, un établissement EMBAUCHE. Les trois tables de libellés vivent dans
// lib/libellesPoste — elles étaient écrites en dur ici, si bien qu'un CDI hospitalier se
// partageait sur Facebook sous le libellé « Collaboration libérale ».

// Dates « jour seul » stockées à minuit UTC → format en UTC (cf. lib/dates.ts).
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const ym = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

// Libellé de dates concis et lisible — approximatif si besoin plutôt que tronqué (mois/année).
function datesLabel(m: { startDate: Date | null; endDate: Date | null; minMonths: number | null }): string {
  const s = m.startDate ? new Date(m.startDate) : null;
  const e = m.endDate ? new Date(m.endDate) : null;
  // Glyphes limités à ceux présents dans la police Satori (pas de « ≥ » ni « → » → carrés).
  if (s && e) {
    const sameMonth = s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth();
    return sameMonth ? ym(s) : `${MONTHS[s.getUTCMonth()]} - ${ym(e)}`;
  }
  if (s) return `Dès ${ym(s)}`;
  if (m.minMonths) return `Longue durée · min. ${m.minMonths} mois`;
  return "Dates à convenir";
}

// Photo de fond : on la télécharge NOUS-MÊMES et on la passe en data URI, au lieu de laisser
// le générateur d'image aller la chercher. Raison : si ce téléchargement échoue au moment du
// rendu, c'est TOUTE l'image de partage qui échoue — or les caches sociaux retiennent
// longtemps un aperçu cassé. Ici, un échec dégrade simplement vers le fond dégradé d'origine.
// Délai borné pour la même raison : un stockage lent ne doit pas faire expirer le rendu.
async function fondPhoto(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 6_000_000) return null; // vide ou déraisonnable
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let m;
  try {
    m = await prisma.mission.findFirst({
      // Même règle que la page publique et le sitemap : seules les annonces EN RECHERCHE
      // ont une image de partage. Sinon on générait une carte Facebook pour des congés.
      where: { id, isActive: true, briqueStatus: BriqueStatus.RECHERCHE },
      select: {
        title: true, location: true, missionType: true,
        startDate: true, endDate: true, minMonths: true,
        // photoUrl : fond de la carte (section 158). type : cadre le badge (cabinet propose / candidat se propose).
        // titulaireKind : distingue un établissement d'un cabinet libéral, sans quoi le
        // badge traduit un CDI en vocabulaire libéral.
        profile: { select: { type: true, titulaireKind: true, photoUrl: true } },
      },
    });
  } catch {
    // Panne base : surtout PAS 404 — les caches sociaux (Facebook, LinkedIn) retiennent
    // longtemps un 404 et l'aperçu resterait cassé pour une annonce pourtant valide.
    // 503 = temporaire, le scraper réessaiera.
    return new Response("Image de partage temporairement indisponible", { status: 503 });
  }

  // Pas d'annonce publique → pas d'image de partage. On renvoie 404 plutôt qu'une carte
  // générique, pour rester cohérent avec /annonce/[id] qui renvoie notFound().
  if (!m) return new Response("Not found", { status: 404 });

  const location = m.location;
  // Phrase d'intention, pas étiquette de poste (section 220). « Remplacement » ne disait pas si
  // un cabinet cherchait quelqu'un ou si quelqu'un se proposait — sur Facebook, le lecteur n'a
  // aucun contexte pour trancher. La table vit dans lib/libellesPoste, avec les autres.
  const type = phraseIntentionPartage(m.missionType, m.profile);
  const dates = datesLabel(m);

  // Zone de sécurité : beaucoup de destinations de partage (messageries, aperçus système via
  // navigator.share) RECADRENT le 1200x630 en carré centré — soit les 630 px du milieu. Tout ce
  // qui vivait sur les bords en sortait coupé : marque, badge, début du titre. L'essentiel tient
  // donc dans une colonne centrée de 600 px, qui survit au recadrage carré comme au 1.91:1.
  const SAFE = 600;

  // ── Titre borné à 2 lignes, CALCULÉ ET NON DÉLÉGUÉ AU CSS ──────────────────────────────
  //
  // Le fichier promettait « 2 lignes max » via `WebkitLineClamp: 2`. Cette propriété est
  // IGNORÉE par le moteur de rendu d'images : vérifié en la passant à 1, le titre sortait
  // toujours sur 3 lignes. La garantie n'a donc jamais existé — un titre de 89 caractères en
  // occupait bien 3.
  //
  // On la reconstruit par le calcul. Largeur moyenne d'un glyphe MESURÉE sur des rendus réels :
  // 14,4 px à fontSize 30 sur trois lignes de longueurs différentes (14,47 / 14,36 / 14,22),
  // soit 0,48 em. Arrondi à 0,50 pour garder de la marge sur les titres riches en capitales.
  const LARGEUR_GLYPHE_EM = 0.5;
  const TAILLES = [54, 44, 36, 30] as const;

  // On SIMULE la césure au lieu de l'approximer par un nombre de caractères. Un budget global
  // ne marche pas : la coupe se fait sur les MOTS, et le gaspillage en fin de ligne dépend du
  // titre. Mesuré — « Kiné remplaçant à Pointe-Noire (Guadeloupe) - Équipe polyvalente, MSP, »
  // tient 69 caractères en 2 lignes là où un budget arithmétique en autorisait 74, et les
  // 5 excédentaires passaient sur une 3e ligne.
  function lignes(texte: string, size: number): string[] {
    const parLigne = Math.max(1, Math.floor(SAFE / (LARGEUR_GLYPHE_EM * size)));
    const out: string[] = [];
    let courante = "";
    for (const mot of texte.split(/\s+/).filter(Boolean)) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (essai.length <= parLigne) courante = essai;
      else { if (courante) out.push(courante); courante = mot; }
    }
    if (courante) out.push(courante);
    return out;
  }

  const brut = m.title.trim();
  // La plus GRANDE police qui tient en 2 lignes ; à défaut la plus petite, et on coupe.
  const titleSize = TAILLES.find((t) => lignes(brut, t).length <= 2) ?? TAILLES[TAILLES.length - 1];

  // Troncature mot à mot jusqu'à tenir, plutôt qu'une coupe au milieu d'un mot : on retire le
  // dernier mot tant que l'ellipsis ne rentre pas en 2 lignes.
  let title = brut;
  if (lignes(title, titleSize).length > 2) {
    const mots = brut.split(/\s+/).filter(Boolean);
    while (mots.length > 1) {
      mots.pop();
      const essai = mots.join(" ") + "…";
      if (lignes(essai, titleSize).length <= 2) { title = essai; break; }
    }
    if (title === brut) title = mots.join(" ") + "…"; // titre d'un seul mot très long
  }

  // Le badge porte désormais une PHRASE, pas un mot : sa largeur n'est plus garantie d'avance.
  // Même méthode que le titre — on choisit la plus grande taille qui tient sur UNE ligne, plutôt
  // que de faire confiance à `whiteSpace: nowrap`, qui ne rétrécit rien et laisse simplement
  // déborder. Largeur utile = colonne de sécurité moins les 22 px de padding de chaque côté.
  const TAILLES_BADGE = [30, 26, 22] as const;
  const LARGEUR_BADGE = SAFE - 44;
  const tientEnUneLigne = (t: number) =>
    type.length * LARGEUR_GLYPHE_EM * t <= LARGEUR_BADGE;
  const badgeSize = TAILLES_BADGE.find(tientEnUneLigne) ?? TAILLES_BADGE[TAILLES_BADGE.length - 1];

  const photo = await fondPhoto(m.profile?.photoUrl);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          backgroundColor: "#0B3D5C",
          // Repli conservé tel quel : sans photo, la carte est exactement celle d'avant.
          // La clé est OMISE quand il y a une photo, jamais mise à undefined : le moteur de rendu
          // lit la propriété dès qu'elle existe et appelle .trim() dessus — undefined le fait
          // planter, et c'est TOUTE l'image de partage qui tombe en 500 (constaté en prod).
          ...(photo ? {} : { backgroundImage: "linear-gradient(135deg, #0B3D5C 0%, #12708f 55%, #1aa0a0 100%)" }),
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {photo && (
          <img
            src={photo}
            width={1200}
            height={630}
            // PAS D'`objectPosition` ICI. Remonter le cadrage sur le visage aurait du sens — une
            // photo de profil est presque toujours un portrait vertical, recadré au centre dans un
            // 1200×630. Mais la propriété est SILENCIEUSEMENT IGNORÉE par ce moteur : vérifié le
            // 01/09 en rendant la même annonce avec « 50% 0% » puis « 50% 100% », les deux PNG ont
            // la même empreinte MD5. C'est le piège déjà rencontré ici avec `WebkitLineClamp`.
            // On n'écrit donc pas une propriété qui n'agit pas : le cadrage reste centré, et c'est
            // l'allègement du voile qui règle le problème signalé.
            style={{
              position: "absolute", top: 0, left: 0, width: 1200, height: 630,
              objectFit: "cover",
            }}
          />
        )}
        {/* Voile gris uniforme. Une photo de profil peut être claire, sombre, chargée : un voile
            unique garantit le contraste du texte blanc quelle qu'elle soit, là où un dégradé
            laisserait des zones illisibles selon le cliché.
            OPACITÉ MESURÉE, pas estimée. Sur une photo de cabinet très lumineuse, contraste
            blanc/fond au 95e centile des zones sans texte : 4,06:1 à 58 %, 5,33:1 à 68 %,
            6,79:1 à 76 %. Le seuil confortable est 4,5:1 (AA gros texte : 3:1).

            BAISSÉ À 46 % LE 01/09 (section 220). À 68 %, la photo était délavée au point d'être
            lue comme floue — elle est pourtant parfaitement nette, vérifié sur le rendu réel.
            Le contraste n'est pas sacrifié pour autant : il est repris par une ombre portée sur
            chaque texte, qui agit LOCALEMENT et ne dépend donc pas de la luminosité du cliché.
            C'est ce que le voile global faisait payer à toute l'image pour protéger 30 % de sa
            surface. Nouvelle mesure au même protocole ci-dessous. */}
        {photo && (
          <div
            style={{
              position: "absolute",
              top: 0, left: 0, width: 1200, height: 630,
              display: "flex",
              backgroundColor: `rgba(42,45,48,${OPACITE_VOILE})`,
            }}
          />
        )}

        {/* Bandeau central. LE PROBLÈME QU'IL RÉSOUT : un voile uniforme fait payer à toute la
            photo la lisibilité de 30 % de sa surface — c'est pour cela qu'à 68 % un cliché
            parfaitement net se lisait comme flou. Le texte vit dans une colonne centrée (SAFE) ;
            on protège donc cette colonne-là, et on laisse les bords rendre la photo.
            Les extrémités sont fondues : une arête franche aurait dessiné une bande visible, plus
            laide que le voile qu'elle remplace. Ce dégradé est HORIZONTAL et couvre toute la
            hauteur — il ne rouvre pas le défaut que le voile global évitait, à savoir des zones de
            texte laissées sans protection. */}
        {photo && (
          <div
            style={{
              position: "absolute",
              top: 0, left: (1200 - 980) / 2, width: 980, height: 630,
              display: "flex",
              // Gris NEUTRE, pas la couleur de marque : une teinte colorée virait la photo au
              // bleu, ce qui la dénature autant que le voile qu'on vient d'alléger.
              // Fondu très large (0 → 30 % → 70 % → 100 %) : à 16 % la transition se voyait comme
              // une bande rectangulaire posée sur le cliché.
              backgroundImage:
                `linear-gradient(90deg, rgba(28,30,33,0) 0%, rgba(28,30,33,${OPACITE_BANDEAU}) 30%, ` +
                `rgba(28,30,33,${OPACITE_BANDEAU}) 70%, rgba(28,30,33,0) 100%)`,
            }}
          />
        )}

        {/* Calque de contenu — reprend la mise en page d'origine à l'identique. */}
        <div
          style={{
            position: "relative",
            width: 1200,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            textAlign: "center",
            padding: 48,
          }}
        >
        {/* En-tête marque */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800, letterSpacing: -1, opacity: 0.95, ...(photo ? { textShadow: OMBRE_TEXTE } : {}) }}>
          Soignect
        </div>

        {/* Corps : type (badge) + titre + dates + commune */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: SAFE }}>
          <div
            style={{
              display: "flex",
              alignSelf: "center",
              fontSize: badgeSize,
              fontWeight: 700,
              padding: "8px 22px",
              borderRadius: 999,
              // Pastille assombrie plutôt qu'éclaircie : le voile de fond ayant baissé, un fond
              // blanc translucide sur une photo claire ne détachait plus la phrase.
              background: photo ? "rgba(11,61,92,0.72)" : "rgba(255,255,255,0.18)",
              marginBottom: 26,
              whiteSpace: "nowrap",
            }}
          >
            {type}
          </div>

          {/* Titre — la limite à 2 lignes est garantie par le CALCUL ci-dessus (police choisie
              + troncature), pas par du CSS : `WebkitLineClamp` est ignoré par ce moteur. */}
          <div
            style={{
              display: "flex",
              overflow: "hidden",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.08,
              width: SAFE,
              textAlign: "center",
              ...(photo ? { textShadow: OMBRE_TEXTE } : {}),
            }}
          >
            {title}
          </div>

          {/* Les 2 essentiels restants — libellés texte (pas d'emoji : absent de la police Satori),
              chacun sur sa ligne, valeur en ellipsis si trop longue → jamais de débordement. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28, width: SAFE }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, maxWidth: SAFE }}>
              <div style={{ display: "flex", width: 118, fontSize: 24, fontWeight: 700, letterSpacing: 2, opacity: photo ? 0.9 : 0.65, ...(photo ? { textShadow: OMBRE_TEXTE } : {}) }}>DATES</div>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 460, ...(photo ? { textShadow: OMBRE_TEXTE } : {}) }}>{dates}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, maxWidth: SAFE }}>
              <div style={{ display: "flex", width: 118, fontSize: 24, fontWeight: 700, letterSpacing: 2, opacity: photo ? 0.9 : 0.65, ...(photo ? { textShadow: OMBRE_TEXTE } : {}) }}>LIEU</div>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 460, ...(photo ? { textShadow: OMBRE_TEXTE } : {}) }}>{location}</div>
            </div>
          </div>
        </div>

        {/* Pied */}
        <div style={{ display: "flex", justifyContent: "center", fontSize: 22, opacity: photo ? 0.95 : 0.82, maxWidth: SAFE, textAlign: "center", ...(photo ? { textShadow: OMBRE_TEXTE } : {}) }}>
          La mise en relation des professionnels de santé en Guadeloupe
        </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
