import { createHmac, timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";
import { getCookie, setHeader } from "h3";

const COOKIE_NAME = "panseek_unlock";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 天
const COOKIE_PATH = "/";

export function createAuthToken(secret: string): string {
  const ts = String(Date.now());
  const sig = createHmac("sha256", secret).update(ts).digest("hex");
  return `${ts}.${sig}`;
}

export function verifyAuthToken(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const expected = createHmac("sha256", secret).update(ts).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")))
      return false;
  } catch {
    return false;
  }
  const age = Date.now() - parseInt(ts, 10);
  return age >= 0 && age < COOKIE_MAX_AGE * 1000;
}

export function verifyAuthCookie(event: H3Event, secret: string): boolean {
  const cookie = getCookie(event, COOKIE_NAME);
  return !!cookie && verifyAuthToken(cookie, secret);
}

export function setAuthCookie(event: H3Event, token: string): void {
  setHeader(event, "Set-Cookie", [
    `${COOKIE_NAME}=${token}; Path=${COOKIE_PATH}; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
  ].join(""));
}
