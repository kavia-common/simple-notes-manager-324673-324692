const DEFAULT_TIMEOUT_MS = 15000;

function normalizeBaseUrl(url) {
  if (!url) return "";
  return String(url).replace(/\/+$/, "");
}

function buildUrl(baseUrl, path) {
  const base = normalizeBaseUrl(baseUrl);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

    if (!res.ok) {
      const msg =
        (body && typeof body === "object" && (body.detail || body.message)) ||
        (typeof body === "string" && body) ||
        `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return body;
  } finally {
    clearTimeout(id);
  }
}

// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  /**
   * Returns the base URL to use for API requests.
   * Prefers REACT_APP_API_BASE; falls back to REACT_APP_BACKEND_URL.
   */
  const env = process.env || {};
  return normalizeBaseUrl(env.REACT_APP_API_BASE || env.REACT_APP_BACKEND_URL || "");
}

/**
 * This client assumes a conventional REST API:
 * - GET    /notes           -> list notes
 * - POST   /notes           -> create note {title, content}
 * - GET    /notes/:id       -> get note
 * - PUT    /notes/:id       -> update note {title, content}
 * - DELETE /notes/:id       -> delete note
 *
 * If the backend differs, adjust the paths here.
 */

// PUBLIC_INTERFACE
export async function listNotes() {
  /** List all notes. */
  const baseUrl = getApiBaseUrl();
  return fetchJson(buildUrl(baseUrl, "/notes"), { method: "GET" });
}

// PUBLIC_INTERFACE
export async function createNote(payload) {
  /** Create a new note with {title, content}. */
  const baseUrl = getApiBaseUrl();
  return fetchJson(buildUrl(baseUrl, "/notes"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// PUBLIC_INTERFACE
export async function getNote(noteId) {
  /** Fetch a note by id. */
  const baseUrl = getApiBaseUrl();
  return fetchJson(buildUrl(baseUrl, `/notes/${encodeURIComponent(noteId)}`), { method: "GET" });
}

// PUBLIC_INTERFACE
export async function updateNote(noteId, payload) {
  /** Update a note by id with {title, content}. */
  const baseUrl = getApiBaseUrl();
  return fetchJson(buildUrl(baseUrl, `/notes/${encodeURIComponent(noteId)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// PUBLIC_INTERFACE
export async function deleteNote(noteId) {
  /** Delete a note by id. */
  const baseUrl = getApiBaseUrl();
  return fetchJson(buildUrl(baseUrl, `/notes/${encodeURIComponent(noteId)}`), { method: "DELETE" });
}
