import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readStringEnv } from "@/lib/env";

let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient() {
  const supabaseUrl = readStringEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readStringEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return supabaseAdminClient;
}

export function getRequiredSupabaseAdminClient() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase configuration.");
  }

  return supabase;
}
