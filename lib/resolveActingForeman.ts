import { prisma } from "./prisma";

/**
 * Resolve whether a user is a real foreman or an assistant acting on behalf of a foreman.
 *
 * @param userId - The user ID from JWT payload
 * @param forForemanId - Optional foreman ID to act on behalf of (required if assistant has multiple links)
 * @returns Object with resolution status and details
 */
export async function resolveActingForeman(
  userId: string,
  forForemanId?: string | null,
) {
  const now = new Date();

  // 1) Check if user is a real foreman
  const realForeman = await prisma.foreman.findUnique({
    where: { userId },
    select: { id: true },
  });

  // 2) Check if user is an employee (needed for assistant check)
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  // 3) If forForemanId is explicitly provided, honor it if authorized
  if (forForemanId) {
    // Case A: User is a foreman and forForemanId matches their own ID
    if (realForeman && realForeman.id === forForemanId) {
      return {
        ok: true,
        mode: "FOREMAN" as const,
        foremanId: realForeman.id,
      };
    }

    // Case B: Check if user is an assistant to the requested foreman
    if (employee) {
      const link = await prisma.foremanAssistant.findUnique({
        where: {
          foremanId_employeeId: {
            foremanId: forForemanId,
            employeeId: employee.id,
          },
        },
        select: { startsOn: true, endsOn: true },
      });

      if (link) {
        const isActive =
          link.startsOn <= now && (!link.endsOn || link.endsOn > now);

        if (isActive) {
          return {
            ok: true,
            mode: "ASSISTANT" as const,
            foremanId: forForemanId,
            assistantEmployeeId: employee.id,
          };
        }
      }
    }

    // forForemanId provided but user is not authorized for it
    return {
      ok: false,
      status: 403,
      error: "Not authorized to act for this foreman",
    };
  }

  // 4) No forForemanId provided - use own foreman if available
  if (realForeman) {
    return {
      ok: true,
      mode: "FOREMAN" as const,
      foremanId: realForeman.id,
    };
  }

  if (!employee) {
    // User is neither foreman nor employee assistant
    return {
      ok: false,
      status: 403,
      error: "Not authorized to perform this action",
    };
  }

  // 5) User is employee only - find active assistant links
  const activeLinks = await prisma.foremanAssistant.findMany({
    where: {
      employeeId: employee.id,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { foremanId: true },
  });

  if (activeLinks.length === 0) {
    return {
      ok: false,
      status: 403,
      error: "No active foreman links found",
    };
  }

  if (activeLinks.length > 1) {
    return {
      ok: false,
      status: 400,
      error: "forForemanId required - assistant has multiple foreman links",
    };
  }

  // Exactly 1 link - use it
  const singleLink = activeLinks[0];
  return {
    ok: true,
    mode: "ASSISTANT" as const,
    foremanId: singleLink.foremanId,
    assistantEmployeeId: employee.id,
  };
}
