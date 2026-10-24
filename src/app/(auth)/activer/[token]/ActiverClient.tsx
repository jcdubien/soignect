"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function ActiverClient({ token, email }: { token: string; email: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepte, setAccepte] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function activer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (password !== confirm) { setErreur("Les mots de passe ne correspondent pas."); return; }
    setEnvoi(true);
    try {
      const r = await fetch("/api/activer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password, acceptedTerms: accepte, emailOptIn }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setErreur(d?.error ?? "Activation impossible."); return; }
      const s = await signIn("credentials", { email: d.email, password, redirect: false });
      window.location.href = s?.error ? "/login" : `/match/${d.matchId}/contrat`;
    } finally { setEnvoi(false); }
  }

  const champ = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm";
  return (
    <form onSubmit={activer} className="mt-6 space-y-3">
      <label className="block text-xs font-semibold text-gray-600">Email<input value={email} disabled className={`${champ} bg-gray-50 text-gray-500`} /></label>
      <label className="block text-xs font-semibold text-gray-600">Mot de passe (8 caractères au moins)<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={champ} /></label>
      <label className="block text-xs font-semibold text-gray-600">Confirmer<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={champ} /></label>
      <label className="flex gap-2 items-start text-xs text-gray-600">
        <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} className="mt-0.5" />
        <span>J&apos;accepte les{" "}
          <a href="/cgu" target="_blank" rel="noopener noreferrer" className="text-kine-600 underline">CGU/CGV</a>, la{" "}
          <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-kine-600 underline">politique de confidentialité</a> et les{" "}
          <a href="/mentions-legales" target="_blank" rel="noopener noreferrer" className="text-kine-600 underline">mentions légales</a>.</span>
      </label>
      <label className="flex gap-2 items-start text-xs text-gray-600">
        <input type="checkbox" checked={emailOptIn} onChange={(e) => setEmailOptIn(e.target.checked)} className="mt-0.5" />
        <span>Recevoir les notifications Soignect par email (facultatif).</span>
      </label>
      {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
      <button disabled={envoi || !accepte} className="w-full rounded-xl bg-kine-600 py-3 text-sm font-bold text-white disabled:opacity-60">{envoi ? "Activation…" : "Activer mon compte et voir le contrat"}</button>
    </form>
  );
}
