"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { useSupabase } from "@/hooks/useSupabase";
import type { Profile, Role } from "@/types/auth";

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** true quando `role` do usuário estiver em `roles` (sempre true se profiles ainda não existir). */
  hasRole: (...roles: Role[]) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    setUser(currentUser);

    if (currentUser) {
      // A tabela "profiles" ainda não existe no schema atual (ver
      // supabase/migration_profiles_empresas.sql). Enquanto ela não for
      // aplicada, este select falha silenciosamente e profile fica null —
      // o app continua funcionando normalmente sem multiempresa/permissões.
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (!error) setProfile((data as Profile) ?? null);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());
    return () => subscription.unsubscribe();
  }, [load, supabase]);

  const hasRole = useCallback(
    (...roles: Role[]) => {
      // Sem tabela profiles ainda: não bloqueia ninguém.
      if (!profile) return true;
      return roles.includes(profile.role);
    },
    [profile]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, hasRole, signOut, refresh: load }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa ser usado dentro de <AuthProvider>");
  return ctx;
}
