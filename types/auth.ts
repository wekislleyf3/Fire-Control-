export type Role = "admin" | "supervisor" | "tecnico" | "cliente";

/**
 * Perfil da tabela `profiles` (a criar via migration — ver
 * supabase/migration_profiles_empresas.sql). Até essa migration ser
 * aplicada, AuthContext expõe `profile: null` e o app continua
 * funcionando normalmente com apenas `user`.
 */
export type Profile = {
  id: string;
  user_id: string;
  empresa_id: string | null;
  nome: string | null;
  role: Role;
  created_at: string;
};

export type Empresa = {
  id: string;
  nome: string;
  created_at: string;
};
