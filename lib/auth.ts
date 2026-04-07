import { createHash } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "family_scheduler_auth";
const AUTH_TTL_SECONDS = 60 * 60 * 24 * 30;

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPasscode(passcode: string): string {
  return hashValue(passcode);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const sessionCookie = store.get(COOKIE_NAME)?.value;
  const secret = process.env.FAMILY_SESSION_SECRET;
  if (!sessionCookie || !secret) {
    return false;
  }
  return sessionCookie === hashValue(secret);
}

export async function setAuthCookie(): Promise<void> {
  const store = await cookies();
  const secret = process.env.FAMILY_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing FAMILY_SESSION_SECRET");
  }
  store.set(COOKIE_NAME, hashValue(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: AUTH_TTL_SECONDS,
    path: "/",
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

