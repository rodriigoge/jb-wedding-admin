import type { NextApiRequest, NextApiResponse } from "next";

type NotifyResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    };

type RsvpNotificationPayload = {
  name?: string;
  phone?: string;
  companions?: number;
  status?: "confirmed" | "declined" | "pending";
  notes?: string | null;
  adultNames?: string;
  childNames?: string;
  message?: string;
};

const defaultRecipient = "5535992046991";

function getSectionValue(notes: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = notes.match(new RegExp(`${escapedLabel}:\\s*([\\s\\S]*?)(?=\\n\\n[A-Za-zÀ-ÿ]+:|$)`, "i"));

  return match?.[1]?.trim() || "";
}

function normalizePayload(body: unknown): RsvpNotificationPayload {
  const input = body as { record?: RsvpNotificationPayload } & RsvpNotificationPayload;
  const payload = input.record ?? input;
  const notes = payload.notes ?? "";

  return {
    ...payload,
    adultNames: payload.adultNames || getSectionValue(notes, "Adultos"),
    childNames: payload.childNames || getSectionValue(notes, "Crianças"),
    message: payload.message || getSectionValue(notes, "Mensagem") || notes || "",
  };
}

function setCorsHeaders(req: NextApiRequest, res: NextApiResponse) {
  const allowedOrigin = process.env.LANDING_ORIGIN;

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-webhook-secret");
}

function validateWebhookSecret(req: NextApiRequest) {
  const expectedSecret = process.env.NOTIFICATION_WEBHOOK_SECRET;

  if (!expectedSecret) {
    return false;
  }

  return req.headers["x-webhook-secret"] === expectedSecret;
}

function formatPresenceStatus(status?: RsvpNotificationPayload["status"]) {
  if (status === "declined") {
    return "Não poderá comparecer";
  }

  if (status === "pending") {
    return "Pendente";
  }

  return "Confirmada";
}

function buildMessage(payload: RsvpNotificationPayload) {
  const totalPeople = payload.status === "confirmed" ? Number(payload.companions ?? 0) + 1 : 0;
  const lines = [
    "Nova confirmação de presença no casamento J&B",
    "",
    `Status: ${formatPresenceStatus(payload.status)}`,
    `Convidado responsável: ${payload.name || "-"}`,
    `Telefone: ${payload.phone || "-"}`,
    `Total de pessoas: ${totalPeople || "-"}`,
    "",
    `Adultos: ${payload.adultNames || "-"}`,
    `Crianças: ${payload.childNames || "-"}`,
    `Mensagem: ${payload.message || "-"}`,
  ];

  return lines.join("\n");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<NotifyResponse>) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ ok: false, message: "Método não permitido." });
  }

  if (!validateWebhookSecret(req)) {
    return res.status(401).json({ ok: false, message: "Webhook não autorizado ou sem secret configurado." });
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipient = process.env.WHATSAPP_TO ?? defaultRecipient;
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v20.0";

  if (!phoneNumberId || !accessToken) {
    return res.status(500).json({
      ok: false,
      message: "Configure WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN no ambiente.",
    });
  }

  const payload = normalizePayload(req.body);
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: {
        preview_url: false,
        body: buildMessage(payload),
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return res.status(response.status).json({
      ok: false,
      message: errorText || "Não foi possível enviar a notificação do WhatsApp.",
    });
  }

  return res.status(200).json({ ok: true });
}
