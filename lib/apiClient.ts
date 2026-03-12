/**
 * Client library for Admin API endpoints
 * These functions make fetch requests with Bearer token authentication
 */
import { headers as nextHeaders } from "next/headers";

async function getBaseUrl(): Promise<string> {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Server-side: derive base URL from incoming request headers
  try {
    const hdrs = await nextHeaders();
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
    const proto = hdrs.get("x-forwarded-proto") || "https";
    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // headers() may not be available outside of a request context
  }
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export interface AdminForeman {
  foremanId: string;
  userId: string;
  name: string | null;
  email: string;
  createdAt: string;
}

export interface AdminEmployee {
  id: string;
  firstName: string;
  lastName: string;
  qrCodeValue: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
}

export interface AdminAssistant {
  assistantUserId: string;
  assistantForemanId: string;
  assistantEmail: string;
  assistantName: string | null;
  employeeId: string;
  linkedToForemanId: string;
}

/**
 * List all foremen (optionally filtered by search)
 */
export async function apiAdminForemenList({
  token,
  q,
}: {
  token: string;
  q?: string;
}): Promise<
  { ok: true; foremen: AdminForeman[] } | { ok: false; error: string }
> {
  try {
    const base = await getBaseUrl();
    const url = new URL("/api/app/admin/foremen", base);
    if (q) url.searchParams.set("q", q);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "HTTP error" }));
      return { ok: false, error: error.error || `HTTP ${res.status}` };
    }

    return await res.json();
  } catch (e: unknown) {
    const message =
      e instanceof Error && e.message ? e.message : "Network error";
    return { ok: false, error: message };
  }
}

/**
 * Create a new foreman account
 */
export async function apiAdminCreateForeman({
  token,
  name,
  email,
  password,
}: {
  token: string;
  name: string;
  email: string;
  password: string;
}): Promise<
  | { ok: true; foreman: AdminForeman }
  | { ok: false; error: string; status?: number }
> {
  try {
    const base = await getBaseUrl();
    const url = new URL("/api/app/admin/foremen", base);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "HTTP error" }));
      return {
        ok: false,
        error: error.error || `HTTP ${res.status}`,
        status: res.status,
      };
    }

    return await res.json();
  } catch (e: unknown) {
    const message =
      e instanceof Error && e.message ? e.message : "Network error";
    return { ok: false, error: message };
  }
}

/**
 * List employees (optionally filtered to unlinked only)
 */
export async function apiAdminEmployees({
  token,
  unlinked,
  q,
}: {
  token: string;
  unlinked?: boolean;
  q?: string;
}): Promise<
  { ok: true; employees: AdminEmployee[] } | { ok: false; error: string }
> {
  try {
    const base = await getBaseUrl();
    const url = new URL("/api/app/admin/employees", base);
    if (unlinked) url.searchParams.set("unlinked", "true");
    if (q) url.searchParams.set("q", q);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "HTTP error" }));
      return { ok: false, error: error.error || `HTTP ${res.status}` };
    }

    return await res.json();
  } catch (e: unknown) {
    const message =
      e instanceof Error && e.message ? e.message : "Network error";
    return { ok: false, error: message };
  }
}

/**
 * Create an assistant for a foreman
 */
export async function apiAdminCreateAssistantForForeman({
  token,
  foremanId,
  employeeId,
  assistantName,
  assistantEmail,
  assistantPassword,
}: {
  token: string;
  foremanId: string;
  employeeId: string;
  assistantName: string;
  assistantEmail: string;
  assistantPassword: string;
}): Promise<
  | { ok: true; assistant: AdminAssistant }
  | { ok: false; error: string; status?: number }
> {
  try {
    const base = await getBaseUrl();
    const url = new URL(
      `/api/app/admin/foremen/${encodeURIComponent(foremanId)}/assistant`,
      base,
    );

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        employeeId,
        assistantName,
        assistantEmail,
        assistantPassword,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "HTTP error" }));
      return {
        ok: false,
        error: error.error || `HTTP ${res.status}`,
        status: res.status,
      };
    }

    return await res.json();
  } catch (e: unknown) {
    const message =
      e instanceof Error && e.message ? e.message : "Network error";
    return { ok: false, error: message };
  }
}
