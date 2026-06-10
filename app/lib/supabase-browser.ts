"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

let client: SupabaseClient | null | undefined;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createBrowserClient(url, key) : null;
  return client;
}

// Accounts ship dark: UI entry points render only when the flag is on
// AND Supabase env is present, so a half-configured deploy fails soft.
export function accountsEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED;
  return (flag === "1" || flag === "true") && getSupabaseBrowser() !== null;
}

export type AuthState = { user: User | null; loaded: boolean };

export function useSupabaseUser(): AuthState {
  // Loaded immediately when Supabase isn't configured; otherwise the
  // INITIAL_SESSION callback below flips it.
  const [state, setState] = useState<AuthState>(() => ({
    user: null,
    loaded: getSupabaseBrowser() === null,
  }));
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    // INITIAL_SESSION fires on subscribe with the restored session, so no
    // separate getSession() read is needed.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loaded: true });
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}
