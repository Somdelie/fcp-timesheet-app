export function employeeWhereForUser(auth: {
  userId: string;
  role: "ADMIN" | "SUPERVISOR" | "FOREMAN";
}) {
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
                  endsOn: null, // only active links (optional)
                },
              },
            },
          },
        },
      },
    ],
  };
}
