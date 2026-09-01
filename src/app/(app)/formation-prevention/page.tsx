import PreventionCheckoutButton from "./PreventionCheckoutButton";

export const dynamic = "force-dynamic";

export default function FormationPreventionPage({
  searchParams,
}: {
  searchParams: { payment?: string };
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <section className="overflow-hidden rounded-2xl border border-kine-100 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-kine-700 to-kine-500 px-6 py-9 text-white sm:px-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-kine-100">Soignect Formation</p>
          <h1 className="text-3xl font-black sm:text-4xl">Prévention : appliquer les nouveaux actes</h1>
          <p className="mt-4 max-w-2xl text-kine-50">
            Une formation entièrement en ligne pour maîtriser le repérage, les tests, le compte rendu et la facturation.
          </p>
        </div>

        <div className="space-y-6 p-6 sm:p-10">
          {searchParams.payment === "success" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
              Paiement confirmé. Votre inscription Moodle est en cours ; vous recevrez vos accès par e-mail.
            </div>
          )}
          {searchParams.payment === "cancelled" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" role="status">
              Paiement annulé : rien n'a été débité. Vous pouvez reprendre quand vous le souhaitez.
            </div>
          )}

          <ul className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
            <li className="rounded-xl bg-gray-50 p-4">Parcours autonome sur Moodle</li>
            <li className="rounded-xl bg-gray-50 p-4">Cas pratiques et tests guidés</li>
            <li className="rounded-xl bg-gray-50 p-4">Modèles de compte rendu</li>
            <li className="rounded-xl bg-gray-50 p-4">Accès créé après paiement sécurisé</li>
          </ul>

          <PreventionCheckoutButton />
          <p className="text-center text-xs text-gray-500">Paiement unique sécurisé par Stripe.</p>
        </div>
      </section>
    </main>
  );
}
