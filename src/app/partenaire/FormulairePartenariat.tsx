"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { LIMITES_PARTENARIAT as L } from "@/lib/partenariat";

type Zone = { zone: string; communes: { libelle: string; code: string }[] };

export default function FormulairePartenariat({ typeInitial, source, types, professions, zonesParIle, iles, ileInitiale, compteInitial }: {
  typeInitial: string;
  source: string;
  types: { type: string; libelle: string }[];
  professions: { valeur: string; libelle: string }[];
  zonesParIle: Record<string, Zone[]>;
  iles: { valeur: string; libelle: string }[];
  ileInitiale: string;
  compteInitial: boolean;
}) {
  const [type, setType] = useState(typeInitial);
  const [ile, setIle] = useState(ileInitiale);
  const zones = zonesParIle[ile] ?? [];
  // Espace structure (section 379) : le compte se crée avec la demande ; ses outils s'ouvrent
  // quand l'équipe Soignect a validé la structure.
  const [avecCompte, setAvecCompte] = useState(compteInitial);
  const [motDePasse, setMotDePasse] = useState("");
  const [cgu, setCgu] = useState(false);
  const [structure, setStructure] = useState("");
  const [contactNom, setContactNom] = useState("");
  const [fonction, setFonction] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [communes, setCommunes] = useState<string[]>([]);
  const [pros, setPros] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [consentement, setConsentement] = useState(false);
  const [site, setSite] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recu, setRecu] = useState<string | null>(null);

  const basculer = (liste: string[], v: string, max = Infinity) =>
    liste.includes(v) ? liste.filter((x) => x !== v) : liste.length < max ? [...liste, v] : liste;

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!type) { setErreur("Choisissez le type de structure."); return; }
    setEnvoi(true);
    try {
      const r = await fetch("/api/partenariat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, structure, contactNom, fonction: fonction || undefined, email,
          telephone: telephone || undefined, communes, professions: pros,
          message: message || undefined, src: source || undefined, consentement, site: site || undefined,
          territoire: ile,
          ...(avecCompte ? { motDePasse, acceptedTerms: cgu } : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.compte) {
        // Connexion immédiate, puis l'espace structure — qui dit où en est la validation.
        await signIn("credentials", { email: email.toLowerCase().trim(), password: motDePasse, redirect: false });
        window.location.href = "/structure";
        return;
      }
      if (r.ok) setRecu(j.message ?? "Demande reçue.");
      else setErreur(typeof j.error === "string" ? j.error : "Envoi impossible. Réessayez dans un instant.");
    } catch {
      setErreur("Problème de connexion. Vérifiez votre réseau et réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  if (recu) {
    return (
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="font-bold text-emerald-900">{recu}</p>
        <p className="text-sm text-emerald-800 mt-2">Nous vous répondrons à l&apos;adresse {email}.</p>
      </div>
    );
  }

  const champ = "w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kine-400 text-sm bg-white";
  const etiquette = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <form onSubmit={envoyer} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <label className={etiquette} htmlFor="p-type">Votre structure *</label>
        <select id="p-type" value={type} onChange={(e) => setType(e.target.value)} className={champ} required>
          <option value="">Choisissez…</option>
          {types.map((t) => <option key={t.type} value={t.type}>{t.libelle}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className={etiquette}>Votre île *</legend>
        <div className="flex gap-2">
          {iles.map((i) => (
            <label key={i.valeur} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${ile === i.valeur ? "border-kine-500 bg-kine-50 text-kine-800" : "border-gray-200 text-gray-600"}`}>
              <input type="radio" name="p-ile" className="sr-only" checked={ile === i.valeur} onChange={() => { setIle(i.valeur); setCommunes([]); }} />
              {i.libelle}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className={etiquette} htmlFor="p-structure">Nom de la structure *</label>
        <input id="p-structure" value={structure} onChange={(e) => setStructure(e.target.value)} maxLength={L.structure} required minLength={2} className={champ} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={etiquette} htmlFor="p-nom">Votre nom *</label>
          <input id="p-nom" value={contactNom} onChange={(e) => setContactNom(e.target.value)} maxLength={L.contactNom} required minLength={2} className={champ} />
        </div>
        <div>
          <label className={etiquette} htmlFor="p-fonction">Votre fonction</label>
          <input id="p-fonction" value={fonction} onChange={(e) => setFonction(e.target.value)} maxLength={L.fonction} placeholder="Coordinatrice, directeur…" className={champ} />
        </div>
        <div>
          <label className={etiquette} htmlFor="p-email">Email *</label>
          <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={L.email} required className={champ} />
        </div>
        <div>
          <label className={etiquette} htmlFor="p-tel">Téléphone</label>
          <input id="p-tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} maxLength={L.telephone} className={champ} />
        </div>
      </div>

      <fieldset>
        <legend className={etiquette}>Professions concernées</legend>
        <div className="flex flex-wrap gap-2">
          {professions.map((p) => (
            <label key={p.valeur} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${pros.includes(p.valeur) ? "border-kine-500 bg-kine-50 text-kine-800" : "border-gray-200 text-gray-600"}`}>
              <input type="checkbox" className="sr-only" checked={pros.includes(p.valeur)} onChange={() => setPros(basculer(pros, p.valeur))} />
              {p.libelle}
            </label>
          ))}
        </div>
      </fieldset>

      <details className="rounded-xl border border-gray-100 p-3">
        <summary className="text-xs font-medium text-gray-600 cursor-pointer">
          Communes de votre territoire {communes.length > 0 ? `(${communes.length})` : "(facultatif)"}
        </summary>
        <div className="mt-3 space-y-3">
          {zones.map((z) => (
            <div key={z.zone}>
              <p className="text-xs font-semibold text-gray-500 mb-1">{z.zone}</p>
              <div className="flex flex-wrap gap-1.5">
                {z.communes.map((c) => (
                  <label key={c.code} className={`px-2.5 py-1 rounded-full border text-xs cursor-pointer ${communes.includes(c.code) ? "border-kine-500 bg-kine-50 text-kine-800" : "border-gray-200 text-gray-600"}`}>
                    <input type="checkbox" className="sr-only" checked={communes.includes(c.code)} onChange={() => setCommunes(basculer(communes, c.code, L.communes))} />
                    {c.libelle}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <div>
        <label className={etiquette} htmlFor="p-message">Votre besoin</label>
        <textarea id="p-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={L.message} rows={4} placeholder="Ce que vous cherchez, vos zones en tension, vos questions…" className={`${champ} resize-none`} />
      </div>

      {/* Champ piège — invisible et hors tabulation pour un humain. */}
      <div aria-hidden="true" className="absolute -left-[10000px] w-px h-px overflow-hidden">
        <label>Site web<input tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} /></label>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} required className="mt-0.5" />
        <span className="text-xs text-gray-500 leading-snug">
          J&apos;accepte que Soignect conserve ces informations pour me recontacter au sujet d&apos;un partenariat
          (voir la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>). *
        </span>
      </label>

      {/* Espace structure (section 379) — facultatif : la demande seule reste possible. */}
      <div className="rounded-xl border border-kine-100 bg-kine-50/50 p-3 space-y-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={avecCompte} onChange={(e) => setAvecCompte(e.target.checked)} className="mt-0.5" />
          <span className="text-sm text-gray-700 leading-snug">
            Créer l&apos;espace de ma structure
            <span className="block text-xs text-gray-500">
              Votre page, vos besoins et le suivi de votre territoire, ouverts dès que l&apos;équipe Soignect a validé votre structure.
            </span>
          </span>
        </label>
        {avecCompte && (
          <>
            <div>
              <label className={etiquette} htmlFor="p-mdp">Mot de passe *</label>
              <input id="p-mdp" type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} minLength={6} required className={champ} />
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)} required className="mt-0.5" />
              <span className="text-xs text-gray-500 leading-snug">
                J&apos;accepte les <Link href="/cgu" className="underline">conditions d&apos;utilisation</Link>. *
              </span>
            </label>
          </>
        )}
      </div>

      {erreur && <p role="alert" className="text-red-600 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">{erreur}</p>}

      <button type="submit" disabled={envoi} className="w-full py-3 bg-kine-600 text-white rounded-xl font-bold text-sm hover:bg-kine-700 transition disabled:opacity-50">
        {envoi ? "Envoi…" : avecCompte ? "Créer l'espace et envoyer la demande →" : "Envoyer la demande →"}
      </button>
    </form>
  );
}
