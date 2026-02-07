"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export type UserRole = "ADMIN" | "SUPERVISOR" | "FOREMAN";

export async function createNewUser(input: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  dayRate?: number;
  supervisorId?: string;
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

  // Validate dayRate for foreman
  if (role === "FOREMAN") {
    if (!input.dayRate || input.dayRate <= 0) {
      return {
        ok: false as const,
        error: "Day rate must be greater than 0 for foremen.",
      };
    }
    if (!input.supervisorId) {
      return {
        ok: false as const,
        error: "Supervisor is required for foremen.",
      };
    }
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
        const foreman = await tx.foreman.create({
          data: {
            userId: created.id,
            defaultDayRate: input.dayRate ? String(input.dayRate) : undefined,
          },
        });

        // Link foreman to supervisor
        if (input.supervisorId) {
          // Get the supervisor record by its User ID
          const supervisor = await tx.supervisor.findUnique({
            where: { userId: input.supervisorId },
          });

          if (supervisor) {
            await tx.supervisorForeman.create({
              data: {
                supervisorId: supervisor.id,
                foremanId: foreman.id,
                startsOn: new Date(),
              },
            });
          }
        }

        // Create an employee profile for the foreman so they can scan their own card
        // Generate a unique QR code value - database is source of truth
        const token = randomBytes(8).toString("hex").toUpperCase();
        const qrCodeValue = token;

        await tx.employee.create({
          data: {
            firstName: name.split(" ")[0] || name,
            lastName: name.split(" ").slice(1).join(" ") || "",
            defaultDayRate: input.dayRate ? String(input.dayRate) : "0",
            qrCodeValue,
            createdByUserId: created.id,
          },
        });
      }

      return created;
    });

    return { ok: true as const, user };
  } catch (e: any) {
    // Prisma unique constraint (email)
    if (String(e?.code) === "P2002") {
      return { ok: false as const, error: "Email already exists." };
    }
    console.error("Create user error:", e);
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

// get all supervisors
export async function getAllSupervisors() {
  const supervisors = await prisma.user.findMany({
    where: { role: "SUPERVISOR" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      supervisor: {
        select: {
          id: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return supervisors;
}

// get all foremen
export async function getAllForemen() {
  const foremen = await prisma.user.findMany({
    where: { role: "FOREMAN" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      foreman: {
        select: {
          id: true,
          defaultDayRate: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return foremen;
}

// delete user by id
export async function deleteUserById(id: string) {
  try {
    await prisma.$transaction(async (tx) => {
      // Delete supervisor and foreman related records (they cascade in schema)
      // Delete any sessions
      await tx.session.deleteMany({ where: { userId: id } });

      // Delete any accounts
      await tx.account.deleteMany({ where: { userId: id } });

      // Employee records with createdByUserId set to this user will have it set to null (SetNull in schema)
      // Employee records with userId set to this user (if promoted) will have it set to null (SetNull in schema)
      // Finally delete the user
      await tx.user.delete({ where: { id } });
    });
    return { ok: true as const };
  } catch (e: any) {
    console.error("Error deleting user:", e);
    return { ok: false as const, error: "Failed to delete user." };
  }
}

// update user basic info
export async function updateUser(input: {
  id: string;
  name: string;
  email: string;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!email.includes("@")) {
    return { ok: false as const, error: "Invalid email." };
  }
  if (!name) {
    return { ok: false as const, error: "Name is required." };
  }

  try {
    const user = await prisma.user.update({
      where: { id: input.id },
      data: { email, name },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return { ok: true as const, user };
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      return { ok: false as const, error: "Email already exists." };
    }
    return { ok: false as const, error: "Failed to update user." };
  }
}

// update user password (ADMIN only)
export async function updateUserPassword(input: {
  userId: string;
  newPassword: string;
}) {
  const { requireServerAuth } = await import("@/lib/auth-server");
  const auth = await requireServerAuth();

  // Only ADMIN can update user passwords
  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Only admins can update passwords." };
  }

  const newPassword = (input.newPassword ?? "").trim();

  if (newPassword.length < 8) {
    return {
      ok: false as const,
      error: "Password must be at least 8 characters.",
    };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  try {
    const user = await prisma.user.update({
      where: { id: input.userId },
      data: { password: passwordHash },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return {
      ok: true as const,
      user,
      message: "Password updated successfully.",
    };
  } catch (e: any) {
    console.error("Update password error:", e);
    return { ok: false as const, error: "Failed to update password." };
  }
}
