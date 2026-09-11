import { describe, expect, it } from "vitest";

import { deleteAccountsByDomain, requireLocal, requireLocalDatabase } from "../support/local-supabase";

// The integration and end-to-end harnesses create and delete real accounts, so their guards must refuse anything but
// a local Supabase stack. None of these tests opens a connection.

describe("requireLocal", () => {
  it("accepts local API URLs", () => {
    for (const url of ["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"]) {
      expect(requireLocal(url, "Supabase API URL")).toBe(url);
    }
  });

  it("refuses a missing or remote URL", () => {
    expect(() => requireLocal(undefined, "Supabase API URL")).toThrow(/Missing Supabase API URL/);
    expect(() => requireLocal("https://abcdefghijkl.supabase.co", "Supabase API URL")).toThrow(/local Supabase stack/);
  });
});

describe("requireLocalDatabase", () => {
  it("accepts the local database URL", () => {
    const url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
    expect(requireLocalDatabase(url, "database URL")).toBe(url);
  });

  it("refuses a remote authority", () => {
    expect(() => requireLocalDatabase("postgresql://u:p@db.example.com:5432/postgres", "database URL")).toThrow(
      /local Supabase stack/,
    );
  });

  it("refuses a local authority whose host query parameter points node-postgres elsewhere", () => {
    expect(() =>
      requireLocalDatabase("postgresql://u:p@127.0.0.1:5432/postgres?host=db.example.com", "database URL"),
    ).toThrow(/got host "db\.example\.com"/);
  });

  it("guards account cleanup before any connection is made", async () => {
    await expect(
      deleteAccountsByDomain("postgresql://u:p@127.0.0.1:5432/postgres?host=db.example.com", "launchpad.test"),
    ).rejects.toThrow(/local Supabase stack/);
  });
});
