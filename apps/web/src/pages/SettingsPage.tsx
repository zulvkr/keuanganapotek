import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ShieldCheck,
  Wallet,
  CheckCircle2,
  Database,
  Users,
  Shield,
  KeyRound,
  Lock,
  Plus,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  DEFAULT_ASSISTANT_ALLOWED_COA_CODES,
  SENSITIVE_COA_CODES,
  type AuthUser,
} from "@keuangan-apotek/shared";
import { getAccounts, getUsers, queryKeys } from "../lib/queries";
import {
  createUser,
  deleteUser,
  invalidateAccountingQueries,
  saveUserPermissions,
} from "../lib/mutations";
import { useAuth } from "../lib/auth";
import { toast } from "../lib/toast";
import ApiKeyManager from "../components/api-keys/ApiKeyManager";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [pharmacyName, setPharmacyName] = useState("Apotek Sehat Sejahtera");
  const [apotekerName, setApotekerName] = useState("apt. Ivan Zulfikar, S.Farm.");
  const [sipaNo, setSipaNo] = useState("19920101/SIPA_32.73/2024/2001");
  const [saved, setSaved] = useState(false);

  // Users query
  const usersQuery = useQuery({ queryKey: queryKeys.users, queryFn: getUsers });
  const usersList: AuthUser[] = usersQuery.data ?? [];

  // Accounts query
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const accounts = accountsQuery.data ?? [];
  const cashBankAccounts = accounts.filter((a) => a.code.startsWith("110"));

  // State for permissions modal
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<AuthUser | null>(null);
  const [tempAllowedCodes, setTempAllowedCodes] = useState<string[]>([]);

  // State for Add User modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "asisten">("asisten");

  // Mutations
  const permissionsMutation = useMutation({
    mutationFn: ({ userId, codes }: { userId: string; codes: string[] }) =>
      saveUserPermissions(userId, codes),
    onSuccess: () => {
      toast.success("Hak akses CoA berhasil diperbarui.");
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      invalidateAccountingQueries(queryClient);
      setSelectedUserForPerms(null);
    },
    onError: (err: Error) => {
      toast.error(`Gagal menyimpan hak akses: ${err.message}`);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: {
      username: string;
      password: string;
      name: string;
      role: "admin" | "asisten";
    }) => createUser(data),
    onSuccess: () => {
      toast.success("Pengguna baru berhasil ditambahkan.");
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      setShowAddUserModal(false);
      setNewUsername("");
      setNewPassword("");
      setNewName("");
      setNewRole("asisten");
    },
    onError: (err: Error) => {
      toast.error(`Gagal membuat pengguna: ${err.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      toast.success("Pengguna berhasil dihapus.");
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
    onError: (err: Error) => {
      toast.error(`Gagal menghapus pengguna: ${err.message}`);
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    toast.success("Pengaturan identitas berhasil disimpan.");
    setTimeout(() => setSaved(false), 3000);
  }

  function openPermissionsModal(user: AuthUser) {
    setSelectedUserForPerms(user);
    setTempAllowedCodes(user.allowedCoaCodes || []);
  }

  function toggleCode(code: string) {
    setTempAllowedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-white px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-slate-800">Pengaturan</h2>
          <span className="text-[11px] text-slate-400">|</span>
          <span className="text-[11px] text-slate-500">
            Identitas Apotek, RBAC & Hak Akses CoA, serta Status Arsitektur
          </span>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} /> Disimpan
          </span>
        )}
      </div>

      {/* RBAC & User Management Section */}
      <section className="border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-800">
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-brand" />
            <span>Manajemen Pengguna & Kontrol Akses CoA (RBAC)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowAddUserModal(true)}
              className="inline-flex items-center gap-1 rounded bg-brand px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700 transition"
            >
              <Plus size={12} /> Tambah Pengguna
            </button>
          </div>
        </div>

        <div className="p-2.5 space-y-2.5">
          {/* Active User Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <KeyRound size={14} className="text-brand" />
              <div>
                <span className="font-semibold text-slate-800">Pengguna Aktif: </span>
                <span className="font-bold text-brand">{currentUser?.name ?? "-"}</span>
                <span className="ml-1.5 rounded px-1.5 py-0.2 text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-700">
                  {currentUser?.role ?? "-"}
                </span>
                {currentUser?.username && (
                  <span className="ml-1 text-[11px] text-slate-500 font-mono">
                    (@{currentUser.username})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* User List Table */}
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-2.5 py-1.5 w-32">Username</th>
                  <th className="px-2.5 py-1.5">Nama Lengkap</th>
                  <th className="px-2.5 py-1.5 w-28">Role</th>
                  <th className="px-2.5 py-1.5">Cakupan Akses CoA</th>
                  <th className="px-2.5 py-1.5 w-40 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => {
                  const isAdmin = u.role === "admin";
                  const allowedCount = (u.allowedCoaCodes || []).length;
                  const isCurrent = currentUser?.username === u.username;

                  return (
                    <tr
                      key={u.id}
                      className={
                        isCurrent
                          ? "bg-blue-50/30 hover:bg-blue-50/50"
                          : "bg-white hover:bg-slate-50/60"
                      }
                    >
                      <td className="px-2.5 py-1.5 font-mono font-bold text-slate-800">
                        {u.username}
                      </td>
                      <td className="px-2.5 py-1.5 font-medium text-slate-800">
                        {u.name}
                        {isCurrent && (
                          <span className="ml-1.5 text-[10px] text-emerald-600 font-bold">
                            (Anda)
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            isAdmin
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          <Shield size={10} />
                          {isAdmin ? "Admin" : "Asisten"}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-600">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 font-semibold text-[11px]">
                            <Lock size={11} className="text-emerald-600" /> Semua CoA (Akses Penuh
                            Termasuk Gaji & Modal)
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {allowedCount} Akun CoA
                            </span>
                            <span className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.2 text-[10px] text-rose-700 font-medium">
                              Gaji & Sensitif Disembunyikan
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 text-right space-x-1.5">
                        {!isAdmin && (
                          <button
                            type="button"
                            onClick={() => openPermissionsModal(u)}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-blue-50 transition"
                          >
                            Atur Hak Akses CoA
                          </button>
                        )}
                        {u.username !== "admin" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Hapus pengguna ${u.username}?`)) {
                                deleteUserMutation.mutate(u.id);
                              }
                            }}
                            className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition inline-block align-middle"
                            title="Hapus Pengguna"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* API Key & AI Integration Section */}
      <ApiKeyManager />

      {/* Profile Form */}
      <section className="border border-slate-200 bg-white">
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">
          <Building2 size={13} className="text-brand" />
          <span>Identitas Apotek & Legalitas</span>
        </div>

        <form onSubmit={handleSave}>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                <td className="w-48 px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50/50">
                  Nama Apotek
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    className="h-6 w-full max-w-md rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                <td className="w-48 px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50/50">
                  Apoteker Pengelola (APA)
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={apotekerName}
                    onChange={(e) => setApotekerName(e.target.value)}
                    className="h-6 w-full max-w-md rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                <td className="w-48 px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50/50">
                  Nomor SIPA
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={sipaNo}
                    onChange={(e) => setSipaNo(e.target.value)}
                    className="h-6 w-full max-w-md rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-2 py-1">
            <button
              type="submit"
              className="h-6 rounded bg-brand px-3 py-0.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Simpan Identitas
            </button>
          </div>
        </form>
      </section>

      {/* 9 Cash & Bank Accounts Status Table */}
      <section className="border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">
          <div className="flex items-center gap-1.5">
            <Wallet size={13} className="text-brand" />
            <span>9 Akun Kas & Setara Kas Terdaftar</span>
          </div>
          <span className="text-[11px] font-normal text-slate-500">
            Dipantau running balance-nya di Buku Transaksi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-2 py-1 w-24">Kode Akun</th>
                <th className="px-2 py-1">Nama Akun</th>
                <th className="px-2 py-1 w-32">Klasifikasi</th>
                <th className="px-2 py-1 w-28 text-center">Sensitivitas</th>
              </tr>
            </thead>
            <tbody>
              {cashBankAccounts.map((account, index) => {
                const isSensitive = (SENSITIVE_COA_CODES as readonly string[]).includes(
                  account.code,
                );
                return (
                  <tr
                    key={account.id}
                    className={
                      (index % 2 ? "bg-slate-50/60" : "bg-white") +
                      " hover:bg-blue-50/40 border-b border-slate-100"
                    }
                  >
                    <td className="px-2 py-1 font-mono font-bold tabular-nums text-brand">
                      {account.code}
                    </td>
                    <td className="px-2 py-1 font-medium text-slate-800">{account.name}</td>
                    <td className="px-2 py-1 text-[11px] text-slate-500">
                      {account.classification || "ASET_LANCAR"}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {isSensitive ? (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                          Sensitif (Gaji)
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Operasional
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* System Engine Status Table */}
      <section className="border border-slate-200 bg-white">
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">
          <Database size={13} className="text-brand" />
          <span>Status Sistem & Arsitektur RBAC</span>
        </div>

        <table className="w-full text-xs">
          <tbody>
            <tr className="border-b border-slate-100 hover:bg-slate-50/60">
              <td className="w-48 px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50/50">
                Sistem RBAC
              </td>
              <td className="px-2 py-1">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                  <ShieldCheck size={13} /> Role Admin & Asisten dengan Whitelist CoA Berjenjang
                </span>
              </td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-50/60">
              <td className="w-48 px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50/50">
                Penyembunyian Transaksi Sensitif
              </td>
              <td className="px-2 py-1 text-slate-800">
                Akun Beban Gaji (6102) & Saving Gaji (1108) otomatis terisolasi dari asisten
              </td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-50/60">
              <td className="w-48 px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50/50">
                Mesin Jurnal
              </td>
              <td className="px-2 py-1">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                  <ShieldCheck size={13} /> Double-Entry Multibaris Otomatis (Aktif)
                </span>
              </td>
            </tr>
            <tr className="hover:bg-slate-50/60">
              <td className="w-48 px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50/50">
                Tipe Database
              </td>
              <td className="px-2 py-1 text-slate-800">SQLite + WAL Mode (Better-SQLite3)</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* MODAL: Edit CoA Permissions for Assistant */}
      {selectedUserForPerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-brand" />
                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Konfigurasi Hak Akses CoA untuk {selectedUserForPerms.name}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Pilih akun-akun CoA yang diizinkan untuk diinput dan dilihat oleh asisten ini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForPerms(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-slate-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Aksi Cepat:</span>
                <button
                  type="button"
                  onClick={() => setTempAllowedCodes(DEFAULT_ASSISTANT_ALLOWED_COA_CODES)}
                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  Pilih Standar Operasional (Non-Gaji)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTempAllowedCodes(accounts.filter((a) => !a.isGroup).map((a) => a.code))
                  }
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={() => setTempAllowedCodes([])}
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Kosongkan
                </button>
              </div>
              <span className="font-bold text-brand">{tempAllowedCodes.length} Akun Dipilih</span>
            </div>

            <div className="p-3 overflow-y-auto flex-1 space-y-3">
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong>Perhatian Privasi:</strong> Akun bertanda{" "}
                  <span className="font-bold text-rose-700 bg-rose-100 px-1 rounded">
                    Sensitif (Gaji)
                  </span>{" "}
                  seperti <strong>6102 Beban gaji</strong> dan <strong>1108 Saving Gaji</strong>{" "}
                  sebaiknya TIDAK dicentang agar transaksi nominal gaji dan saldo simpanan gaji
                  tidak terlihat oleh asisten.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {accounts
                  .filter((a) => !a.isGroup)
                  .map((acc) => {
                    const isChecked = tempAllowedCodes.includes(acc.code);
                    const isSensitive = (SENSITIVE_COA_CODES as readonly string[]).includes(
                      acc.code,
                    );

                    return (
                      <label
                        key={acc.id}
                        className={`flex items-start gap-2 p-1.5 rounded border transition cursor-pointer ${
                          isChecked
                            ? isSensitive
                              ? "bg-rose-50/60 border-rose-300"
                              : "bg-blue-50/40 border-blue-200"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCode(acc.code)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800">{acc.code}</span>
                            <span className="font-medium text-slate-800 truncate">{acc.name}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-slate-500">{acc.classification}</span>
                            {isSensitive && (
                              <span className="rounded bg-rose-100 px-1 py-0.2 text-[9px] font-bold text-rose-800">
                                Sensitif
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-[11px] text-slate-500">
                Perubahan langsung berlaku untuk transaksi asisten ini.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPerms(null)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    permissionsMutation.mutate({
                      userId: selectedUserForPerms.id,
                      codes: tempAllowedCodes,
                    })
                  }
                  disabled={permissionsMutation.isPending}
                  className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  {permissionsMutation.isPending ? "Menyimpan..." : "Simpan Hak Akses"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Users size={16} className="text-brand" />
                <h3 className="text-xs font-bold text-slate-800">Tambah Pengguna Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newUsername || !newPassword || !newName) {
                  toast.error("Semua field wajib diisi");
                  return;
                }
                createUserMutation.mutate({
                  username: newUsername,
                  password: newPassword,
                  name: newName,
                  role: newRole,
                });
              }}
              className="p-3 space-y-2.5 text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="contoh: kasir_siti"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="contoh: Siti Rahmawati"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 4 karakter"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Role Akses
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "admin" | "asisten")}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-white"
                >
                  <option value="asisten">Asisten (Hanya CoA Operasional, Gaji Tersembunyi)</option>
                  <option value="admin">Admin (Akses Penuh Seluruh Laporan & Akun)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  {createUserMutation.isPending ? "Menyimpan..." : "Tambah Pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
