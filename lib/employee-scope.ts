import { ServerAuthUser } from "./auth-server";

export function employeeWhereFor(auth: ServerAuthUser) {
  if (auth.role === "ADMIN") return {};

  if (auth.role === "FOREMAN") {
    return {
      OR: [
        { createdByUserId: auth.userId },
        {
          foremanLinks: {
            some: {
              foreman: { userId: auth.userId },
            },
          },
        },
      ],
    };
  }

  // SUPERVISOR
  return {
    OR: [
      { createdByUserId: auth.userId },
      {
        foremanLinks: {
          some: {
            foreman: {
              supervisorLinks: {
                some: {
                  supervisor: { userId: auth.userId },
                  endsOn: null, // only active supervisor<->foreman links
                },
              },
            },
          },
        },
      },
    ],
  };
}
