/**
 * Local authentication — replaces Manus OAuth.
 * JWT sessions signed with JWT_SECRET.
 */
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookies } from "cookie";
import { createRequire } from "module";
import type { Request } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as {
  compare: (plain: string, hash: string) => Promise<boolean>;
  hash: (plain: string, rounds: number) => Promise<string>;
};

export { bcrypt };

type SessionPayload = { openId: string; role: "admin" };

function getSecret() {
  return new TextEncoder().encode(ENV.cookieSecret || "fallback-dev-secret-change-me");
}

export async function createSessionToken(openId: string): Promise<string> {
  const payload: SessionPayload = { openId, role: "admin" };
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { openId, role } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || role !== "admin") return null;
    return { openId, role };
  } catch {
    return null;
  }
}

/** Build a User-shaped object from the session — avoids DB lookup for auth. */
export function sessionToUser(session: SessionPayload): User {
  return {
    id: 1,
    openId: session.openId,
    name: "Admin",
    email: ENV.adminUsername + "@local",
    loginMethod: "local",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

/** Authenticate an incoming Express request from the session cookie. */
export async function authenticateRequest(req: Request): Promise<User> {
  const cookies = parseCookies(req.headers.cookie ?? "");
  const token = cookies[COOKIE_NAME];
  const session = await verifySessionToken(token);
  if (!session) throw ForbiddenError("Invalid or missing session");
  return sessionToUser(session);
}
