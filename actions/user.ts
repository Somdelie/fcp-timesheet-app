"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { deleteImage } from "@/lib/cloudinary";

export type UserRole = "ADMIN" | "OFFICE" | "SUPERVISOR" | "FOREMAN";

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
    // ✅ STEP 1: Create user first (simplest operation)
    const created = await prisma.user.create({
      data: {
        email,
        name,
        role,
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

    try {
      // ✅ STEP 2: Create domain-specific records (with error handling)
      if (role === "SUPERVISOR") {
        await prisma.supervisor.create({
          data: {
            user: { connect: { id: created.id } },
          },
        });
      } else if (role === "FOREMAN") {
        const dayRateDecimal = input.dayRate
          ? parseFloat(input.dayRate.toString())
          : 0;

        // Create foreman record
        const foreman = await prisma.foreman.create({
          data: {
            user: { connect: { id: created.id } },
            defaultDayRate: dayRateDecimal > 0 ? dayRateDecimal : null,
          },
        });

        // Link to supervisor
        if (input.supervisorId) {
          try {
            await prisma.supervisorForeman.create({
              data: {
                supervisor: { connect: { id: input.supervisorId } },
                foreman: { connect: { id: foreman.id } },
                startsOn: new Date(),
              },
            });
          } catch (supervisorError: any) {
            console.error("Failed to link supervisor:", supervisorError);
            // Continue anyway - user and foreman are created
          }
        }

        // Create employee profile
        const token = randomBytes(8).toString("hex").toUpperCase();
        const qrCodeValue = `EMP-${token}`;

        try {
          await prisma.employee.create({
            data: {
              firstName: name.split(" ")[0] || name,
              lastName: name.split(" ").slice(1).join(" ") || "",
              defaultDayRate: dayRateDecimal > 0 ? dayRateDecimal : null,
              qrCodeValue,
              createdByUser: { connect: { id: created.id } },
              // Link the employee profile back to this foreman user
              user: { connect: { id: created.id } },
              isActive: true,
            },
          });
        } catch (employeeError: any) {
          console.error("Failed to create employee record:", employeeError);
          // Continue anyway - user and foreman are created
        }
      }

      revalidatePath("/users");
      return { ok: true as const, user: created };
    } catch (error: any) {
      // If secondary operations fail, user is still created
      console.error("Secondary operation failed:", error);
      revalidatePath("/users");
      return { ok: true as const, user: created };
    }
  } catch (e: any) {
    console.error("Create user error:", e);

    if (String(e?.code) === "P2002") {
      return { ok: false as const, error: "Email already exists." };
    }
    if (String(e?.code) === "P2028") {
      return {
        ok: false as const,
        error:
          "Request took too long. The database may be overloaded. Please try again in a moment.",
      };
    }

    return {
      ok: false as const,
      error: e.message || "Failed to create user.",
    };
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
      phone: true,
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
      phone: true,
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
    where: {
      role: "FOREMAN",
      foreman: { isNot: null }, // Only include users that have a Foreman record
    },
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
          defaultTeam: true,
          createdAt: true,
        },
      },
      // Check if this user was promoted from an employee who is an assistant
      employee: {
        select: {
          id: true,
          assistantLinks: {
            select: { foremanId: true },
            take: 1,
          },
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
    // Clean up linked employee face image from Cloudinary
    const linkedEmployee = await prisma.employee.findFirst({
      where: { userId: id },
      select: { faceImageUrl: true },
    });

    if (linkedEmployee?.faceImageUrl) {
      const match = linkedEmployee.faceImageUrl.match(
        /\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/,
      );
      const publicId = match?.[1] ?? null;
      if (publicId) {
        await deleteImage(publicId).catch(() => {});
      }
    }

    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.account.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    revalidatePath("/users");
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
  phone?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const phone = (input.phone ?? null)?.toString().trim() || null;

  if (!email.includes("@")) {
    return { ok: false as const, error: "Invalid email." };
  }
  if (!name) {
    return { ok: false as const, error: "Name is required." };
  }

  try {
    const user = await prisma.user.update({
      where: { id: input.id },
      data: { email, name, phone },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    // Keep foreman-linked employee profiles in sync with the user name
    if (user.role === "FOREMAN") {
      const parts = name.split(" ").filter((p) => p.trim().length > 0);
      const firstName = parts[0] || name;
      const lastName = parts.slice(1).join(" ");

      await prisma.employee.updateMany({
        where: { userId: user.id },
        data: {
          firstName,
          lastName,
        },
      });
    }

    revalidatePath("/users");
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

    revalidatePath("/users");
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
