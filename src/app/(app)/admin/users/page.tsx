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
      profile: { select: { id: true, type: true, name: true } },
    },
  });

  return <UsersClient initialUsers={JSON.parse(JSON.stringify(users))} />;
}
