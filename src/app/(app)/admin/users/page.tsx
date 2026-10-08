import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import UsersClient from "./UsersClient";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      // Le drapeau, PAS le numéro (section 292). La page a seulement besoin de savoir s'il y a
      // un bouton à afficher ; le numéro ne descend au navigateur qu'au moment du clic, pour
      // une seule personne, via /api/admin/whatsapp. Le faire voyager avec la liste le mettrait
      // dans le cache, dans l'historique et dans toute copie d'écran de cet écran.
      phone: true,
      whatsappOptIn: true,
      profile: { select: { id: true, type: true, name: true } },
    },
  });

  const allege = users.map(({ phone, whatsappOptIn, ...u }) => ({
    ...u,
    joignableWhatsapp: whatsappOptIn && !!phone?.trim(),
  }));

  return <UsersClient initialUsers={JSON.parse(JSON.stringify(allege))} />;
}
