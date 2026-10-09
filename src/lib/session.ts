// sessionStorage, one JSON blob. `token` is the signed session xyra-core issued
// at login - it's the ONLY thing the backend trusts for tenant/user/persona.
// The other fields are display/routing copies of what login returned; editing
// them in devtools changes nothing server-side.
const KEY = "xyra.session";

export type Session = {
    token: string;
    userId: string;
    tenantId: string | null;
    role: string;
    name: string;
    email: string;
};

export function saveSession(session: Session) {
    sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as Session;
    } catch {
        return null;
    }
}

export function clearSession() {
    sessionStorage.removeItem(KEY);
}
