import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "dev-secret-change-me",
);

export type ApiJwtPayload = {
  sub: string;
  email: string;
  role: string;
};

export async function signApiToken(payload: ApiJwtPayload, expiresIn = "7d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyApiToken(
  token: string,
): Promise<ApiJwtPayload | null> {
  try {
    const { payload } = await jwtVerify<ApiJwtPayload>(token, secret);
    return payload;
  } catch {
    return null;
  }
}
