// Shared by proxy.ts (no Node-only imports allowed there) and the session code.

const isProduction = process.env.NODE_ENV === "production";

/**
 * In production the cookie uses the `__Host-` prefix, which browsers only accept
 * when it is Secure, has Path=/ and no Domain. That stops subdomains from
 * planting or overriding it. Plain HTTP on localhost can't use the prefix.
 */
export const SESSION_COOKIE = isProduction ? "__Host-session" : "session";
export const SESSION_COOKIE_SECURE = isProduction;

/** Absolute session lifetime: 8 hours. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
