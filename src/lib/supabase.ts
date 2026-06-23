import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || supabaseUrl.includes("COLE_AQUI")) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL no arquivo .env.local.");
  }

  if (!supabasePublishableKey) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local.");
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublishableKey);
  }

  return browserClient;
}
