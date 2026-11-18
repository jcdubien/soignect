import { prisma } from "../src/lib/prisma";
(async () => {
  const ms = await prisma.match.findMany({ where: { OR: [{ missionAId: "cmwavd4zg0004wf4bwq5p48ed" }, { missionBId: "cmwavd4zg0004wf4bwq5p48ed" }, { profileBId: "cmwavd4g80002wf4btej2m30s" }, { profileAId: "cmwavd4g80002wf4btej2m30s" }] }, select: { id: true, status: true, horsSoignect: true, missionAId: true, signatureTitulaireAt: true, signatureRemplacantAt: true, termesContrat: true, createdAt: true } });
  console.log(ms);
  const t = await prisma.traceEvent.findMany({ where: { occurredAt: { gte: new Date("2026-11-17T12:00:00Z") } }, orderBy: { occurredAt: "desc" }, take: 15 });
  for (const e of t) console.log(e.occurredAt.toISOString(), JSON.stringify(e).slice(0, 300));
  await prisma.$disconnect();
})();
