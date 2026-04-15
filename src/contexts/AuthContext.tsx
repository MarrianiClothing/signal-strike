"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCache, setCache } from "@/lib/cache";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  initials: string;
  fullName: string;
  userId: string;
  ready: boolean; // true once first auth check completes
}

const AuthContext = createContext<AuthState>({
  user: null, session: null, initials: "?", fullName: "", userId: "", ready: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [state, setState] = useState<AuthState>(() => {
    // Hydrate from cache instantly — zero flicker
    const cached = getCache<{ initials: string; fullName: string; userId: string }>("profile");
    return {
      user: null, session: null,
      initials: cached?.initials ?? "?",
      fullName: cached?.fullName ?? "",
      userId: cached?.userId ?? "",
      ready: false,
    };
  });
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    async function init() {
      // getSession is synchronous from localStorage — near zero latency
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState(s => ({ ...s, ready: true }));
        return;
      }

      const user = session.user;
      const userId = user.id;

      // Set session + user immediately
      setState(s => ({ ...s, session, user, userId, ready: true }));

      // Load profile (check cache first)
      const cached = getCache<{ initials: string; fullName: string; userId: string }>("profile");
      if (cached && cached.userId === userId) {
        setState(s => ({ ...s, initials: cached.initials, fullName: cached.fullName }));
      }

      // Fetch fresh profile in background
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", userId).single();

      if (profile?.full_name) {
        const parts = profile.full_name.trim().split(" ");
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : parts[0].slice(0, 2).toUpperCase();
        const profileData = { initials, fullName: profile.full_name, userId };
        setCache("profile", profileData);
        setState(s => ({ ...s, initials, fullName: profile.full_name }));
      }
    }

    init();

    // Keep session in sync on tab focus / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(s => ({ ...s, session, user: session?.user ?? null, userId: session?.user?.id ?? "" }));
    });
    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
