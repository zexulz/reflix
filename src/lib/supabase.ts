import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
  Supabase Storage client for admin image uploads (poster/backdrop files).
  The database still uses Prisma + Postgres; this is only for object storage.

  Configure in .env:
    NEXT_PUBLIC_SUPABASE_URL   = your project URL, e.g. https://abcd.supabase.co
    SUPABASE_SERVICE_ROLE_KEY  = the service-role secret (server only, NEVER public)
    SUPABASE_STORAGE_BUCKET    = bucket name, e.g. "reflix"

  The service-role key bypasses RLS so the server can write uploaded files.
  Keep it secret — it's only ever used in API routes, never in the client.
*/

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cached;
}

export function getBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "reflix";
}
