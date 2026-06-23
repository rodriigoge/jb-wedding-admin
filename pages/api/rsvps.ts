import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { RsvpConfirmationRow } from "@/types/rsvp";

type RsvpsResponse =
  | {
      ok: true;
      rows: RsvpConfirmationRow[];
    }
  | {
      ok: true;
      deletedId: string;
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

async function getAuthorizedAdmin(req: NextApiRequest) {
  const token = getBearerToken(req);

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      message: "Sessão não encontrada.",
    };
  }

  const supabase = getSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user?.email) {
    return {
      ok: false as const,
      status: 401,
      message: "Sessão inválida ou expirada.",
    };
  }

  const email = userData.user.email;
  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (adminError) {
    return {
      ok: false as const,
      status: 500,
      message: adminError.message,
    };
  }

  if (!adminUser) {
    return {
      ok: false as const,
      status: 403,
      message: `O e-mail ${email} não está autorizado na tabela admin_users.`,
    };
  }

  return {
    ok: true as const,
    supabase,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<RsvpsResponse>) {
  if (req.method !== "GET" && req.method !== "DELETE") {
    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ ok: false, message: "Método não permitido." });
  }

  try {
    const admin = await getAuthorizedAdmin(req);

    if (!admin.ok) {
      return res.status(admin.status).json({ ok: false, message: admin.message });
    }

    const { supabase } = admin;

    if (req.method === "DELETE") {
      const id = typeof req.query.id === "string" ? req.query.id : "";

      if (!id) {
        return res.status(400).json({ ok: false, message: "Informe o id do registro." });
      }

      const { error } = await supabase.from("rsvp_confirmations").delete().eq("id", id);

      if (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }

      return res.status(200).json({ ok: true, deletedId: id });
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
