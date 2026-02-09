"use server";

import { requireAuth } from "@/lib/auth";
import { signApiToken } from "@/lib/jwt";
import {
  apiAdminForemenList,
  apiAdminCreateForeman,
  apiAdminEmployees,
  apiAdminCreateAssistantForForeman,
} from "@/lib/apiClient";

/**
 * Server action: List all foremen
 */
export async function actionAdminListForemen({ q }: { q?: string } = {}) {
  const session = await requireAuth({ roles: ["ADMIN"] });

  // Generate a JWT token from the session
  const token = await signApiToken({
    sub: session.user.id,
    email: session.user.email || "",
    role: session.user.role || "ADMIN",
  });

  // Use the API client to fetch data
  // @ts-ignore - window is not defined in server context, but apiClient handles fetch
  return apiAdminForemenList({ token, q });
}

/**
 * Server action: Create a new foreman
 */
export async function actionAdminCreateForeman({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const session = await requireAuth({ roles: ["ADMIN"] });

  const token = await signApiToken({
    sub: session.user.id,
    email: session.user.email || "",
    role: session.user.role || "ADMIN",
  });

  // @ts-ignore
  return apiAdminCreateForeman({ token, name, email, password });
}

/**
 * Server action: List employees (optionally filtered)
 */
export async function actionAdminListEmployees({
  unlinked,
  q,
}: {
  unlinked?: boolean;
  q?: string;
} = {}) {
  const session = await requireAuth({ roles: ["ADMIN"] });

  const token = await signApiToken({
    sub: session.user.id,
    email: session.user.email || "",
    role: session.user.role || "ADMIN",
  });

  // @ts-ignore
  return apiAdminEmployees({ token, unlinked, q });
}

/**
 * Server action: Create an assistant for a foreman
 */
export async function actionAdminCreateAssistant({
  foremanId,
  employeeId,
  assistantName,
  assistantEmail,
  assistantPassword,
}: {
  foremanId: string;
  employeeId: string;
  assistantName: string;
  assistantEmail: string;
  assistantPassword: string;
}) {
  const session = await requireAuth({ roles: ["ADMIN"] });

  const token = await signApiToken({
    sub: session.user.id,
    email: session.user.email || "",
    role: session.user.role || "ADMIN",
  });

  // @ts-ignore
  return apiAdminCreateAssistantForForeman({
    token,
    foremanId,
    employeeId,
    assistantName,
    assistantEmail,
    assistantPassword,
  });
}
