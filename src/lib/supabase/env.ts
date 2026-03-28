/**
 * Public Supabase URL (NEXT_PUBLIC_SUPABASE_URL).
 */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Browser/public key: prefer legacy anon name; Supabase dashboard may show
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY instead.
 */
export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  );
}
