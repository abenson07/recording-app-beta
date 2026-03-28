"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

/**
 * Ensures an anonymous Supabase session exists (same behavior as the record screen)
 * and exposes readiness for data fetches.
 */
export function useRecordingSession() {
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setReady(!!session);
      if (session) setAuthError(null);
    });

    let cancelled = false;

    (async () => {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        if (!cancelled) setReady(true);
        return;
      }

      const { error } = await supabase.auth.signInAnonymously();
      if (cancelled) return;

      if (error) {
        setAuthError(
          error.message.includes("Anonymous sign-ins are disabled")
            ? "Turn on Anonymous sign-ins under Supabase → Authentication → Providers, then refresh."
            : error.message,
        );
        setReady(false);
        return;
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { ready, authError };
}
