function parseCookieHeader(cookieHeader: string | null) {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;

  for (const entry of cookieHeader.split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    map.set(key, value);
  }

  return map;
}

function tryDecodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseJsonToken(value: unknown): string {
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  const direct = row["access_token"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return "";
}

function decodeBase64(value: string) {
  if (!value) return "";

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return "";
}

function extractAccessTokenFromAuthCookieValue(rawValue: string) {
  const decoded = tryDecodeCookieValue(rawValue);
  if (!decoded) return "";

  if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(decoded)) {
    return decoded;
  }

  try {
    const parsed = JSON.parse(decoded);
    const token = parseJsonToken(parsed);
    if (token) return token;
  } catch {
    // not json
  }

  if (decoded.startsWith("base64-")) {
    try {
      const parsed = JSON.parse(decodeBase64(decoded.slice("base64-".length)));
      const token = parseJsonToken(parsed);
      if (token) return token;
    } catch {
      // ignore malformed auth cookie
    }
  }

  return "";
}

function matchesCookieName(name: string, pattern: RegExp) {
  return pattern.test(String(name || "").trim());
}

export function getAccessTokenFromCookieHeader(cookieHeader: string | null) {
  const cookies = parseCookieHeader(cookieHeader);

  const directCookieNames = Array.from(cookies.keys()).filter((key) =>
    matchesCookieName(key, /^(?:__Secure-|__Host-)?sb-access-token$/i)
  );
  for (const name of directCookieNames) {
    const value = cookies.get(name);
    if (value) return tryDecodeCookieValue(value);
  }

  const authCookieNames = Array.from(cookies.keys()).filter((key) =>
    matchesCookieName(key, /^(?:__Secure-|__Host-)?sb-[a-z0-9]+-auth-token$/i)
  );
  for (const name of authCookieNames) {
    const token = extractAccessTokenFromAuthCookieValue(cookies.get(name) || "");
    if (token) return token;
  }

  const chunked = new Map<string, Array<{ idx: number; value: string }>>();
  for (const [name, value] of cookies.entries()) {
    const match = /^((?:(?:__Secure-|__Host-)?sb-[a-z0-9]+-auth-token))\.(\d+)$/i.exec(name);
    if (!match) continue;
    const base = match[1];
    const idx = Number(match[2]);
    const parts = chunked.get(base) || [];
    parts.push({ idx, value });
    chunked.set(base, parts);
  }

  for (const parts of chunked.values()) {
    const joined = parts
      .sort((a, b) => a.idx - b.idx)
      .map((part) => part.value)
      .join("");
    const token = extractAccessTokenFromAuthCookieValue(joined);
    if (token) return token;
  }

  return "";
}

export function getBearerTokenFromAuthorizationHeader(authHeader: string | null) {
  const header = String(authHeader || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export function getAccessTokenFromRequest(request: Pick<Request, "headers">) {
  return (
    getBearerTokenFromAuthorizationHeader(request.headers.get("authorization")) ||
    getAccessTokenFromCookieHeader(request.headers.get("cookie")) ||
    ""
  );
}
