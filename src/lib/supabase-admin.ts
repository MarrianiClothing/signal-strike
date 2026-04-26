/**
 * Signal Strike — Server-only Supabase admin client.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY which has god-mode access to your
 * project (bypasses Row-Level Security). NEVER import from a client
 * component or expose this key to the browser.
 *
 * Use cases:
 *   - Webhook handlers (creating users, writing subscription rows)
 *   - Server-side reconciliation jobs
 *   - Admin endpoints
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set in environment");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in environment");
}

const globalForAdmin = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

export const supabaseAdmin =
  globalForAdmin.supabaseAdmin ??
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

if (process.env.NODE_ENV !== "production") {
  globalForAdmin.supabaseAdmin = supabaseAdmin;
}
