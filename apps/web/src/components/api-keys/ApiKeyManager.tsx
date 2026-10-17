import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  Code2,
  Bot,
  X,
  ShieldCheck,
} from "lucide-react";
import type { ApiKeyItem } from "@keuangan-apotek/shared";
import { getApiKeys, queryKeys } from "../../lib/queries";
import { createApiKey, revokeApiKey } from "../../lib/mutations";
import { toast } from "../../lib/toast";

export default function ApiKeyManager() {
  const queryClient = useQueryClient();

  const apiKeysQuery = useQuery({
    queryKey: queryKeys.apiKeys,
    queryFn: getApiKeys,
  });

  const apiKeys: ApiKeyItem[] = apiKeysQuery.data ?? [];

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiresAt, setNewKeyExpiresAt] = useState("");

  // Reveal modal state (after key is created)
  const [revealedKey, setRevealedKey] = useState<{
    name: string;
    key: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { name: string; expiresAt?: string | null }) => createApiKey(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
      setShowCreateModal(false);
      setNewKeyName("");
      setNewKeyExpiresAt("");
      setRevealedKey({ name: data.name, key: data.key });
      setCopied(false);
      toast.success("API Key baru berhasil dibuat.");
    },
    onError: (err: Error) => {
      toast.error(`Gagal membuat API Key: ${err.message}`);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
      toast.success("API Key berhasil dicabut.");
    },
    onError: (err: Error) => {
      toast.error(`Gagal mencabut API Key: ${err.message}`);
    },
  });

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("API Key berhasil disalin ke clipboard!");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <section className="border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-800">
        <div className="flex items-center gap-1.5">
          <KeyRound size={14} className="text-brand" />
          <span>Manajemen API Key & Integrasi AI / Pengembang</span>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1 rounded bg-brand px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700 transition"
        >
          <Plus size={12} /> Buat API Key Baru
        </button>
      </div>

      <div className="p-2.5 space-y-3">
        {/* Deskripsi & Panduan Ringkas */}
        <div className="flex flex-col md:flex-row gap-2.5 justify-between rounded border border-blue-100 bg-blue-50/50 p-2.5 text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-brand" />
              <span>Akses Aman untuk Sistem Eksternal & Model AI</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed max-w-2xl">
              API Key memungkinkan sistem kasir/POS eksternal, skrip otomasi, serta agen AI (seperti
              Claude Desktop, Antigravity CLI, atau Cursor) mengakses REST API Keuangan Apotek tanpa
              sesi login browser. Hak akses API Key otomatis mengikuti peran akun pembuatnya.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 self-start shrink-0">
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <BookOpen size={12} className="text-brand" /> Swagger UI
              <ExternalLink size={10} className="text-slate-400" />
            </a>
            <a
              href="/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <Code2 size={12} className="text-emerald-600" /> openapi.json
              <ExternalLink size={10} className="text-slate-400" />
            </a>
            <a
              href="/llms.txt"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <Bot size={12} className="text-purple-600" /> llms.txt
              <ExternalLink size={10} className="text-slate-400" />
            </a>
          </div>
        </div>

        {/* Tabel API Keys */}
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-2.5 py-1.5">Nama Integrasi</th>
                <th className="px-2.5 py-1.5 w-44 font-mono">Token Prefix</th>
                <th className="px-2.5 py-1.5 w-32">Dibuat Oleh</th>
                <th className="px-2.5 py-1.5 w-32">Tanggal Dibuat</th>
                <th className="px-2.5 py-1.5 w-36">Terakhir Dipakai</th>
                <th className="px-2.5 py-1.5 w-20 text-center">Status</th>
                <th className="px-2.5 py-1.5 w-20 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2.5 py-4 text-center text-slate-400 italic">
                    Belum ada API Key yang dibuat. Klik tombol &ldquo;Buat API Key Baru&rdquo; di
                    atas untuk membuat kunci.
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="bg-white hover:bg-slate-50/60">
                    <td className="px-2.5 py-1.5 font-semibold text-slate-800">{key.name}</td>
                    <td className="px-2.5 py-1.5 font-mono text-[11px] font-bold text-brand">
                      {key.keyPrefix}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-600">
                      {key.userName ?? "-"}
                      {key.userRole && (
                        <span className="ml-1 rounded px-1 py-0.2 text-[9px] font-bold uppercase bg-slate-100 text-slate-600">
                          {key.userRole}
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-500 font-mono text-[11px]">
                      {key.createdAt ? key.createdAt.slice(0, 10) : "-"}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-500 font-mono text-[11px]">
                      {key.lastUsedAt
                        ? key.lastUsedAt.slice(0, 16).replace("T", " ")
                        : "Belum pernah"}
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                        Aktif
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Yakin ingin mencabut API Key "${key.name}"? Sistem yang menggunakan key ini tidak akan dapat mengakses API lagi.`,
                            )
                          ) {
                            revokeMutation.mutate(key.id);
                          }
                        }}
                        className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Cabut API Key"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Panduan Pemakaian Header HTTP */}
        <div className="rounded border border-slate-200 bg-slate-50/70 p-2 text-xs">
          <span className="font-semibold text-slate-700">Contoh Penggunaan Header HTTP:</span>
          <pre className="mt-1 rounded bg-slate-900 p-2 text-[11px] text-emerald-400 font-mono overflow-x-auto">
            {`curl -X GET "http://localhost:3000/api/transactions/summary" \\
  -H "X-API-Key: ka_live_xxxxxxxxxxxxxxxxxxxxxxxx"`}
          </pre>
        </div>
      </div>

      {/* MODAL: Buat API Key Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <KeyRound size={16} className="text-brand" />
                <h3 className="text-xs font-bold text-slate-800">Buat API Key Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newKeyName.trim()) {
                  toast.error("Nama API Key wajib diisi");
                  return;
                }
                createMutation.mutate({
                  name: newKeyName,
                  expiresAt: newKeyExpiresAt || null,
                });
              }}
              className="p-3 space-y-2.5 text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nama / Label Integrasi
                </label>
                <input
                  type="text"
                  required
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="contoh: Integrasi POS Kasir / Claude Desktop / Agen AI"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Masa Berlaku (Opsional)
                </label>
                <input
                  type="date"
                  value={newKeyExpiresAt}
                  onChange={(e) => setNewKeyExpiresAt(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Kosongkan jika kunci berlaku permanen tanpa tanggal kedaluwarsa.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  {createMutation.isPending ? "Membuat..." : "Buat Kunci"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tampilan Kunci Mentah Setelah Dibuat (Reveal Key) */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <KeyRound size={16} className="text-emerald-700" />
                <h3 className="text-xs font-bold text-emerald-900">
                  API Key Berhasil Dibuat: {revealedKey.name}
                </h3>
              </div>
            </div>

            <div className="p-3.5 space-y-3 text-xs">
              <div className="rounded border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-950 flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <strong>Peringatan Keamanan Penting:</strong> Kunci rahasia ini{" "}
                  <span className="font-bold underline text-amber-900">
                    hanya ditampilkan SATU KALI sekarang
                  </span>
                  . Setelah dialog ini ditutup, Anda tidak akan pernah bisa melihat kunci mentah ini
                  lagi. Segera salin dan simpan di pengelola rahasia Anda.
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Kunci API Rahasia Anda:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={revealedKey.key}
                    className="flex-1 font-mono text-[11px] rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-slate-800 select-all font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(revealedKey.key)}
                    className="inline-flex items-center gap-1 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition shrink-0"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Disalin!" : "Salin Kunci"}
                  </button>
                </div>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600 space-y-1">
                <strong>Cara penggunaan:</strong>
                <div>
                  Header:{" "}
                  <code className="font-mono text-brand font-bold">
                    X-API-Key: {revealedKey.key}
                  </code>
                </div>
                <div>
                  Atau:{" "}
                  <code className="font-mono text-brand font-bold">
                    Authorization: Bearer {revealedKey.key}
                  </code>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRevealedKey(null)}
                  className="rounded bg-slate-800 px-4 py-1 text-xs font-semibold text-white hover:bg-slate-900 transition"
                >
                  Saya Sudah Menyalin Kunci Ini (Tutup)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
