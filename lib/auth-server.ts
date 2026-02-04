import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export type ServerAuthUser = {
  userId: string;
  role: "ADMIN" | "SUPERVISOR" | "FOREMAN";
};

export async function requireServerAuth(): Promise<ServerAuthUser> {
  const session = await getServerSession(authOptions);

  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as
    | ServerAuthUser["role"]
    | undefined;

  if (!userId || !role) {
    throw new Error("Unauthorized");
  }

  return { userId, role };
}
