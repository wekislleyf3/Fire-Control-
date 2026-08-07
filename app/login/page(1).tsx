"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError("E-mail ou senha inválidos.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-ink">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg p-8 w-full max-w-sm shadow-xl"
      >
        <p className="font-display text-3xl text-center mb-1">
          FIRECONTROL <span className="text-brand-red">OS</span>
        </p>
        <p className="text-center text-sm text-brand-slate mb-6">Acesso restrito</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2 mb-4">
            {error}
          </div>
        )}

        <label className="text-sm text-brand-slate">E-mail</label>
        <input
          required
          type="email"
          className="border rounded-md px-3 py-2 text-sm w-full mt-1 mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="text-sm text-brand-slate">Senha</label>
        <input
          required
          type="password"
          className="border rounded-md px-3 py-2 text-sm w-full mt-1 mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          disabled={loading}
          className="w-full bg-brand-red text-white text-sm py-2 rounded-md hover:bg-brand-redDark transition disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
