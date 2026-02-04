import { getServerSession, type NextAuthOptions } from "next-auth";
import { redirect } from "next/navigation";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password,
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as any).id; // ✅ ensure sub is userId
        token.role = (user as any).role; // ✅ store role
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub; // ✅ expose userId
        (session.user as any).role = token.role as string; // ✅ expose role
      }
      return session;
    },
  },
};

type Role = string;

/**
 * Require an authenticated user for a server component / route.
 *
 * - If no session: redirects to `/login` (or custom path).
 * - If roles are provided: redirects to `/unauthorized` when role is not allowed.
 */
export async function requireAuth(options?: {
  roles?: Role[];
  redirectTo?: string;
  unauthorizedRedirectTo?: string;
}) {
  let session = null;

  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    // If the JWT cookie is corrupt or signed with an old secret,
    // treat it as "no session" instead of crashing the app.
    session = null;
  }

  if (!session?.user) {
    redirect(options?.redirectTo ?? "/login");
  }

  if (options?.roles && session.user?.role) {
    const allowed = options.roles.includes(session.user.role as Role);
    if (!allowed) {
      // If the user is authenticated but not allowed for this page,
      // send them to their main area (e.g. profile/dashboard) instead
      // of an explicit unauthorized screen.
      redirect(options.unauthorizedRedirectTo ?? "/");
    }
  }

  return session;
}

/**
 * For pages like `/login`: if the user is already authenticated,
 * redirect them away (default to `/`).
 */
export async function redirectIfAuthenticated(path: string = "/") {
  let session = null;

  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }

  if (session?.user) {
    redirect(path);
  }

  return session;
}
