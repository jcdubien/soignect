"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Profession, Region, SubscriptionPlan, ProfileType, TitulaireKind } from "@prisma/client";
import CompteTimeline from "./CompteTimeline";
import PhotoUpload from "@/components/ui/PhotoUpload";
import { PHONE_COUNTRIES, toE164, splitE164 } from "@/lib/phone";
import { bioLimitFor } from "@/lib/bio";

const REGION_LABELS: Record<Region, string> = {
  GUADELOUPE: "Guadeloupe", SAINT_MARTIN: "Saint-Martin", SAINT_BARTH: "Saint-Barth",
  MARTINIQUE: "Martinique", GUYANE: "Guyane", REUNION: "La Réunion",
  MAYOTTE: "Mayotte", METROPOLE: "Métropole",
};

const PROFESSION_LABELS: Record<Profession, string> = {
  KINESITHERAPEUTE: "Kinésithérapeute", INFIRMIER: "Infirmier·ère",
  ORTHOPHONISTE: "Orthophoniste", SAGE_FEMME: "Sage-femme", MEDECIN: "Médecin",
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  FREE: "Gratuit", PREMIUM: "Premium — 9€/mois", BOOST: "Boost — 29€/mois",
  STRUCTURE: "Structure — 89€/mois + 20€/contrat",
};

interface ProfileData {
  id: string;
  name: string | null;
  bio: string | null;
  bioTinder: string | null;
  region: Region;
  profession: Profession;
  isVerified: boolean;
  subscriptionPlan: SubscriptionPlan;
  isFounding: boolean;
  type: ProfileType;
  photoUrl: string | null;
  secondaryPhotoUrl1: string | null;
  secondaryPhotoUrl2: string | null;
  isEmployeur: boolean;
  titulaireKind: TitulaireKind;
  // Identité contractuelle (section 150) — injectée dans le PDF de contrat
  rpps: string | null;
  numeroOrdre: string | null;
  adresse: string | null;
  siret: string | null;
  user?: { phone: string | null; phoneCountry: string | null; emailOptIn: boolean; notifyConsultation?: boolean } | null;
}

interface MatchedMission {
  matchId: string;
  missionTitle: string;
  cabinetName: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  location: string | null;
}

export default function CompteForm({ profile, matchedMissions = [] }: { profile: ProfileData; matchedMissions?: MatchedMission[] }) {
  const router = useRouter();

  const [name, setName]           = useState(profile.name ?? "");
  const [bioTinder, setBioTinder] = useState(profile.bioTinder ?? "");
  const [region, setRegion]       = useState<Region>(profile.region);
  const [profession, setProfession] = useState<Profession>(profile.profession);
  const [rpps, setRpps]           = useState(profile.rpps ?? "");
  const [numeroOrdre, setNumeroOrdre] = useState(profile.numeroOrdre ?? "");
  const [adresse, setAdresse]     = useState(profile.adresse ?? "");
  const [siret, setSiret]         = useState(profile.siret ?? "");
  const [kind, setKind] = useState<TitulaireKind>(profile.titulaireKind);
  const isStructure = profile.type === "TITULAIRE" && kind === "STRUCTURE";

  // Notifications (section 50-51)
  const initPhone = splitE164(profile.user?.phone, profile.user?.phoneCountry);
  const [phoneCountry, setPhoneCountry] = useState(initPhone.country);
  const [phone, setPhone]               = useState(initPhone.local);
  const [emailOptIn, setEmailOptIn]     = useState(profile.user?.emailOptIn ?? true);
  const [notifyConsultation, setNotifyConsultation] = useState(profile.user?.notifyConsultation ?? true);

  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [saveError, setSaveError]   = useState("");

  const [verifying, setVerifying]   = useState(false);
  const [verified, setVerified]     = useState(profile.isVerified);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const [deleting, setDeleting]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    const res = await fetch(`/api/profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        bioTinder: bioTinder.trim() || undefined,
        region, profession, titulaireKind: kind,
        // Identité contractuelle (section 150) — persistée pour injection PDF
        rpps: rpps.trim() || null,
        numeroOrdre: numeroOrdre.trim() || null,
        adresse: adresse.trim() || null,
        siret: siret.trim() || null,
        phone: toE164(phoneCountry, phone) || null,
        phoneCountry,
        emailOptIn,
        notifyConsultation,
      }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else { setSaveError("Erreur lors de la sauvegarde"); }
    setSaving(false);
  }

  async function handleVerifyRpps() {
    if (!rpps.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    const res = await fetch(`/api/rpps/verify?rpps=${rpps.trim()}`);
    const data = await res.json();
    if (data.verified) {
      setVerified(true);
      setVerifyResult(`✓ Vérifié — ${data.nom ?? ""} ${data.profession ? `(${data.profession})` : ""}`.trim());
    } else {
      // Pas de faux badge de confiance (section 185) : tout échec retire le badge, pour ne
      // jamais afficher « VÉRIFIÉ » alors que la vérification réelle n'a pas abouti.
      setVerified(false);
      if (res.status === 400) {
        // Erreur de saisie (format RPPS invalide)
        setVerifyResult(`✗ ${data.error ?? "Numéro RPPS invalide"}`);
      } else if (res.ok) {
        // Réponse ANS définitive : praticien introuvable / inactif
        setVerifyResult(`✗ ${data.error ?? "RPPS introuvable dans l'annuaire ANS"}`);
      } else {
        // Échec d'infrastructure (clé absente / API ANS indisponible) — on n'expose pas le
        // détail interne à l'utilisateur.
        setVerifyResult("✗ Vérification ANS indisponible pour le moment — réessayez plus tard.");
      }
    }
    setVerifying(false);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch(`/api/profiles/${profile.id}`, { method: "DELETE" });
    if (res.ok) {
      await signOut({ redirect: false });
      router.push("/register");
    } else {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* ── Ma photo ── */}
      <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Ma photo</h2>
        <PhotoUpload
          profileId={profile.id}
          initialPhotoUrl={profile.photoUrl}
          name={profile.name}
          profileType={profile.type}
        />

        {/* Photos secondaires optionnelles (section 3) — jusqu'à 2 */}
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-6 mb-3">
          Photos secondaires <span className="text-gray-400 font-normal normal-case">(optionnelles)</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <PhotoUpload
            profileId={profile.id}
            initialPhotoUrl={profile.secondaryPhotoUrl1}
            name={profile.name}
            profileType={profile.type}
            slot="secondary1"
          />
          <PhotoUpload
            profileId={profile.id}
            initialPhotoUrl={profile.secondaryPhotoUrl2}
            name={profile.name}
            profileType={profile.type}
            slot="secondary2"
          />
        </div>
      </section>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {profile.type === "TITULAIRE" ? "Cabinet / Titulaire" : profile.type === "ASSISTANT" ? "Assistant·e" : "Remplaçant·e"}
          {verified && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
              ✓ Vérifié RPPS
            </span>
          )}
        </p>
      </div>

      {/* ── Informations personnelles ── */}
      <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Informations personnelles</h2>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {profile.type === "TITULAIRE" ? "Nom du cabinet" : "Votre nom"}
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
            placeholder={profile.type === "TITULAIRE" ? "Cabinet Dupont" : "Marie Dupont"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Zone géographique</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value as Region)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
            >
              {(Object.keys(REGION_LABELS) as Region[]).map(r => (
                <option key={r} value={r}>{REGION_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Profession</label>
            <select
              value={profession}
              onChange={e => setProfession(e.target.value as Profession)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
            >
              {(Object.keys(PROFESSION_LABELS) as Profession[]).map(p => (
                <option key={p} value={p}>{PROFESSION_LABELS[p]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Identité contractuelle (section 150) — figure dans le PDF de contrat ── */}
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Champs <strong>obligatoires pour générer un contrat</strong> (ils y figurent). Complétez-les dès maintenant.
        </p>

        {!isStructure && (
          <>
            {/* RPPS */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                N° RPPS <span className="text-red-500">*</span>
                {verified && (
                  <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[10px] font-bold">VÉRIFIÉ</span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rpps}
                  onChange={e => setRpps(e.target.value.replace(/\D/g, ""))}
                  maxLength={11}
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
                  placeholder="10 chiffres"
                />
                <button
                  onClick={handleVerifyRpps}
                  disabled={verifying || !rpps.trim()}
                  className="px-4 py-2.5 bg-kine-600 text-white rounded-xl text-sm font-semibold hover:bg-kine-700 transition disabled:opacity-40"
                >
                  {verifying ? "…" : "Vérifier"}
                </button>
              </div>
              {verifyResult && (
                <p className={`text-xs mt-1.5 font-medium ${verifyResult.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>
                  {verifyResult}
                </p>
              )}
              <p className="text-[10px] text-gray-400 mt-1">
                Vérifiable via l&apos;annuaire ANS ; conservé pour figurer sur vos contrats.
              </p>
            </div>

            {/* N° Ordre */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                N° d&apos;inscription à l&apos;Ordre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={numeroOrdre}
                onChange={e => setNumeroOrdre(e.target.value)}
                maxLength={30}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
                placeholder="Ex : 971 0000 0000"
              />
            </div>
          </>
        )}

        {/* SIRET (structure employeuse) */}
        {isStructure && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              N° SIRET <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={siret}
              onChange={e => setSiret(e.target.value.replace(/\D/g, ""))}
              maxLength={14}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
              placeholder="14 chiffres"
            />
          </div>
        )}

        {/* Adresse professionnelle (tous) */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Adresse professionnelle <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
            placeholder="N°, rue, code postal, commune"
          />
        </div>
      </section>

      {/* ── Nature du titulaire (TITULAIRE uniquement) — Cabinet vs Structure ── */}
      {profile.type === "TITULAIRE" && (
        <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Type de compte</h2>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "CABINET" as TitulaireKind, title: "Cabinet libéral", sub: "Remplacement / Assistanat / Collaboration" },
              { value: "STRUCTURE" as TitulaireKind, title: "Structure privée", sub: "EHPAD, clinique, SSR · Vacation / CDD / CDI" },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKind(opt.value)}
                className={`text-left px-3.5 py-3 rounded-xl border-2 transition ${
                  kind === opt.value
                    ? "border-[#1B3A5C] bg-[#1B3A5C]/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-bold text-gray-800">{opt.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{opt.sub}</p>
              </button>
            ))}
          </div>
          {kind === "STRUCTURE" && (
            <p className="text-[11px] text-gray-400 mt-2">
              Les structures privées relèvent d&apos;une offre dédiée (89€/mois + 20€/contrat) — voir la page Premium.
            </p>
          )}
        </section>
      )}

      {/* ── Votre accroche (BioTinder en interne) ── */}
      <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Votre accroche</h2>
        <p className="text-xs text-gray-400">Votre phrase visible sur les cartes (280 caractères max)</p>
        <div className="relative">
          <textarea
            value={bioTinder}
            onChange={e => { if (e.target.value.length <= bioLimitFor(profile.type)) setBioTinder(e.target.value); }}
            rows={4}
            className="w-full px-3 py-2.5 border border-kine-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400 resize-none break-words whitespace-pre-wrap"
            placeholder={
              profile.type === "TITULAIRE"
                ? "Cabinet dynamique, patientèle sport et gériatrique, plateau technique complet…"
                : "Kiné passionné, disponible été et Noël, mobile sur toute la Guadeloupe…"
            }
          />
        </div>
        <p className="text-right text-xs text-gray-300">{bioTinder.length}/{bioLimitFor(profile.type)}</p>
      </section>

      {/* ── Timeline remplaçant ── */}
      {(profile.type === "REMPLACANT" || profile.type === "ASSISTANT") && (
        <CompteTimeline matches={matchedMissions} />
      )}

      {/* ── Mes notifications (section 50-51) ── */}
      <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Mes notifications</h2>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Téléphone</label>
          <div className="flex gap-2">
            <select
              value={phoneCountry}
              onChange={e => setPhoneCountry(e.target.value)}
              className="px-2 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400 shrink-0"
              aria-label="Indicatif pays"
            >
              {PHONE_COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.dial} {c.code}</option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kine-400"
              placeholder="690 12 34 56"
            />
          </div>
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-700">Notifications par email</span>
          <button
            type="button"
            role="switch"
            aria-checked={emailOptIn}
            onClick={() => setEmailOptIn(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${emailOptIn ? "bg-[#1B3A5C]" : "bg-[#E0E0E0]"}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${emailOptIn ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-700">
            M&apos;avertir quand mon annonce est consultée
            <span className="block text-xs text-gray-400">Fréquent — coupez si trop d&apos;emails</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={notifyConsultation}
            onClick={() => setNotifyConsultation(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${notifyConsultation ? "bg-[#1B3A5C]" : "bg-[#E0E0E0]"}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${notifyConsultation ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </label>
      </section>

      {/* ── Abonnement ── */}
      <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Abonnement</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">{PLAN_LABELS[profile.subscriptionPlan]}</p>
            {profile.isFounding && (
              <p className="text-xs text-yellow-600 font-medium">⭐ Cabinet fondateur</p>
            )}
            {profile.type === "REMPLACANT" && (
              <p className="text-xs text-emerald-600 font-medium">Accès gratuit à vie pour les remplaçants</p>
            )}
          </div>
          {profile.type === "TITULAIRE" && profile.subscriptionPlan === "FREE" && (
            <Link
              href="/premium"
              className="px-4 py-2 bg-kine-600 text-white text-xs font-bold rounded-xl hover:bg-kine-700 transition"
            >
              Passer Premium →
            </Link>
          )}
        </div>
      </section>

      {/* ── Bouton sauvegarder ── */}
      {saveError && (
        <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">{saveError}</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 bg-kine-600 text-white rounded-2xl font-bold hover:bg-kine-700 active:scale-[0.98] transition disabled:opacity-40"
      >
        {saving ? "Sauvegarde…" : saved ? "✓ Sauvegardé !" : "Sauvegarder"}
      </button>

      {/* ── Signaler un problème (Sprint 0.3) — simple mailto, aucune donnée perso dans l'URL ── */}
      <section className="border border-gray-100 rounded-2xl p-5 bg-white">
        <h2 className="text-sm font-bold text-gray-700 mb-1">Un souci sur l&apos;application ?</h2>
        <p className="text-xs text-gray-400 mb-3">
          Décrivez ce qui ne fonctionne pas — cela nous aide à corriger vite pendant la bêta.
        </p>
        <a
          href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "jcdubien@gmail.com"}?subject=${encodeURIComponent(
            "Soignect — Signalement d'un problème",
          )}&body=${encodeURIComponent(
            "Décrivez le problème (quelle page, quelle action, ce qui s'est passé) :\n\n\n",
          )}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
        >
          🐛 Signaler un problème
        </a>
      </section>

      {/* ── Supprimer le compte ── */}
      <section className="border border-red-100 rounded-2xl p-5 bg-red-50/50">
        <h2 className="text-sm font-bold text-red-700 mb-2">Zone de danger</h2>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition"
          >
            Supprimer mon compte
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-700 font-medium">Cette action est irréversible. Toutes vos données seront supprimées.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition disabled:opacity-40"
              >
                {deleting ? "Suppression…" : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
