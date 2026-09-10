import { vi } from "vitest";

// Server Actions and the data access layer call createClient() from "@/lib/supabase/server",
// which reads Next.js request cookies. Integration tests route it to a real Supabase client
// signed in as the test user, so every query still goes through Supabase Auth, grants, and RLS.
vi.mock("@/lib/supabase/server", async () => {
  const { getActionClient } = await import("./shared");
  return { createClient: async () => getActionClient() };
});

// Cache revalidation needs a Next.js request store; it has no effect on data correctness.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
}));
