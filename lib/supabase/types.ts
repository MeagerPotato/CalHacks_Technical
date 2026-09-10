import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/** Supabase client typed with the generated database schema. */
export type TypedSupabaseClient = SupabaseClient<Database>;
