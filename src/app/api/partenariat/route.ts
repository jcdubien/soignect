import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Profession, Territoire } from "@prisma/client";
import { hash } from "bcryptjs";
import { inseeOfCommune, COMMUNES_PAR_TERRITOIRE } from "@/lib/communes";
import { createNotification } from "@/lib/notifications";
import { logTraceEvent } from "@/lib/trace";
import {
  CONFIRMATION_PARTENARIAT, LIMITES_PARTENARIAT as L, PROFESSIONS_PARTENAIRE, TYPES_PARTENAIRE_ACCEPTES,
  libelleTypePartenaire,
} from "@/lib/partenariat";

export const dynamic = "force-dynamic";

// Communes reconnues, par île (section 379) : une demande de Martinique garde ses communes.
const codesConnus = (t: Territoire) => new Set(COMMUNES_PAR_TERRITOIRE[t].map(inseeOfCommune).filter((c): c is string => !!c));

const schema = z.object({
  type: z.enum(TYPES_PARTENAIRE_ACCEPTES as [string, ...string[]]),
  structure: z.string().trim().min(2).max(L.structure),
  contactNom: z.string().trim().min(2).max(L.contactNom),
  fonction: z.string().trim().max(L.fonction).optional(),
  email: z.string().trim().toLowerCase().email().max(L.email),
  telephone: z.string().trim().max(L.telephone).optional(),
  communes: z.array(z.string()).max(L.communes).default([]),
  professions: z.array(z.nativeEnum(Profession)).default([]),
  message: z.string().trim().max(L.message).optional(),
  src: z.string().max(80).optional(),
  consentement: z.literal(true),
  territoire: z.nativeEnum(Territoire).default(Territoire.GUADELOUPE),
  // ESPACE STRUCTURE (section 379) : la structure crée son compte en même temps que sa demande.
  // Le compte n'ouvre AUCUN outil avant que l'administrateur ait converti la demande — c'est la
  // conversion qui rattache ce compte, par son email, comme éditeur du client (lib/pageClient).
  motDePasse: z.string().min(6).max(200).optional(),
  acceptedTerms: z.boolean().optional(),
  // Champ piège, invisible pour un humain : rempli = robot. On répond « reçu » sans rien écrire.
  site: z.string().max(200).optional(),
});

// POST /api/partenariat — public. Aucun email n'est envoyé, ni au demandeur ni à l'administrateur :
// la demande est signalée dans l'application (cloche) et listée dans /admin/partenariats.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vérifiez les champs obligatoires : structure, nom, email et accord." }, { status: 400 });
  }
  const d = parsed.data;
  if (d.site) return NextResponse.json({ ok: true, message: CONFIRMATION_PARTENARIAT });

  if (d.motDePasse && d.acceptedTerms !== true) {
    return NextResponse.json({ error: "Acceptez les conditions d'utilisation pour créer votre espace." }, { status: 400 });
  }
  if (d.motDePasse && await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } })) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email : connectez-vous, puis faites la demande depuis votre espace structure.", compteExistant: true }, { status: 409 });
  }
  const connus = codesConnus(d.territoire);
  const communes = Array.from(new Set(d.communes)).filter((c) => connus.has(c));
  const professions = Array.from(new Set(d.professions)).filter((p) => PROFESSIONS_PARTENAIRE.includes(p));

  const recentes = await prisma.demandePartenariat.count({
    where: { email: d.email, createdAt: { gte: new Date(Date.now() - 86400_000) } },
  });
  if (recentes >= L.parEmailParJour) {
    return NextResponse.json({ error: "Votre demande a déjà été reçue. Nous revenons vers vous." }, { status: 429 });
  }

  // Le compte est créé avec la demande, dans la même transaction : pas de compte orphelin d'une
  // demande refusée en base, pas de demande dont l'auteur n'aurait pas pu se connecter.
  const passwordHash = d.motDePasse ? await hash(d.motDePasse, 12) : null;
  const demande = await prisma.$transaction(async (tx) => {
    if (passwordHash) {
      await tx.user.create({ data: { email: d.email, passwordHash, emailOptIn: false, acceptedTermsAt: new Date() } });
    }
    return tx.demandePartenariat.create({
    data: {
      territoire: d.territoire,
      type: d.type as (typeof TYPES_PARTENAIRE_ACCEPTES)[number],
      structure: d.structure, contactNom: d.contactNom, fonction: d.fonction || null,
      email: d.email, telephone: d.telephone || null,
      communes, professions, message: d.message || null, source: d.src || null,
    },
    select: { id: true, type: true },
    });
  });

  // Aucune donnée personnelle dans la trace : le type et la provenance suffisent à la mesure.
  logTraceEvent({ eventType: "PARTENARIAT_DEMANDE", metadata: { type: demande.type, src: d.src ?? "direct", territoire: d.territoire, compte: !!passwordHash } });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(admins.map((a) => createNotification({
    userId: a.id, type: "partenariat",
    message: `Demande de partenariat — ${libelleTypePartenaire(demande.type)} : ${d.structure}`,
    linkUrl: "/admin/partenariats",
  })));

  return NextResponse.json({ ok: true, message: CONFIRMATION_PARTENARIAT, compte: !!passwordHash }, { status: 201 });
}
