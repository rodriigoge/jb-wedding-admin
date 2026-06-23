import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { RsvpConfirmationRow } from "@/types/rsvp";

type RsvpsResponse =
  | {
      ok: true;
      rows: RsvpConfirmationRow[];
    }
  | {
      ok: false;
      message: string;
    };

function getBearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<RsvpsResponse>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "Método não permitido." });
  }

  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ ok: false, message: "Sessão não encontrada." });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user?.email) {
      return res.status(401).json({ ok: false, message: "Sessão inválida ou expirada." });
    }

    const email = userData.user.email;
    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (adminError) {
      return res.status(500).json({ ok: false, message: adminError.message });
    }

    if (!adminUser) {
      return res.status(403).json({
        ok: false,
        message: `O e-mail ${email} não está autorizado na tabela admin_users.`,
      });
    }

    const { data, error } = await supabase
      .from("rsvp_confirmations")
      .select("id,name,phone,companions,status,notes,total_people,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }

    return res.status(200).json({ ok: true, rows: (data ?? []) as RsvpConfirmationRow[] });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível carregar as confirmações.",
    });
  }
}
