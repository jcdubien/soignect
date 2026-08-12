import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/annonces");

  return (
    // Colonne sur mobile (le bandeau de navigation se place AU-DESSUS du contenu), ligne à
    // partir de sm (barre latérale à gauche, comme avant).
    <div className="flex flex-col sm:flex-row flex-1 min-h-0">
      <AdminSidebar />
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
