import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const COOKIE_NAME = "casa_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h shift-friendly session

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short.");
  }
  return new TextEncoder().encode(s);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Returns the signed-in staff user, or null. Never throws on a bad cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Authenticate credentials against the DB. Returns the user or null. */
export async function authenticate(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user || !user.active) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// ---- Role-based access ----------------------------------------------------

/** Which roles may reach a given area. Owner can reach everything. */
export const ROLE_ACCESS: Record<string, Role[]> = {
  dashboard: ["OWNER", "FRONT_DESK"],
  calendar: ["OWNER", "FRONT_DESK"],
  reservations: ["OWNER", "FRONT_DESK"],
  frontdesk: ["OWNER", "FRONT_DESK"],
  housekeeping: ["OWNER", "FRONT_DESK", "HOUSEKEEPING"],
  reports: ["OWNER"],
  rooms: ["OWNER"],
  users: ["OWNER"],
};

export function canAccess(role: Role, area: keyof typeof ROLE_ACCESS): boolean {
  return ROLE_ACCESS[area]?.includes(role) ?? false;
}

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Require a signed-in user allowed in `area`; redirect otherwise. */
export async function requireAccess(
  area: keyof typeof ROLE_ACCESS
): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAccess(user.role, area)) {
    // Housekeeping's landing page is the board; everyone else gets the dashboard.
    redirect(user.role === "HOUSEKEEPING" ? "/housekeeping" : "/");
  }
  return user;
}

export { COOKIE_NAME };
