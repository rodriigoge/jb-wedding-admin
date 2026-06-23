import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

export function getSupabaseServerClient() {
  if (!supabaseUrl) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL no arquivo .env.local.");
  }

  if (!supabaseSecretKey) {
    throw new Error("Configure SUPABASE_SECRET_KEY no arquivo .env.local.");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
