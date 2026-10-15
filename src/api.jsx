// ── api.js ───────────────────────────────────────────
// Thin fetch wrapper for the REQMGR server. Throws ApiError on failure;
// a 401 also fires 'reqmgr:unauthorized' so useAuth can show the login screen.

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('api/' + path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== 'login') window.dispatchEvent(new Event('reqmgr:unauthorized'));
    const detail = data?.detail;
    throw new ApiError(res.status, typeof detail === 'string' ? detail : `Request failed (${res.status})`);
  }
  return data;
}
