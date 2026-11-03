/**
 * Supabase server-only database client.
 * Uses SUPABASE_SERVICE_ROLE_KEY exclusively on the server side.
 * Never imported or bundled into client components.
 */
import { requireServerEnv } from "@/lib/env";

export function getSupabaseConfig(): { url: string; serviceRoleKey: string } {
  return {
    url: requireServerEnv("SUPABASE_URL", "supabase"),
    serviceRoleKey: requireServerEnv("SUPABASE_SERVICE_ROLE_KEY", "supabase"),
  };
}
