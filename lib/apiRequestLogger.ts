const counters = new Map<string, number>();

export function logApiRequest(path: string, method: string, status: number) {
  const key = `${method.toUpperCase()} ${path}`;
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);

  // Structured log for Netlify / log aggregation
  console.log(
    JSON.stringify({
      type: "api-request",
      path,
      method: method.toUpperCase(),
      status,
      count: next,
    }),
  );
}
