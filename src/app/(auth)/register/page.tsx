"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import Image from "next/image";
import { COMMUNES_GUADELOUPE } from "@/lib/communes";
import { bioLimitFor } from "@/lib/bio";
import PhotoUpload from "@/components/ui/PhotoUpload";
import { PHONE_COUNTRIES, toE164 } from "@/lib/phone";

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
const BIO_STARTERS_TITULAIRE = ["Je recherche…"] as const;

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i < current ? "bg-kine-600 flex-1" : i === current ? "bg-kine-400 flex-1" : "bg-gray-200 flex-1"
          }`}
        />
      ))}
    </div>
  );
}

export default function RegisterPage() {
  // Suspense requis car RegisterForm lit useSearchParams (section 3)
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const rawReturnTo = useSearchParams().get("return_to");
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : null;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [profileType, setProfileType] = useState<ProfileTypeChoice | "">("");
  // Titulaire de type Structure privée (EHPAD / clinique / SSR) — entrée « Établissement ».
  // Détermine titulaireKind = STRUCTURE dès l'inscription (sinon CABINET par défaut).
  const [structure, setStructure] = useState(false);

  // Step 2
  const [email, setEmail] = useState("");
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
  const [commune, setCommune] = useState("");
  // RPPS collected but not persisted until Sprint 8 (no DB column yet)
  const [rpps, setRpps] = useState("");
  // Notifications (section 50-51)
  const [phoneCountry, setPhoneCountry] = useState("GP");
  const [phone, setPhone] = useState("");
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

  async function handleFinalSubmit() {
    // Photo principale obligatoire pour finaliser le profil (régression corrigée)
    if (!pendingPhotoBlob) {
      setStep(2);
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
        titulaireKind: profileType === "TITULAIRE" && structure ? "STRUCTURE" : undefined,
        name: name.trim() || undefined,
        bioTinder: bioFull || undefined,
        phone: toE164(phoneCountry, phone) || undefined,
        phoneCountry,
        emailOptIn,
        acceptedTerms, // consentement légal enregistré (section 150)
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
    router.push(photoUploaded ? (returnTo ?? "/annonces") : "/compte?photoError=1");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-kine-900 via-kine-700 to-kine-500">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center pt-10 pb-6 px-4 text-center">
        <Link href="/login" className="mb-2">
          <Image src="/GeminiLogo.png" alt="Soignect" width={132} height={132} priority className="rounded-2xl shadow-xl" />
        </Link>
        <p className="text-kine-100 text-xs font-medium tracking-wide">
          {step === 1 ? "Bienvenue !" : step === 2 ? "Votre identité" : "Votre présentation"}
        </p>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white rounded-t-3xl flex-1 px-6 pt-7 pb-10 shadow-2xl max-w-md mx-auto w-full">

          {/* ── ÉCRAN 1 : Qui êtes-vous ? ── */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Je suis…</h2>
              <p className="text-gray-400 text-sm mb-6">Choisissez votre profil pour commencer</p>

              <div className="space-y-3">
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

                <button
                  onClick={() => { setProfileType("TITULAIRE"); setStructure(true); setStep(2); }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-200 hover:border-[#0B3D5C] hover:bg-slate-50 text-left transition group"
                >
                  <span className="text-3xl">🏨</span>
                  <div>
                    <p className="font-bold text-gray-800 text-base">Établissement</p>
                    <p className="text-sm text-gray-400">EHPAD, clinique, SSR — vacations, CDD, CDI</p>
                  </div>
                  <span className="ml-auto text-gray-300 group-hover:text-[#0B3D5C] text-xl">→</span>
                </button>

                <button
                  onClick={() => { setProfileType("REMPLACANT"); setStructure(false); setStep(2); }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-200 hover:border-kine-400 hover:bg-kine-50 text-left transition group"
                >
                  <span className="text-3xl">🩺</span>
                  <div>
                    <p className="font-bold text-gray-800 text-base">Remplaçant·e</p>
                    <p className="text-sm text-gray-400">Je cherche des missions ponctuelles en Guadeloupe</p>
                  </div>
                  <span className="ml-auto text-gray-300 group-hover:text-kine-500 text-xl">→</span>
                </button>

                <button
                  onClick={() => { setProfileType("ASSISTANT"); setStructure(false); setStep(2); }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-200 hover:border-violet-400 hover:bg-violet-50 text-left transition group"
                >
                  <span className="text-3xl">👩‍⚕️</span>
                  <div>
                    <p className="font-bold text-gray-800 text-base">Assistant·e / Collaborateur·rice</p>
                    <p className="text-sm text-gray-400">Je cherche un poste longue durée (assistanat, collaboration)</p>
                  </div>
                  <span className="ml-auto text-gray-300 group-hover:text-violet-500 text-xl">→</span>
                </button>
              </div>

              <p className="text-center text-sm text-gray-400 mt-8">
                Déjà un compte ?{" "}
                <Link href="/login" className="text-kine-600 font-semibold hover:underline">
                  Se connecter
                </Link>
              </p>
            </>
          )}

          {/* ── ÉCRAN 2 : Identité ── */}
          {step === 2 && (
            <>
              <StepIndicator current={1} total={2} />
              <h2 className="text-lg font-bold text-gray-800 mb-5">
                {profileType === "TITULAIRE" ? (structure ? "Votre établissement" : "Votre cabinet") : "Votre identité"}
              </h2>

              <form
                onSubmit={(e) => { e.preventDefault(); if (email && password && name && emailAvailable !== false) setStep(3); }}
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

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Commune principale</label>
                  <select
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                  >
                    <option value="">Sélectionner…</option>
                    {COMMUNES_GUADELOUPE.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    N° RPPS
                    <span className="text-gray-400 font-normal ml-1">(optionnel — requis pour la génération de contrats)</span>
                  </label>
                  <input
                    type="text"
                    value={rpps}
                    onChange={(e) => setRpps(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm"
                    placeholder="10 chiffres"
                    maxLength={11}
                  />
                </div>

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

                {/* Photo de profil OBLIGATOIRE (régression corrigée) */}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-3">
                    Photo de profil
                    <span className="text-red-400 font-normal ml-1">(obligatoire)</span>
                  </p>
                  <PhotoUpload
                    name={name || (profileType === "TITULAIRE" ? "Cabinet" : "Remplaçant")}
                    profileType={profileType || undefined}
                    onBlobReady={setPendingPhotoBlob}
                  />
                  {!pendingPhotoBlob && (
                    <p className="text-xs text-amber-600 mt-2">Ajoutez une photo pour continuer.</p>
                  )}
                </div>

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
                    disabled={!email || !password || !name || emailAvailable === false || !pendingPhotoBlob}
                    className="md3-ripple flex-1 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm"
                  >
                    Continuer →
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── ÉCRAN 3 : BioTinder ── */}
          {step === 3 && (
            <>
              <StepIndicator current={2} total={2} />
              <h2 className="text-lg font-bold text-gray-800 mb-1">Votre accroche</h2>
              <p className="text-gray-400 text-sm mb-4">
                280 caractères pour convaincre — les premiers verront votre profil en premier.
              </p>

              {/* Boutons starter */}
              <div className="flex gap-2 flex-wrap mb-3">
                {(profileType === "TITULAIRE" ? BIO_STARTERS_TITULAIRE : BIO_STARTERS_CANDIDATE).map((s) => (
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
                      ? "Cabinet dynamique à Pointe-à-Pitre, patientèle sport et gériatrique, plateau technique complet, logement possible…"
                      : "Kiné passionné de sport, expérience 5 ans, disponible été et Noël, mobile sur toute la Guadeloupe…"
                  }
                />
              </div>
              <p className="text-right text-xs text-gray-300 mb-4">
                {(starter ? starter.length + 1 : 0) + bioText.length}/{bioLimit}
              </p>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100 mb-3">{error}</p>
              )}

              {/* Acceptation obligatoire des documents légaux (section 150) */}
              <label className="flex items-start gap-2.5 mb-3 cursor-pointer">
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

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-3 border border-gray-200 rounded-xl text-gray-500 text-sm hover:bg-gray-50 transition"
                >
                  ←
                </button>
                <button
                  onClick={handleFinalSubmit}
                  disabled={loading || !acceptedTerms}
                  className="md3-ripple flex-1 py-3 bg-kine-600 text-white rounded-xl font-semibold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40 text-sm"
                >
                  {loading ? "Création…" : "Rejoindre Soignect 🚀"}
                </button>
              </div>

              <p className="text-center text-xs text-gray-400 mt-4">
                Votre accroche peut être modifiée à tout moment depuis votre profil.
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
