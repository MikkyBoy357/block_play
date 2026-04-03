"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/utils/supabase/client";
import type { SubscriptionTier } from "@/lib/game-data";

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  subscription_tier: SubscriptionTier | null;
  subscription_expires_at: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateAvatar: (avatarUrl: string) => Promise<{ error?: string }>;
  updateProfile: (data: { username?: string; display_name?: string; bio?: string; avatar_url?: string }) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));

    // Listen for auth state changes
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        refreshUser();
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshUser]);

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      return {};
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      await refreshUser();
      return {};
    },
    [refreshUser]
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const updateAvatar = useCallback(
    async (avatarUrl: string) => {
      const res = await fetch("/api/auth/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      await refreshUser();
      return {};
    },
    [refreshUser]
  );

  const updateProfile = useCallback(
    async (profileData: { username?: string; display_name?: string; bio?: string; avatar_url?: string }) => {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      await refreshUser();
      return {};
    },
    [refreshUser]
  );

  return (
    <AuthContext.Provider
      value={{ user, isLoading, signUp, signIn, signOut, refreshUser, updateAvatar, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
