import AdminPrioritesPage from "@/app/(app)/admin/priorites/page";

export const dynamic = "force-dynamic";

// MÊME ÉCRAN que /admin/priorites — réexporté, pas recopié. Deux copies d'un formulaire de
// saisie divergent au premier champ ajouté, et celui-ci pilote un levier qui déplace de vraies
// annonces dans le fil. Seule la GARDE change : elle vit dans le layout du segment.
export default AdminPrioritesPage;
