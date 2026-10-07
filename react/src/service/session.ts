const base = import.meta.env.VITE_SERVER_URL as string;
const STORAGE_KEY = "embedkit_session_token";

// Session token returned by the server when exchanging a one-time code.
// Sent via the Authorization header so it works even when the browser blocks
// third-party cookies in the iframe (Safari, Chrome with 3P cookies blocked).
// sessionStorage may be blocked in iframes, so always keep an in-memory copy too.
let memoryToken: string | null = null;

function readToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = sessionStorage.getItem(STORAGE_KEY);
  } catch {}
  return memoryToken;
}

function writeToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function clearSession() {
  writeToken(null);
}

// fetch to the API with the session attached (Bearer + cookie)
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = readToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${base}${path}`, { ...init, headers, credentials: "include" });
  if (res.status === 401) clearSession();
  return res;
}

export async function exchangeCode(code: string) {
  const res = await fetch(`${base}/api/session/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Invalid or expired code." : "Unable to start session.");
  const { token } = await res.json();
  writeToken(token);
}

// If the URL has ?code=... (iframe from Genesis or opened directly on the web):
// strip the code from the URL immediately, then exchange it for a session.
// Share one promise so StrictMode (effects run twice) doesn't consume the code twice.
let pendingExchange: Promise<void> | null = null;

export function exchangeCodeFromUrl(): Promise<void> {
  if (pendingExchange) return pendingExchange;

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return Promise.resolve();

  url.searchParams.delete("code");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);

  pendingExchange = exchangeCode(code);
  return pendingExchange;
}
