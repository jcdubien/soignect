import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import AplClient from "./AplClient";

export default async function AdminAplPage() {
  const communes = await prisma.communeAPL.findMany({
    orderBy: [{ departement: "asc" }, { commune: "asc" }],
    take: 500,
  });

  return <AplClient initialData={JSON.parse(JSON.stringify(communes))} />;
}
