import { useState } from "react";
import {
  Building2,
  ShieldCheck,
  User,
  Lock,
  KeyRound,
  AlertCircle,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { LoginResponse, SetupInput } from "@keuangan-apotek/shared";
import { requestJson } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "../lib/toast";

interface SetupWizardPageProps {
  onSetupSuccess?: () => void;
}

export default function SetupWizardPage({ onSetupSuccess }: SetupWizardPageProps) {
  const { setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [pharmacyName, setPharmacyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [createAssistant, setCreateAssistant] = useState(true);
  const [assistantName, setAssistantName] = useState("Asisten Kasir");
  const [assistantUsername, setAssistantUsername] = useState("asisten");
  const [assistantPassword, setAssistantPassword] = useState("asisten123");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedAdminName = adminName.trim();
    const trimmedAdminUser = adminUsername.trim();

    if (!trimmedAdminName) {
      setErrorMessage("Nama lengkap Administrator wajib diisi.");
      return;
    }
    if (!trimmedAdminUser || trimmedAdminUser.length < 3) {
      setErrorMessage("Username Admin minimal 3 karakter.");
      return;
    }
    if (!adminPassword || adminPassword.length < 4) {
      setErrorMessage("Password Admin minimal 4 karakter.");
      return;
    }
    if (adminPassword !== confirmPassword) {
      setErrorMessage("Password dan Konfirmasi Password Admin tidak cocok.");
      return;
    }

    if (createAssistant) {
      if (!assistantName.trim()) {
        setErrorMessage("Nama Asisten wajib diisi jika opsi aktif.");
        return;
      }
      if (!assistantUsername.trim() || assistantUsername.trim().length < 3) {
        setErrorMessage("Username Asisten minimal 3 karakter.");
        return;
      }
      if (!assistantPassword || assistantPassword.length < 4) {
        setErrorMessage("Password Asisten minimal 4 karakter.");
        return;
      }
    }

    const payload: SetupInput = {
      pharmacyName: pharmacyName.trim() || undefined,
      admin: {
        name: trimmedAdminName,
        username: trimmedAdminUser,
        password: adminPassword,
      },
      createAssistant,
      assistant: createAssistant
        ? {
            name: assistantName.trim(),
            username: assistantUsername.trim(),
            password: assistantPassword,
          }
        : undefined,
    };

    setIsLoading(true);
    try {
      const res = await requestJson<LoginResponse>("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      localStorage.setItem("ka_auth_token", res.token);
      localStorage.setItem("ka_auth_user", JSON.stringify(res.user));
      setUser(res.user);

      toast.success("Inisialisasi sistem berhasil! Selamat datang di Keuangan Apotek.");
      onSetupSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyelesaikan inisialisasi";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 text-slate-800">
      <div className="w-full max-w-lg space-y-4">
        {/* Header / Brand */}
        <div className="text-center space-y-1">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg ring-4 ring-blue-100">
            <Building2 size={28} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center justify-center gap-1.5">
            <span>Keuangan Apotek</span>
            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-brand">
              <Sparkles size={11} /> Setup Wizard
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Inisialisasi sistem — buat akun administrator pertama Anda
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Identitas Apotek */}
            <div className="space-y-2">
              <label
                htmlFor="setup-pharmacy-name"
                className="block text-xs font-semibold text-slate-700"
              >
                Nama Apotek / Cabang (Opsional)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                  <Building2 size={14} />
                </span>
                <input
                  id="setup-pharmacy-name"
                  type="text"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  placeholder="Contoh: Apotek Sehat Cabang 1"
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            {/* Section 2: Akun Administrator */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <ShieldCheck size={14} className="text-brand" />
                <span>Akun Administrator (Owner / Apoteker)</span>
              </div>

              <div>
                <label
                  htmlFor="setup-admin-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Nama Lengkap Pemilik / Apoteker <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                    <User size={14} />
                  </span>
                  <input
                    id="setup-admin-name"
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Contoh: Apt. Budi Santoso"
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="setup-admin-username"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Username Admin <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="setup-admin-username"
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div>
                  <label
                    htmlFor="setup-admin-password"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Password Admin <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                      <Lock size={14} />
                    </span>
                    <input
                      id="setup-admin-password"
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Minimal 4 karakter"
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="setup-confirm-password"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Konfirmasi Password Admin <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                    <KeyRound size={14} />
                  </span>
                  <input
                    id="setup-confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password admin"
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Akun Asisten (Opsional) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createAssistant}
                  onChange={(e) => setCreateAssistant(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-emerald-600" />
                  Buat akun Asisten Kasir sekaligus sekarang
                </span>
              </label>

              {createAssistant && (
                <div className="space-y-2.5 pt-1 border-t border-slate-200/60">
                  <div>
                    <label
                      htmlFor="setup-asisten-name"
                      className="block text-[11px] font-medium text-slate-600 mb-1"
                    >
                      Nama Asisten / Kasir
                    </label>
                    <input
                      id="setup-asisten-name"
                      type="text"
                      value={assistantName}
                      onChange={(e) => setAssistantName(e.target.value)}
                      placeholder="Asisten Kasir"
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-800 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="setup-asisten-username"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Username Asisten
                      </label>
                      <input
                        id="setup-asisten-username"
                        type="text"
                        value={assistantUsername}
                        onChange={(e) => setAssistantUsername(e.target.value)}
                        placeholder="asisten"
                        className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-800 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="setup-asisten-password"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Password Asisten
                      </label>
                      <input
                        id="setup-asisten-password"
                        type="password"
                        value={assistantPassword}
                        onChange={(e) => setAssistantPassword(e.target.value)}
                        placeholder="Minimal 4 karakter"
                        className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-800 outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Menginisialisasi Sistem...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>Selesaikan Setup & Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400">
          Sistem Akuntansi Keuangan Apotek © 2026
        </p>
      </div>
    </div>
  );
}
