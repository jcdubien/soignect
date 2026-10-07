import fs from "fs";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim().replace(/^"|"$/g,"");
}
const { PrismaClient } = await import("@prisma/client");
const bcrypt = (await import("bcryptjs")).default;
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const hash = await bcrypt.hash("Banc284Test!", 10);
const avant = { users: await prisma.user.count(), profils: await prisma.profile.count() };
const mk = async (sfx, prof) => (await prisma.user.create({ data: {
  email: `banc-284-${sfx}@example.com`, passwordHash: hash, emailOptIn: false,
  profile: { create: { type: "REMPLACANT", name: `Banc284 ${sfx}`, profession: prof } },
}, include: { profile: true } }));
const dent = await mk("dentiste", "DENTISTE");
const ortho = await mk("orthoptiste", "ORTHOPTISTE");  // ordre neutre : vérifie l'autre branche
fs.writeFileSync(".banc284.json", JSON.stringify({
  users: [dent.id, ortho.id], profiles: [dent.profile.id, ortho.profile.id], avant }));
console.log("banc monté : dentiste + orthoptiste (ordre neutre)");
await prisma.$disconnect();
