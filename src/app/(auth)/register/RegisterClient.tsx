"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Profession } from "@prisma/client";
import { PROFESSION_LABELS, GROUPES_PROFESSION } from "@/lib/professions";
import { contratFourniParEmployeur } from "@/lib/contrats/gabaritsSalarie";
import { accrocheProfilExemple, pourIle } from "@/lib/exemplesPublication";
import { signIn, getSession } from "next-auth/react";
import Image from "next/image";
import { bioLimitFor } from "@/lib/bio";
import { destinationApresInscription, enTantQue, libelleInscription, titreIdentite } from "@/lib/inscription";
import PhotoUpload from "@/components/ui/PhotoUpload";
import { PHONE_COUNTRIES, toE164 } from "@/lib/phone";
import { CONSENTEMENT_WHATSAPP } from "@/lib/whatsapp";
import { TERRITOIRES, LIBELLE_TERRITOIRE, territoireDe, type Territoire } from "@/lib/communes";

type ProfileTypeChoice = "TITULAIRE" | "REMPLACANT" | "ASSISTANT";

// Création du profil avec un retry automatique (durcissement) : le pooler Supabase
// peut échouer ponctuellement sous charge. En cas de 5xx ou d'erreur réseau, on
// réessaie une seule fois après 500 ms avant de remonter l'erreur à l'utilisateur.
async function createProfileWithRetry(payload: Record<string, unknown>): Promise<Response> {
  const opts: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
  try {
    const res = await fetch("/api/profiles", opts);
    if (res.status >= 500) {
      await new Promise((r) => setTimeout(r, 500));
      return fetch("/api/profiles", opts);
    }
    return res;
  } catch {
    // Erreur réseau — une seule nouvelle tentative
    await new Promise((r) => setTimeout(r, 500));
    return fetch("/api/profiles", opts);
  }
}

// Item 20 — starters différenciés selon le profil
const BIO_STARTERS_CANDIDATE = ["Je suis…", "Je cherche…", "J'aspire à…"] as const;
const BIO_STARTERS_TITULAIRE = ["Je propose…"] as const;           // cabinet libéral (singulier)
const BIO_STARTERS_STRUCTURE = ["Nous proposons…"] as const;       // établissement employeur (pluriel)

export default function RegisterPage() {
  // Suspense requis car RegisterForm lit useSearchParams (section 3)
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get("return_to");
  // Invitation à rejoindre un poste (section 187) : le lien reçu par email porte un token.
  // Il était généré et résolu, mais AUCUN écran ne le consommait — l'invité·e s'inscrivait
  // sans jamais être rattaché·e, et l'invitation restait PENDING pour toujours.
  const inviteToken = searchParams.get("inviteToken");
  const [invite, setInvite] = useState<{ cabinetName: string | null; postLabel: string; invitedEmail: string } | null>(null);
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : null;

  // Pré-sélection du profil depuis une page d'entrée (section 190). /remplacement-kine-guadeloupe
  // s'adresse aux remplaçants : qui en vient a déjà répondu à la question, on ne la repose pas.
  //
  // On SAUTE l'écran 1 sans le supprimer — la flèche « ← » de l'écran 2 y ramène, et l'écran 2
  // annonce le choix fait à sa place avec de quoi le défaire. Personne ne doit se retrouver
  // enfermé dans un profil parce qu'il a cliqué depuis la mauvaise page.
  //
  // Valeur inconnue ou absente : ignorée en silence, parcours normal. Le paramètre vient de
  // l'URL, donc de n'importe qui : il choisit un écran de départ, jamais un droit.
  // Provenance (section 86) : d'où vient la personne qui s'inscrit. Sans ça, on peut compter
  // les visites d'une page d'entrée mais jamais savoir si elles aboutissent — or c'est la
  // conversion qui décide si une campagne vaut d'être relancée. Borné et assaini : c'est un
  // paramètre d'URL, donc de n'importe qui.
  const src = (searchParams.get("src") ?? "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || undefined;
  const rawProfileType = searchParams.get("profileType");
  const preselected = (["TITULAIRE", "REMPLACANT", "ASSISTANT"] as const).find((t) => t === rawProfileType) ?? null;

  const [step, setStep] = useState<1 | 2>(preselected ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [profileType, setProfileType] = useState<ProfileTypeChoice | "">(preselected ?? "");
  // Titulaire de type Structure privée (EHPAD / clinique / SSR) — entrée « Établissement ».
  // Détermine titulaireKind = STRUCTURE dès l'inscription (sinon CABINET par défaut).
  // `?structure=1` (porte « emploi » des établissements) : sans lui, l'établissement retombait
  // sur l'écran 1 et devait se retrouver parmi les profils libéraux.
  const [structure, setStructure] = useState(preselected === "TITULAIRE" && searchParams.get("structure") === "1");

  // Step 2
  const [email, setEmail] = useState("");

  // Résolution du token : pré-remplit l'email invité et affiche le contexte (cabinet, poste).
  // Un token invalide ou expiré n'empêche PAS de s'inscrire — on n'enferme personne dehors,
  // le rattachement échouera simplement en silence côté serveur.
  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/poste-invitations/${encodeURIComponent(inviteToken)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.valid) return;
        setInvite({ cabinetName: d.cabinetName, postLabel: d.postLabel, invitedEmail: d.invitedEmail });
        setEmail((prev) => prev || d.invitedEmail);
      })
      .catch(() => {});
  }, [inviteToken]);
  // Item 21 — vérification email en temps réel
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  async function checkEmail() {
    const e = email.toLowerCase().trim();
    if (!e || !e.includes("@")) { setEmailAvailable(null); return; }
    try {
      const r = await fetch(`/api/auth/check-email?email=${encodeURIComponent(e)}`);
      const d = await r.json();
      setEmailAvailable(d.available);
    } catch { setEmailAvailable(null); }
  }
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // ── PROFESSION : PLUS DE DÉFAUT SILENCIEUX (section 283) ──────────────────────────────────
  //
  // La 278 avait posé le champ, mais présélectionné sur « Kinésithérapeute ». Avec une valeur
  // déjà choisie, `required` ne force rien : un infirmier qui ne touche pas à la liste devient
  // kiné sans le savoir, et le cloisonnement ne lui montre ensuite que des annonces de kinés.
  // Le défaut que la 278 corrigeait survivait donc, en plus petit.
  //
  // Valeur initiale vide → l'option « Choisissez votre profession » est sélectionnée, et
  // `required` redevient effectif. Le coût est un clic de plus pour les kinés — exactement ce
  // que le formulaire demande déjà pour tout le reste.
  //
  // UNE SEULE EXCEPTION : le visiteur venu d'une page de diffusion PROPRE à une profession
  // (`?profession=…`, posé par PagePorte). Il a déjà dit ce qu'il exerce en cliquant ; le lui
  // redemander serait une friction gratuite. La valeur est validée contre l'enum avant d'être
  // retenue — un paramètre d'URL documente une provenance, il n'autorise rien.
  const professionInitiale = (() => {
    const p = searchParams.get("profession");
    return p && p in PROFESSION_LABELS ? p : "";
  })();
  const [profession, setProfession] = useState<string>(professionInitiale);
  // Île du compte (section 376) : Guadeloupe par défaut, ou celle d'une page d'entrée
  // (`?territoire=MARTINIQUE`).
  const [territoire, setTerritoire] = useState<Territoire>(territoireDe(searchParams.get("territoire")));
  const salarieSeul = contratFourniParEmployeur(profession);
  // Notifications (section 50-51)
  const [phoneCountry, setPhoneCountry] = useState("GP");
  const [phone, setPhone] = useState("");
  // Consentement WhatsApp (23/10, arbitrage JC) : proposé ici aussi, NON coché par défaut, et
  // seulement quand un numéro est saisi — sans numéro, la case n'aurait rien à autoriser.
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(true);
  // Acceptation obligatoire des documents légaux (section 150) — bloque la création de compte.
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Step 2 — optional photo (uploaded after account creation)
  const [pendingPhotoBlob, setPendingPhotoBlob] = useState<Blob | null>(null);

  // Step 3
  const [starter, setStarter] = useState<string>("");
  const [bioText, setBioText] = useState("");

  // Limite BioTinder différenciée (section 123) : cabinet 700, remplaçant 280.
  const bioLimit = bioLimitFor(profileType || undefined);
  const maxBioText = starter ? bioLimit - starter.length - 1 : bioLimit;
  const bioFull = starter && bioText.trim() ? `${starter} ${bioText.trim()}` : bioText.trim();

  const formulairePret =
    Boolean(email && password && name && profession && pendingPhotoBlob && acceptedTerms) && emailAvailable !== false;

  async function handleFinalSubmit() {
    // Photo principale obligatoire pour finaliser le profil (régression corrigée)
    if (!pendingPhotoBlob) {
      setError("Une photo de profil est obligatoire pour finaliser votre inscription.");
      return;
    }
    setLoading(true);
    setError("");

    let res: Response;
    try {
      res = await createProfileWithRetry({
        email: email.toLowerCase().trim(),
        password,
        type: profileType,
        profession,
        territoire,
        titulaireKind: profileType === "TITULAIRE" && structure ? "STRUCTURE" : undefined,
        name: name.trim() || undefined,
        bioTinder: bioFull || undefined,
        phone: toE164(phoneCountry, phone) || undefined,
        phoneCountry,
        emailOptIn,
        whatsappOptIn: whatsappOptIn && !!toE164(phoneCountry, phone),
        acceptedTerms, // consentement légal enregistré (section 150)
        inviteToken: inviteToken ?? undefined, // rattachement automatique au poste invité
        src, // provenance, pour mesurer la conversion des pages d'entrée
      });
    } catch {
      setError("Problème de connexion. Vérifiez votre réseau et réessayez.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error?.fieldErrors?.email?.[0] ?? data.error ?? "Erreur lors de la création");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email: email.toLowerCase().trim(), password, redirect: false });

    // Upload de la photo choisie à l'inscription — via la route serveur
    // (clé service_role, bypass RLS) comme PhotoUpload. L'upload anon direct
    // échouait en 403 (policies RLS ciblent le rôle authenticated).
    // Le compte est déjà créé : un échec photo ne doit pas bloquer, mais on
    // en informe l'utilisateur pour qu'il l'ajoute depuis /compte.
    let photoUploaded = true;
    if (pendingPhotoBlob) {
      try {
        const session = await getSession();
        const profileId = (session?.user as { profileId?: string })?.profileId;
        if (!profileId) {
          photoUploaded = false;
        } else {
          const fd = new FormData();
          fd.append("file", pendingPhotoBlob, `${profileId}.jpg`);
          const photoRes = await fetch(`/api/profiles/${profileId}/photo`, { method: "POST", body: fd });
          photoUploaded = photoRes.ok;
        }
      } catch (e) {
        console.error("[register] photo upload failed", e);
        photoUploaded = false;
      }
    }

    // Échec d'upload → on redirige vers /compte avec un avis (compte bien créé).
    // Sinon, retour à l'annonce d'origine si présente (section 3), sinon /annonces.
    // RECHARGEMENT COMPLET, PAS `router.push` (20/08) — troisième et dernier point d'entrée du
    // motif fermé le 19/08 dans SignOutButton.tsx et login/page.tsx. Une navigation côté client
    // ne re-rend pas le layout : le segment `page` est refetché, le segment `layout` vient du
    // cache du routeur. La barre de tête garderait donc l'identité de la session précédente.
    //
    // Le symptôme est moins probable ici — le layout n'a en principe rien en cache pour un compte
    // qui vient de naître — mais quelqu'un qui s'inscrit depuis une session déjà ouverte tombe
    // exactement dessus. Laissé ouvert le 19/08 faute d'avoir été vérifié avec les deux autres,
    // pas parce qu'il était sain.
    // ── OÙ ATTERRIT UN COMPTE QUI VIENT DE NAÎTRE (section 225, 03/09) ──────────────────────
    //
    // On arrivait sur `/annonces`, le fil de swipe. Or le feed interroge les PUBLICATIONS de
    // l'autre camp, jamais les profils : quelqu'un qui n'a rien publié consomme le fil sans
    // exister dedans. Mesuré le 03/09 — 14 candidats sur 19 n'ont JAMAIS publié de recherche,
    // aucun n'a jamais obtenu de mise en relation, et aucun n'a publié puis désactivé. Ils ne
    // sont pas partis : ils ne sont jamais entrés. Le canal Google Ads est à 0 sur 7.
    //
    // On les amène donc au geste qui les fait exister, plutôt qu'à celui qui les occupe. Ce
    // n'est PAS un passage obligé : l'écran de publication a son propre « Annuler », qui
    // renvoie vers l'espace du compte.
    //
    // `returnTo` GARDE LA PRIORITÉ (section 3) : quelqu'un venu depuis une annonce précise
    // voulait cette annonce-là, et l'inscription n'était qu'un péage. Le rediriger vers un
    // formulaire lui ferait perdre ce pour quoi il est venu.
    //
    // CÔTÉ CABINET, RIEN NE CHANGE — délibérément. Le même raisonnement s'y applique et 4
    // titulaires sur 8 n'ont jamais publié non plus, mais ils convertissent à 50 % contre 25 %
    // pour les candidats : deux situations d'ampleur différente, et le périmètre demandé porte
    // sur le parcours candidat. À trancher séparément.
    // Un établissement arrive sur la publication d'offre (lib/inscription, 22/10).
    const apresInscription = destinationApresInscription(profileType, structure);
    window.location.assign(
      photoUploaded ? (returnTo ?? apresInscription) : "/compte?photoError=1",
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-kine-900 via-kine-700 to-kine-500">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center pt-10 pb-6 px-4 text-center">
        <Link href="/login" className="mb-2">
          <Image src="/GeminiLogo.png" alt="Soignect" width={132} height={132} priority className="rounded-2xl shadow-xl" />
        </Link>
        <p className="text-kine-100 text-xs font-medium tracking-wide">
          {step === 1 ? "Bienvenue !" : titreIdentite(profileType, structure)}
        </p>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white rounded-t-3xl flex-1 px-6 pt-7 pb-10 shadow-2xl max-w-md mx-auto w-full">

          {/* ── ÉCRAN 1 : Qui êtes-vous ? ── */}
          {step === 1 && (
            <>
              {/* Contexte de l'invitation — sans lui, l'invité·e arrive sur une inscription
                  ordinaire et ne comprend pas pourquoi son email est déjà rempli. */}
              {invite && (
                <div className="mb-5 rounded-xl bg-kine-50 border border-kine-100 px-4 py-3">
                  <p className="text-sm text-kine-800">
                    <strong>{invite.cabinetName ?? "Un cabinet"}</strong> vous invite à rejoindre
                    le poste «&nbsp;{invite.postLabel}&nbsp;».
                  </p>
                  <p className="text-xs text-kine-600/80 mt-1">
                    Vous y serez rattaché·e automatiquement à la fin de votre inscription.
                  </p>
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-800 mb-2">Je suis…</h2>
              <p className="text-gray-400 text-sm mb-6">Choisissez votre profil pour commencer</p>

              <div className="space-y-3">
                {/* Profession salariée seulement (section 304), connue par l'URL : ni cabinet, ni
                    remplacement, ni assistanat. On ne propose que ce qui existe pour elle. */}
                {!salarieSeul && (
                <button
                  onClick={() => { setProfileType("TITULAIRE"); setStructure(false); setStep(2); }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 text-left transition group"
                >
                  <span className="text-3xl">🏥</span>
                  <div>
                    <p className="font-bold text-gray-800 text-base">Cabinet / Titulaire</p>
                    <p className="text-sm text-gray-400">Je publie des postes de remplacement</p>
                  </div>
                  <span className="ml-auto text-gray-300 group-hover:text-emerald-500 text-xl">→</span>
                </button>
                )}

                <button
                  onClick={() => { setProfileType("TITULAIRE"); setStructure(true); setStep(2); }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-200 hover:border-[#0B3D5C] hover:bg-slate-50 text-left transition group"
                >
                  <span className="text-3xl">🏨</span>
                  <div>
                    <p className="font-bold text-gray-800 text-base">Établissement</p>
                    <p className="text-sm text-gray-400">EHPAD, SSIAD, clinique, SSR — vacations, CDD, CDI</p>
                  </div>
                  <span className="ml-auto text-gray-300 group-hover:text-[#0B3D5C] text-xl">→</span>
                </button>

                {/* CPTS, MSP, COLLECTIVITÉ (section 379) : pas de profil soignant ni de swipes — un
                    espace structure, ouvert à la validation par l'équipe Soignect. L'île cochée
                    plus bas voyage jusqu'au formulaire. */}
                <a
                  href={`/partenaire?compte=1&territoire=${territoire}${src ? `&src=${encodeURIComponent(src)}` : ""}`}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 text-left transition group"
                >
                  <span className="text-3xl">🏛️</span>
                  <div>
                    <p className="font-bold text-gray-800 text-base">CPTS, MSP, collectivité</p>
                    <p className="text-sm text-gray-400">Besoins de votre territoire, votre page, le suivi de l&apos;offre de soins</p>
                  </div>
                  <span className="ml-auto text-gray-300 group-hover:text-amber-500 text-xl">→</span>
                </a>

                {/* UN SEUL CHERCHEUR DE POSTE (29/10, décision de JC — section 378). Les cartes
                    « Remplaçant·e » et « Assistant·e / Collaborateur·rice » séparaient deux
                    comptes dont le fil est le même : chacun voit toutes les offres. Ce qu'il
                    cherche — remplacement, assistanat, collaboration, poste salarié — se dit dans
                    sa disponibilité, qui le permettait déjà (section 191). Le compte est
                    enregistré REMPLACANT ; les comptes ASSISTANT existants restent tels quels, et
                    un lien ?profileType=ASSISTANT est toujours accepté. */}
                <button
                  onClick={() => { setProfileType("REMPLACANT"); setStructure(false); setStep(2); }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-200 hover:border-kine-400 hover:bg-kine-50 text-left transition group"
                >
                  <span className="text-3xl">🩺</span>
                  <div>
                    <p className="font-bold text-gray-800 text-base">Je cherche un poste</p>
                    <p className="text-sm text-gray-400">
                      {salarieSeul
                        ? "CDI, CDD, vacations — toutes les offres de votre territoire"
                        : "Remplacement, assistanat, collaboration ou poste salarié — toutes les offres de votre territoire"}
                    </p>
                  </div>
                  <span className="ml-auto text-gray-300 group-hover:text-kine-500 text-xl">→</span>
                </button>
              </div>

              <DejaUnCompte returnTo={returnTo} className="mt-8" />
            </>
          )}

          {/* ── ÉCRAN 2 : Identité ── */}
          {step === 2 && (
            <>
              <h2 className="text-lg font-bold text-gray-800 mb-5">
                {titreIdentite(profileType, structure)}
              </h2>

              {/* L'écran 1 ayant été sauté, rien ne dirait sous quel profil on s'inscrit. On
                  l'annonce, et on laisse le défaire. Le libellé suit `profileType` et non le
                  paramètre d'URL : après un changement, il dit la vérité. */}
              {preselected && profileType && (
                <p className="-mt-3 mb-5 text-sm text-gray-400">
                  {/* Le type de compte ET, côté recruteur, la profession recherchée (lib/inscription). */}
                  Inscription {enTantQue(libelleInscription(profileType, structure, profession))}
                  <span className="font-semibold text-gray-600">{libelleInscription(profileType, structure, profession)}</span>.{" "}
                  <button type="button" onClick={() => setStep(1)} className="text-kine-600 font-semibold hover:underline">
                    Changer
                  </button>
                </p>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); if (formulairePret) void handleFinalSubmit(); }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailAvailable(null); }}
                      onBlur={checkEmail}
                      className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 text-sm ${
                        emailAvailable === false ? "border-red-300 focus:ring-red-400" : "border-gray-200 focus:ring-kine-400"
                      }`}
                      placeholder="vous@exemple.fr"
                      autoCapitalize="none"
                      required
                    />
                    {emailAvailable === false && (
                      <p className="text-xs text-red-600 mt-1">
                        Cet email est déjà utilisé.{" "}
                        <Link href="/login" className="font-semibold underline hover:text-red-700">Connectez-vous ?</Link>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {profileType === "TITULAIRE" ? (structure ? "Nom de l'établissement" : "Nom du cabinet") : "Votre nom"}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                    placeholder={profileType === "TITULAIRE" ? (structure ? "Clinique des Alizés" : "Cabinet Dupont") : "Marie Dupont"}
                    required
                  />
                </div>

                {/* ── PROFESSION (section 278) ────────────────────────────────────────────
                    Le seul blocage dur de l'ouverture : la colonne existait, l'enum aussi, les
                    gabarits de contrat infirmier aussi — mais aucun écran ne posait la question,
                    si bien que tout nouveau compte devenait kiné en silence.

                    GROUPÉ PAR FAMILLE, parce que quatorze entrées à plat se lisent mal et que
                    les dix marchés médicaux relèvent du même ordre : le groupe dit ce que l'enum
                    ne peut pas dire. Un cabinet le déclare aussi — c'est la profession qu'il
                    RECHERCHE, et c'est elle qui cloisonne le fil des deux côtés. */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {profileType === "TITULAIRE" ? "Profession recherchée" : "Votre profession"}
                  </label>
                  <select
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm bg-white"
                    required
                  >
                    {/* L'option vide est ce qui rend `required` opérant. Sans elle, le champ
                        répond toujours — avec la première valeur de la liste. */}
                    <option value="">Choisissez votre profession…</option>
                    {GROUPES_PROFESSION.map((g) => (
                      <optgroup key={g.titre} label={g.titre}>
                        {g.valeurs.map((v) => (
                          <option key={v} value={v}>{PROFESSION_LABELS[v]}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                    Elle détermine qui vous voyez et qui vous voit : chaque profession a son
                    propre fil.
                  </p>
                </div>

                {/* Île du compte (section 376) : chacun voit d'abord les annonces de son île. */}
                <div>
                  <span className="block text-xs font-medium text-gray-600 mb-1">Votre île</span>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Votre île">
                    {TERRITOIRES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={territoire === t}
                        onClick={() => setTerritoire(t)}
                        className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                          territoire === t
                            ? "bg-kine-600 text-white border-kine-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-kine-300"
                        }`}
                      >
                        {LIBELLE_TERRITOIRE[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* « Commune principale » et « N° RPPS » se trouvaient ici. Tous deux SAISIS PUIS
                    JETÉS : jamais transmis à /api/profiles, absents du schéma serveur, et
                    Profile n'a même pas de colonne `commune`. Ils coûtaient de la friction sur
                    l'écran le plus coûteux du produit pour zéro valeur.

                    Le RPPS était le plus nuisible : c'est exactement le champ qu'exige
                    enforceContractProfile. L'utilisateur le donnait ici, on le perdait, et des
                    semaines plus tard on lui refusait son contrat pour RPPS manquant. Il est
                    désormais demandé au moment du contrat, là où il sert — le garde et la
                    bannière de « Mon compte » existent déjà.

                    La géographie, elle, appartient à la disponibilité (macro-zones), pas au
                    compte. */}

                {/* ── UN SEUL ÉCRAN (section 370) ───────────────────────────────────────────
                    Identité et accroche étaient deux écrans ; l'accroche, facultative côté serveur
                    depuis toujours, se présentait pourtant comme une étape. Elle rejoint le
                    téléphone dans un volet replié : rien de ce qu'il contient n'est exigé. */}
                <details className="rounded-xl border border-gray-200">
                  <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-semibold text-gray-700">
                    Téléphone et accroche{" "}
                    <span className="font-normal text-gray-400">(facultatif, modifiable plus tard)</span>
                  </summary>
                  <div className="space-y-4 px-3 pb-3 pt-1">
                    {/* Téléphone (section 50-51) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Téléphone
                        <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={phoneCountry}
                          onChange={(e) => setPhoneCountry(e.target.value)}
                          className="px-2 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm shrink-0"
                          aria-label="Indicatif pays"
                        >
                          {PHONE_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>{c.dial} {c.code}</option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                          placeholder="690 12 34 56"
                        />
                      </div>
                      {phone.trim() && (
                        <label className="mt-2 flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={whatsappOptIn}
                            onChange={(e) => setWhatsappOptIn(e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded accent-kine-600 shrink-0"
                          />
                          <span className="text-sm text-gray-600">
                            {CONSENTEMENT_WHATSAPP.libelle}
                            <span className="block text-[11px] leading-snug text-gray-400 mt-0.5">{CONSENTEMENT_WHATSAPP.detail}</span>
                          </span>
                        </label>
                      )}
                    </div>

                    <div>
                      <p className="block text-xs font-medium text-gray-600 mb-1">Votre accroche</p>
                      <p className="text-gray-400 text-xs mb-3">
                        {bioLimit} caractères : le début s&apos;affiche sur votre carte.
                      </p>
                      {/* Boutons starter */}
                      <div className="flex gap-2 flex-wrap mb-3">
                        {(profileType === "TITULAIRE"
                            ? (structure ? BIO_STARTERS_STRUCTURE : BIO_STARTERS_TITULAIRE)
                            : BIO_STARTERS_CANDIDATE
                          ).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStarter(starter === s ? "" : s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                              starter === s
                                ? "bg-kine-600 text-white border-kine-600"
                                : "bg-white text-kine-700 border-kine-300 hover:border-kine-500"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>

                      <div className="relative mb-1">
                        {starter && (
                          <span className="absolute left-3 top-3 text-xs text-kine-500 font-medium pointer-events-none select-none">
                            {starter}&nbsp;
                          </span>
                        )}
                        <textarea
                          value={bioText}
                          onChange={(e) => { if (e.target.value.length <= maxBioText) setBioText(e.target.value); }}
                          rows={4}
                          className={`w-full px-3 border border-kine-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 resize-none text-sm ${starter ? "pt-7 pb-2" : "py-3"}`}
                          placeholder={
                            starter
                              ? "…complétez en quelques mots"
                              : profileType === "TITULAIRE"
                              // Un établissement n'est pas un cabinet kiné : l'exemple ne lui prête ni
                              // patientèle ni plateau technique (section 304).
                              ? structure
                                ? "Établissement à Pointe-à-Pitre, équipe stable, plannings connus à l'avance, intégration accompagnée…"
                                : "Cabinet dynamique à Pointe-à-Pitre, patientèle sport et gériatrique, plateau technique complet, logement possible…"
                              // Suit la profession choisie plus haut (section 278) : elle était
                              // en dur sur « Kiné passionné de sport », servie telle quelle à l'infirmière
                              // qui venait de se déclarer infirmière.
                              : pourIle(accrocheProfilExemple(profession as Profession), territoire)
                          }
                        />
                      </div>
                      <p className="text-right text-xs text-gray-300 mb-4">
                        {(starter ? starter.length + 1 : 0) + bioText.length}/{bioLimit}
                      </p>
                    </div>
                  </div>
                </details>

                {/* Photo de profil OBLIGATOIRE (régression corrigée) */}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-3">
                    Photo de profil
                    <span className="text-red-400 font-normal ml-1">(obligatoire)</span>
                  </p>
                  <PhotoUpload
                    name={name || (profileType === "TITULAIRE" ? (structure ? "Établissement" : "Cabinet") : "Candidat")}
                    profileType={profileType || undefined}
                    structure={structure}
                    onBlobReady={setPendingPhotoBlob}
                  />
                  {!pendingPhotoBlob && (
                    <p className="text-xs text-amber-600 mt-2">Ajoutez une photo pour continuer.</p>
                  )}
                </div>

                {/* Opt-in notifications email (coché par défaut) */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={emailOptIn}
                    onChange={(e) => setEmailOptIn(e.target.checked)}
                    className="w-4 h-4 rounded accent-kine-600"
                  />
                  <span className="text-sm text-gray-600">Recevoir les notifications par email</span>
                </label>

                {error && (
                  <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">{error}</p>
                )}

                {/* Acceptation obligatoire des documents légaux (section 150) */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-kine-600 shrink-0"
                  />
                  <span className="text-xs text-gray-500 leading-snug">
                    J&apos;ai lu et j&apos;accepte les{" "}
                    <a href="/cgu" target="_blank" rel="noopener noreferrer" className="text-kine-600 underline">CGU/CGV</a>, la{" "}
                    <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-kine-600 underline">politique de confidentialité</a>{" "}
                    et les{" "}
                    <a href="/mentions-legales" target="_blank" rel="noopener noreferrer" className="text-kine-600 underline">mentions légales</a>.
                  </span>
                </label>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-3 border border-gray-200 rounded-xl text-gray-500 text-sm hover:bg-gray-50 transition"
                  >
                    ←
                  </button>
                  <button
                    type="submit"
                    // Le bouton grisé DIT qu'il manque quelque chose (section 283), là où la
                    // validation native ne parle qu'après le clic.
                    disabled={loading || !formulairePret}
                    className="md3-ripple flex-1 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm"
                  >
                    {loading ? "Création…" : "Rejoindre Soignect 🚀"}
                  </button>
                </div>
              </form>
              {/* Écran 2 : c'est là qu'arrive un établissement venu d'une page « emploi » (l'écran 1
                  est sauté) — le lien de connexion n'existait que sur l'écran 1 (22/10). */}
              <DejaUnCompte returnTo={returnTo} className="mt-6" />
            </>
          )}

        </div>
      </div>
    </div>
  );
}

/** « Déjà un compte ? Se connecter » — écrans 1 et 2. La cible de retour suit : quelqu'un venu
 *  d'une annonce précise y revient après connexion. */
function DejaUnCompte({ returnTo, className = "" }: { returnTo: string | null; className?: string }) {
  return (
    <p className={`text-center text-sm text-gray-400 ${className}`}>
      Déjà un compte ?{" "}
      <Link href={returnTo ? `/login?return_to=${encodeURIComponent(returnTo)}` : "/login"} className="text-kine-600 font-semibold hover:underline">
        Se connecter
      </Link>
    </p>
  );
}
