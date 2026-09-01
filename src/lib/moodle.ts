import { randomBytes } from "crypto";

type MoodleUser = { id: number; email: string };

function config() {
  const baseUrl = process.env.MOODLE_BASE_URL?.replace(/\/$/, "");
  const token = process.env.MOODLE_TOKEN;
  const courseId = Number(process.env.MOODLE_PREVENTION_COURSE_ID);
  const roleId = Number(process.env.MOODLE_STUDENT_ROLE_ID ?? "5");

  if (!baseUrl || !token || !Number.isInteger(courseId) || courseId <= 0 || !Number.isInteger(roleId)) {
    throw new Error("Moodle non configuré (URL, token, course ID ou role ID manquant)");
  }
  return { baseUrl, token, courseId, roleId };
}

async function callMoodle<T>(wsfunction: string, values: Record<string, string>): Promise<T> {
  const { baseUrl, token } = config();
  const form = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: "json",
    ...values,
  });
  const response = await fetch(`${baseUrl}/webservice/rest/server.php`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Moodle HTTP ${response.status}`);

  const result = (await response.json()) as T & { exception?: string; message?: string };
  if (result?.exception) throw new Error(`Moodle ${result.exception}: ${result.message ?? "erreur inconnue"}`);
  return result;
}

function names(fullName: string | null | undefined, email: string) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { firstname: email.split("@")[0] || "Participant", lastname: "Soignect" };
  if (parts.length === 1) return { firstname: parts[0], lastname: "Soignect" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

async function findOrCreateUser(email: string, fullName?: string | null): Promise<MoodleUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await callMoodle<MoodleUser[]>("core_user_get_users_by_field", {
    field: "email",
    "values[0]": normalizedEmail,
  });
  if (users[0]) return users[0];

  const { firstname, lastname } = names(fullName, normalizedEmail);
  const username = `soignect_${randomBytes(8).toString("hex")}`;
  const created = await callMoodle<MoodleUser[]>("core_user_create_users", {
    "users[0][username]": username,
    "users[0][firstname]": firstname,
    "users[0][lastname]": lastname,
    "users[0][email]": normalizedEmail,
    "users[0][auth]": "manual",
    "users[0][createpassword]": "1",
  });
  if (!created[0]) throw new Error("Moodle n'a retourné aucun utilisateur après création");
  return created[0];
}

export async function enrolInPreventionCourse(input: { email: string; fullName?: string | null }) {
  const { courseId, roleId } = config();
  const user = await findOrCreateUser(input.email, input.fullName);
  await callMoodle<null>("enrol_manual_enrol_users", {
    "enrolments[0][roleid]": String(roleId),
    "enrolments[0][userid]": String(user.id),
    "enrolments[0][courseid]": String(courseId),
    "enrolments[0][timestart]": String(Math.floor(Date.now() / 1000)),
  });
  return { moodleUserId: user.id, moodleCourseId: courseId };
}
