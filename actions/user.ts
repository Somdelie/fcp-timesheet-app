"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type UserRole = "ADMIN" | "SUPERVISOR" | "FOREMAN";

export async function createNewUser(input: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const role = input.role;

  if (!email.includes("@")) {
    return { ok: false as const, error: "Invalid email." };
  }
  if (!name) {
    return { ok: false as const, error: "Name is required." };
  }
  if (!["ADMIN", "SUPERVISOR", "FOREMAN"].includes(role)) {
    return { ok: false as const, error: "Invalid role." };
  }
  if (input.password.length < 8) {
    return {
      ok: false as const,
      error: "Password must be at least 8 characters.",
    };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name,
          role, // role is a string enum in your schema
          password: passwordHash,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      // Keep domain tables consistent
      if (role === "SUPERVISOR") {
        await tx.supervisor.create({ data: { userId: created.id } });
      } else if (role === "FOREMAN") {
        await tx.foreman.create({ data: { userId: created.id } });
      }

      return created;
    });

    return { ok: true as const, user };
  } catch (e: any) {
    // Prisma unique constraint (email)
    if (String(e?.code) === "P2002") {
      return { ok: false as const, error: "Email already exists." };
    }
    return { ok: false as const, error: "Failed to create user." };
  }
}

// get user by email
export async function getUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      supervisor: true,
      foreman: true,
      password: true,
      createdAt: true,
    },
  });
  return user;
}

// get all users
export async function getAllUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return users;
}
