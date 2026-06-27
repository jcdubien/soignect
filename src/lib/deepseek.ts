export interface MatchFactors {
  availability: number;
  location: number;
  specialties: number;
  bio: number;
}

export interface MatchScore {
  score: number;
  factors: MatchFactors;
}

export interface ScoringData {
  profileType: string;
  bio?: string | null;
  specialties?: string[];
  startDate?: Date | null;
  endDate?: Date | null;
  minMonths?: number | null;
  location?: string | null;
}

export async function computeMatchScore(
  a: ScoringData,
  b: ScoringData
): Promise<MatchScore> {
  const formatDate = (d?: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : null;

  const describeAvailability = (data: ScoringData) => {
    if (data.startDate && data.endDate)
      return `du ${formatDate(data.startDate)} au ${formatDate(data.endDate)}`;
    if (data.startDate) return `à partir du ${formatDate(data.startDate)}`;
    if (data.minMonths) return `poste longue durée (${data.minMonths} mois min)`;
    return "non précisée";
  };

  const prompt = `Tu es un moteur de matching pour kinésithérapeutes en Guadeloupe.
Évalue la compatibilité entre deux annonces et retourne UNIQUEMENT un JSON valide.

Annonce A (${a.profileType}):
- Bio: ${a.bio ?? "non renseignée"}
- Spécialités: ${(a.specialties ?? []).join(", ") || "non renseignées"}
- Disponibilité: ${describeAvailability(a)}
- Localisation: ${a.location ?? "non renseignée"}

Annonce B (${b.profileType}):
- Bio: ${b.bio ?? "non renseignée"}
- Spécialités: ${(b.specialties ?? []).join(", ") || "non renseignées"}
- Disponibilité: ${describeAvailability(b)}
- Localisation: ${b.location ?? "non renseignée"}

Retourne ce JSON et rien d'autre (valeurs entre 0.0 et 1.0):
{"score":0.0,"factors":{"availability":0.0,"location":0.0,"specialties":0.0,"bio":0.0}}`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Accept-Encoding": "identity",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek HTTP ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned empty content");

  return JSON.parse(content) as MatchScore;
}
