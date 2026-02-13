export async function sendWhatsAppTextMessage(input: {
  toE164: string; // e.g. +27821234567
  body: string;
}) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token) throw new Error("Missing WHATSAPP_ACCESS_TOKEN");
  if (!phoneNumberId) throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID");

  // WhatsApp API expects digits only (no +)
  const to = input.toE164.replace(/[^\d]/g, "");
  if (!to) throw new Error("Invalid toE164");

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: input.body,
      },
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // Common error here: outside 24h window => template required
    const errMsg =
      json?.error?.message ||
      json?.error?.error_user_msg ||
      `WhatsApp send failed (${res.status})`;
    const errCode = json?.error?.code;
    throw new Error(`${errMsg}${errCode ? ` [code ${errCode}]` : ""}`);
  }

  return json;
}
