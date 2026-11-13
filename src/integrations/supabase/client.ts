// Rebuild copy: this app is disconnected from Supabase.
// `supabase` is always the in-memory mock from src/lib/platformMock.ts, so no
// query, auth call, function call or realtime channel leaves the browser.
// There is no project URL and no key in this repository.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createPlatformMockClient } from "@/lib/platformMock";
import { DISCONNECTED_BACKEND } from "@/lib/backendDisconnected";

/** Kept for code that builds function URLs. It points at a host that never resolves. */
export const SUPABASE_URL = DISCONNECTED_BACKEND;
export const SUPABASE_PUBLISHABLE_KEY = "disconnected";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createPlatformMockClient() as unknown as SupabaseClient<Database>;
