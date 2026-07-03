import { cookies } from "next/headers";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
  type BinaryLike,
} from "node:crypto";
import { db } from "@/lib/db";

/*
  Lightweight cookie-session auth for Reflix.
  - Passwords hashed with Node's built-in scrypt + per-user salt.
  - Session token = `${userId}.${hmac(userId)}` signed with AUTH_SECRET.
  - Stored in an httpOnly cookie named "reflix_session".
  No external deps; robust enough for the demo and swappable for Supabase Auth later.
*/

const AUTH_SECRET: BinaryLike =
  process.env.AUTH_SECRET || "reflix-dev-secret-change-in-production-9f3a";
const COOKIE_NAME = "reflix_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// scrypt-based password hashing: store as `saltHex:hashHex`
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const hashBuf = scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(hash, "hex");
    if (hashBuf.length !== storedBuf.length) return false;
    return timingSafeEqual(hashBuf, storedBuf);
  } catch {
    return false;
  }
}

function sign(userId: string): string {
  const sig = createHmac("sha256", AUTH_SECRET).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

function verify(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 1) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(userId);
  const expectedSig = expected.slice(expected.lastIndexOf(".") + 1);
  if (sig.length !== expectedSig.length) return null;
  try {
    if (timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return userId;
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

export async function createSession(userId: string): Promise<void> {
  const token = sign(userId);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const userId = await getSession();
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "ADMIN" : "USER",
  };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Error("FORBIDDEN");
  return u;
}
