import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase Admin Client.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to interact with tables where RLS is enabled
 * with NO public policies. This key is strictly server-side and MUST NEVER
 * be exposed to the browser or use a NEXT_PUBLIC_ prefix.
 */

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key || key.startsWith("your-") || url.startsWith("your-")) {
    return null;
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedAdminClient;
}

/**
 * Validates whether a string is a valid v4 UUID.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string | null | undefined): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Extracts and validates the device ID from standard request headers or an optional body payload.
 */
export function extractDeviceId(request: Request, bodyDeviceId?: string | null): string | null {
  if (bodyDeviceId && isValidUUID(bodyDeviceId)) {
    return bodyDeviceId.trim().toLowerCase();
  }
  const headerVal = request.headers.get("x-device-id");
  if (headerVal && isValidUUID(headerVal)) {
    return headerVal.trim().toLowerCase();
  }
  return null;
}
