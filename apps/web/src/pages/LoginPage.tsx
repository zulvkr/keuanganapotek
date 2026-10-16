import { useState } from "react";
import { Lock, User, AlertCircle, KeyRound, Building2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { toast } from "../lib/toast";

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMessage("Silakan masukkan username dan password.");
      return;
    }

    try {
      await login(trimmedUser, password);
      toast.success("Login berhasil");
      onLoginSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Username atau password salah";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 text-slate-800">
      <div className="w-full max-w-sm space-y-4">
        {/* Header / Brand */}
        <div className="text-center space-y-1">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white shadow-md">
            <Building2 size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Keuangan Apotek</h1>
          <p className="text-xs text-slate-500">Terminal Pembukuan & Laporan Keuangan</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 text-center">
            <h2 className="text-sm font-semibold text-slate-800">Masuk ke Akun</h2>
            <p className="text-xs text-slate-500">Gunakan akun Apotek Anda untuk melanjutkan</p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                  <User size={14} />
                </span>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                  <Lock size={14} />
                </span>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <KeyRound size={14} />
                  <span>Masuk</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400">
          Sistem Akuntansi Keuangan Apotek © 2026
        </p>
      </div>
    </div>
  );
}
