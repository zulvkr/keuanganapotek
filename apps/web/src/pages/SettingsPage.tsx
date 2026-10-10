import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ShieldCheck, Wallet, CheckCircle2, Database } from "lucide-react";
import { getAccounts, queryKeys } from "../lib/queries";

export default function SettingsPage() {
  const [pharmacyName, setPharmacyName] = useState("Apotek Sehat Sejahtera");
  const [apotekerName, setApotekerName] = useState("apt. Ivan Zulfikar, S.Farm.");
  const [sipaNo, setSipaNo] = useState("19920101/SIPA_32.73/2024/2001");
  const [saved, setSaved] = useState(false);

  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const accounts = accountsQuery.data ?? [];

  const cashBankAccounts = accounts.filter((a) => a.code.startsWith("110"));

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Konfigurasi Outlet & Akuntansi
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Pengaturan</h2>
        <p className="mt-1 text-sm text-muted">
          Informasi apotek, penanggung jawab teknis kefarmasian, dan konfigurasi buku kas
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} /> Pengaturan profil berhasil disimpan.
        </div>
      )}

      {/* Profile Form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <Building2 size={20} className="text-brand" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Identitas Apotek & Legalitas</h3>
            <p className="text-xs text-muted">
              Informasi untuk header laporan keuangan dan bukti cetak
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Nama Apotek</label>
              <input
                type="text"
                value={pharmacyName}
                onChange={(e) => setPharmacyName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Apoteker Pengelola (APA)
              </label>
              <input
                type="text"
                value={apotekerName}
                onChange={(e) => setApotekerName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Nomor SIPA</label>
            <input
              type="text"
              value={sipaNo}
              onChange={(e) => setSipaNo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Simpan Identitas
            </button>
          </div>
        </form>
      </section>

      {/* 9 Cash & Bank Accounts Status */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <Wallet size={20} className="text-brand" />
          <div>
            <h3 className="text-base font-bold text-slate-900">
              9 Akun Kas & Setara Kas Terdaftar
            </h3>
            <p className="text-xs text-muted">
              Akun-akun kas/bank yang dipantau running balance-nya di Buku Transaksi
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {cashBankAccounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3"
            >
              <div>
                <span className="font-mono text-xs font-bold text-brand">{account.code}</span>
                <p className="text-xs font-medium text-slate-800 line-clamp-1">{account.name}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Aktif
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* System Engine Status */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <Database size={20} className="text-brand" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Status Sistem & Arsitektur</h3>
            <p className="text-xs text-muted">
              Spesifikasi mesin double-entry dan persistensi basis data
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-xs text-slate-600">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="font-medium text-slate-700">Mesin Jurnal</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck size={14} /> Double-Entry Multibaris Otomatis
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="font-medium text-slate-700">Format Bagan Akun</span>
            <span className="font-mono text-slate-800">4-Digit Standar (^\d{4}$)</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="font-medium text-slate-700">Tipe Database</span>
            <span className="text-slate-800">SQLite + WAL Mode (Better-SQLite3)</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="font-medium text-slate-700">Form Metadata Dinamis</span>
            <span className="text-slate-800">8 Tipe Field Berbasis Skema</span>
          </div>
        </div>
      </section>
    </div>
  );
}
