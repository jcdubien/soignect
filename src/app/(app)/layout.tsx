import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/ui/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.profileId) redirect("/register");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/swipe" className="text-xl font-bold text-kine-700">
          KinéBoard
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/swipe"
            className="text-gray-500 hover:text-kine-600 transition text-sm font-medium"
          >
            Swipe
          </Link>
          <Link
            href="/missions/create"
            className="text-gray-500 hover:text-kine-600 transition text-sm font-medium"
          >
            + Annonce
          </Link>
          <Link
            href="/matches"
            className="text-gray-500 hover:text-kine-600 transition text-sm font-medium"
          >
            Matches
          </Link>
          {(session.user as { role: string }).role === "ADMIN" && (
            <Link
              href="/admin"
              className="text-gray-500 hover:text-kine-600 transition text-sm font-medium"
            >
              Admin
            </Link>
          )}
          <SignOutButton />
        </nav>
      </header>

      {/* Contenu */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
