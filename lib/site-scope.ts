// lib/site-scope.ts
export type ScopeAuth = {
  userId: string;
  role: "ADMIN" | "OFFICE" | "SUPERVISOR" | "FOREMAN";
};

export function siteWhereFor(auth: ScopeAuth) {
  if (auth.role === "ADMIN" || auth.role === "OFFICE") return {};

  if (auth.role === "SUPERVISOR") {
    return {
      supervisorAssignments: {
        some: {
          supervisor: { userId: auth.userId },
          endsOn: null,
        },
      },
    };
  }

  // FOREMAN
  return {
    foremanAssignments: {
      some: {
        foreman: { userId: auth.userId },
        endsOn: null,
      },
    },
  };
}

export function foremanWhereFor(auth: ScopeAuth) {
  if (auth.role === "ADMIN" || auth.role === "OFFICE") return {};

  if (auth.role === "SUPERVISOR") {
    return {
      supervisorLinks: {
        some: {
          supervisor: { userId: auth.userId },
          endsOn: null,
        },
      },
    };
  }

  // FOREMAN can only see themself
  return { userId: auth.userId };
}
