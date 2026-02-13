type ExpoPushMessage = {
  to: string;
  sound?: "default" | null;
  title: string;
  body: string;
  data?: Record<string, any>;
};

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const MAX_BATCH_SIZE = 100; // common Expo recommendation

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function sendExpoPush(
  tokens: string[],
  message: { title: string; body: string; data?: Record<string, any> },
): Promise<void> {
  const uniqueTokens = Array.from(
    new Set(tokens.map((t) => t.trim()).filter(Boolean)),
  );
  if (uniqueTokens.length === 0) return;

  const batches = chunkArray(uniqueTokens, MAX_BATCH_SIZE);

  for (const batch of batches) {
    const payload: ExpoPushMessage[] = batch.map((token) => ({
      to: token,
      sound: "default",
      title: message.title,
      body: message.body,
      data: message.data,
    }));

    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Expo push request failed", {
          status: res.status,
          statusText: res.statusText,
        });
        continue;
      }

      // Best-effort logging of Expo response; shape can be array or object
      const json: any = await res.json().catch(() => null);
      if (!json) continue;

      // Expo typically returns { data: [{ status, message, details? }, ...] }
      const dataArray: any[] = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
          ? json.data
          : [];

      dataArray.forEach((entry, index) => {
        if (entry?.status === "error") {
          console.error("Expo push ticket error", {
            token: batch[index],
            message: entry.message,
            details: entry.details,
          });
        }
      });
    } catch (error) {
      // Do not fail the business transaction; just log and continue
      console.error("Expo push network/error", { error });
    }
  }
}
