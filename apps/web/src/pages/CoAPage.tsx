import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, LockKeyhole, Plus, Save, Search, SlidersHorizontal, Trash2, WandSparkles } from "lucide-react";
import { parseRupiahToSen, senToRupiah, sumDebitCredit, todayIsoDate } from "@keuangan-apotek/shared";

type Account = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  classification: string;
  normalBalance: "DEBIT" | "KREDIT";
  level: number;
  isGroup: boolean;
  isActive: boolean;
};

type BalanceLine = { accountId: string; debitAmount: string; creditAmount: string; notes?: string };
type BalanceResponseRow = { accountId: string; debitAmount: number; creditAmount: number; runningBalance: number; isGroup: boolean; isLocked: boolean; notes: string | null };
type OpeningBalanceMeta = { cutoffDate: string | null };
type ApiResponse<T> = { data: T } | { error: string | object };

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const today = todayIsoDate();

function formatRupiah(value: string): string {
  try {
    const sen = parseRupiahToSen(value || "0");
    const fixed = senToRupiah(sen).toFixed(2);
    const [whole, fraction] = fixed.split(".");
    return `Rp ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
  } catch {
    return value;
  }
}

function amountToInput(sen: number): string {
  return senToRupiah(sen).toFixed(2);
}

function formatSen(sen: number): string {
  const fixed = senToRupiah(sen).toFixed(2);
  const [whole, fraction] = fixed.split(".");
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}

function CoAPage() {
  const [mode, setMode] = useState<"structure" | "opening">("structure");
  const [cutoffDate, setCutoffDate] = useState(today);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, BalanceLine>>({});
  const [runningBalances, setRunningBalances] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("ALL");
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [newAccount, setNewAccount] = useState({ code: "", name: "", classification: "ASET_LANCAR", normalBalance: "DEBIT", parentId: "", level: 1 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`${apiBase}/api/accounts/tree`).then((response) => response.json() as Promise<ApiResponse<Account[]>>),
      fetch(`${apiBase}/api/opening-balances/meta`).then((response) => response.json() as Promise<ApiResponse<OpeningBalanceMeta>>),
    ]).then(([accountResponse, metaResponse]) => {
      if (cancelled) return;
      if ("error" in accountResponse) throw new Error(typeof accountResponse.error === "string" ? accountResponse.error : "Data akun belum dapat dimuat");
      if ("error" in metaResponse) throw new Error(typeof metaResponse.error === "string" ? metaResponse.error : "Metadata saldo awal belum dapat dimuat");
      const effectiveCutoffDate = metaResponse.data.cutoffDate ?? cutoffDate;
      if (effectiveCutoffDate !== cutoffDate) {
        setCutoffDate(effectiveCutoffDate);
        return;
      }
      return fetch(`${apiBase}/api/opening-balances?cutoffDate=${cutoffDate}`).then((response) => response.json() as Promise<ApiResponse<BalanceResponseRow[]>>).then((balanceResponse) => {
        if (cancelled) return;
        if ("error" in balanceResponse) throw new Error(typeof balanceResponse.error === "string" ? balanceResponse.error : "Data saldo awal belum dapat dimuat");
      setAccounts(accountResponse.data);
      const next: Record<string, BalanceLine> = {};
      const nextRunning: Record<string, number> = {};
      for (const row of balanceResponse.data) {
        next[row.accountId] = { accountId: row.accountId, debitAmount: amountToInput(row.debitAmount), creditAmount: amountToInput(row.creditAmount), notes: row.notes ?? "" };
        nextRunning[row.accountId] = row.runningBalance;
      }
      setBalances(next);
      setRunningBalances(nextRunning);
      setIsLocked(balanceResponse.data.some((row) => row.isLocked));
      setMessage("");
      });
    }).catch(() => {
      if (!cancelled) setMessage("API belum terhubung. Jalankan server untuk membuka data CoA.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cutoffDate]);

  const visibleAccounts = useMemo(() => accounts.filter((account) => {
    const matchesText = `${account.code} ${account.name}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (classification === "ALL" || account.classification === classification);
  }), [accounts, classification, search]);

  const totals = useMemo(() => {
    const lines = accounts.map((account) => balances[account.id] ?? { accountId: account.id, debitAmount: "0", creditAmount: "0" });
    try {
      const result = sumDebitCredit(lines.map((line) => ({ debit: line.debitAmount, credit: line.creditAmount })));
      return { debit: result.debit, credit: result.credit, difference: result.difference };
    } catch {
      const invalid = sumDebitCredit([{ debit: "1", credit: "0" }]);
      return { debit: invalid.debit, credit: invalid.credit, difference: invalid.difference };
    }
  }, [balances, visibleAccounts]);

  const updateBalance = (accountId: string, field: "debitAmount" | "creditAmount" | "notes", value: string) => {
    setBalances((current) => ({ ...current, [accountId]: { accountId, debitAmount: "0", creditAmount: "0", ...current[accountId], [field]: value } }));
  };

  async function autoBalance() {
    const lines = accounts.map((account) => balances[account.id] ?? { accountId: account.id, debitAmount: "0", creditAmount: "0" });
    const response = await fetch(`${apiBase}/api/opening-balances/auto-balance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cutoffDate, lines }) });
    const payload = await response.json() as ApiResponse<{ lines: BalanceLine[] }>;
    if ("error" in payload) { setMessage(typeof payload.error === "string" ? payload.error : "Auto-balancing gagal"); return; }
    const next: Record<string, BalanceLine> = {};
    for (const line of payload.data.lines) next[line.accountId] = line;
    setBalances((current) => ({ ...current, ...next }));
    setMessage("Selisih dialokasikan ke Ekuitas Saldo Awal (3101).");
  }

  async function saveAndLock() {
    const lines = accounts.map((account) => balances[account.id] ?? { accountId: account.id, debitAmount: "0", creditAmount: "0" });
    const saveResponse = await fetch(`${apiBase}/api/opening-balances/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cutoffDate, lines }) });
    if (!saveResponse.ok) { setMessage("Saldo awal belum dapat disimpan."); return; }
    const lockResponse = await fetch(`${apiBase}/api/opening-balances/lock`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cutoffDate }) });
    const payload = await lockResponse.json() as ApiResponse<{ journal: { journalNo: string } }>;
    if ("error" in payload) { setMessage(typeof payload.error === "string" ? payload.error : "Saldo awal belum dapat dikunci."); return; }
    setIsLocked(true);
    setMessage(`Saldo awal terkunci. Jurnal pembuka ${payload.data.journal.journalNo} terbentuk.`);
  }

  async function addAccount() {
    const response = await fetch(`${apiBase}/api/accounts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(newAccount) });
    if (!response.ok) { setMessage("Akun baru tidak dapat disimpan."); return; }
    const payload = await response.json() as ApiResponse<Account>;
    if ("error" in payload) return;
    setAccounts((current) => [...current, payload.data].sort((a, b) => a.code.localeCompare(b.code)));
    setNewAccount({ code: "", name: "", classification: "ASET_LANCAR", normalBalance: "DEBIT", parentId: "", level: 1 });
    setMessage("Akun baru ditambahkan.");
  }

  async function updateAccount(account: Account, patch: Partial<Account>) {
    const next = { ...account, ...patch };
    const response = await fetch(`${apiBase}/api/accounts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) { setMessage(`Perubahan akun ${account.code} tidak tersimpan.`); return; }
    const payload = await response.json() as ApiResponse<Account>;
    if ("error" in payload) return;
    setAccounts((current) => current.map((item) => item.id === account.id ? payload.data : item).sort((a, b) => a.code.localeCompare(b.code)));
  }

  async function deleteAccount(id: string) {
    const response = await fetch(`${apiBase}/api/accounts/${id}`, { method: "DELETE" });
    if (!response.ok) { setMessage("Akun tidak dapat dihapus. Hapus sub-akun atau referensi terkait terlebih dahulu."); return; }
    setAccounts((current) => current.filter((account) => account.id !== id));
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Modul 1 · Master Data</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Bagan Akun & Saldo Awal</h2>
          <p className="mt-1 text-sm text-muted">Kelola hierarki CoA dan siapkan jurnal pembuka dengan angka yang presisi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="cutoff">Per tanggal</label>
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" id="cutoff" onChange={(event) => setCutoffDate(event.target.value)} type="date" value={cutoffDate} />
          <button className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "structure" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`} onClick={() => setMode("structure")} type="button">Struktur Akun</button>
          <button className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "opening" ? "bg-brand text-white" : "border border-slate-200 text-slate-600"}`} onClick={() => setMode("opening")} type="button">Input Saldo Awal</button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input aria-label="Cari akun" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setSearch(event.target.value)} placeholder="Cari kode atau nama akun..." value={search} /></div>
        <div className="flex items-center gap-2 text-sm text-slate-500"><SlidersHorizontal size={16} /><select aria-label="Filter klasifikasi" className="rounded-lg border border-slate-200 px-3 py-2" onChange={(event) => setClassification(event.target.value)} value={classification}><option value="ALL">Semua klasifikasi</option><option value="ASET_LANCAR">Aset Lancar</option><option value="ASET_TIDAK_LANCAR">Aset Tidak Lancar</option><option value="KEWAJIBAN_LANCAR">Kewajiban</option><option value="EKUITAS">Ekuitas</option><option value="PENDAPATAN">Pendapatan</option><option value="BEBAN_POKOK">Beban Pokok</option><option value="BEBAN_OPERASIONAL">Beban Operasional</option></select></div>
      </section>

      {message && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">{message}</p>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="sticky left-0 bg-slate-50 px-5 py-3">Kode Akun</th><th className="px-4 py-3">Nama Akun</th><th className="px-4 py-3">Klasifikasi</th><th className="px-4 py-3">Saldo Normal</th>{mode === "opening" ? <><th className="px-4 py-3 text-right">Debit Awal (Rp)</th><th className="px-4 py-3 text-right">Kredit Awal (Rp)</th><th className="px-4 py-3">Catatan</th></> : <><th className="px-4 py-3 text-right">Saldo Berjalan</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Aksi</th></>}</tr></thead>
            <tbody>
              {loading && <tr><td className="px-5 py-8 text-center text-muted" colSpan={mode === "opening" ? 7 : 7}>Memuat CoA...</td></tr>}
              {!loading && visibleAccounts.map((account, index) => {
                const line = balances[account.id] ?? { accountId: account.id, debitAmount: "0", creditAmount: "0", notes: "" };
                const runningBalance = runningBalances[account.id] ?? 0;
                return <tr className={index % 2 ? "bg-slate-50/60" : "bg-white"} key={account.id}>
                  <td className="sticky left-0 bg-inherit px-5 py-2 font-mono font-semibold tabular-nums text-slate-700"><span className="inline-flex items-center" style={{ paddingLeft: `${(account.level - 1) * 18}px` }}>{account.level > 1 ? <ChevronRight className="mr-1 inline text-slate-300" size={14} /> : null}<input aria-label={`Kode ${account.code}`} className="w-20 rounded-md border border-transparent bg-transparent px-1 py-1 hover:border-slate-200 focus:border-brand focus:outline-none" disabled={account.isGroup} defaultValue={account.code} onBlur={(event) => { if (/^\d{4}$/.test(event.currentTarget.value) && event.currentTarget.value !== account.code) void updateAccount(account, { code: event.currentTarget.value }); }} /></span></td>
                  <td className="px-4 py-2 font-medium"><input aria-label={`Nama ${account.code}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-slate-200 focus:border-brand focus:outline-none" disabled={account.isGroup} defaultValue={account.name} onBlur={(event) => { if (event.currentTarget.value.trim() && event.currentTarget.value !== account.name) void updateAccount(account, { name: event.currentTarget.value.trim() }); }} /></td><td className="px-4 py-2"><select aria-label={`Klasifikasi ${account.code}`} className="rounded-md border border-transparent bg-transparent px-2 py-1 text-xs hover:border-slate-200" disabled={account.isGroup} defaultValue={account.classification} onChange={(event) => void updateAccount(account, { classification: event.target.value })}><option value="ASET_LANCAR">ASET LANCAR</option><option value="ASET_TIDAK_LANCAR">ASET TIDAK LANCAR</option><option value="KEWAJIBAN_LANCAR">KEWAJIBAN LANCAR</option><option value="EKUITAS">EKUITAS</option><option value="PENDAPATAN">PENDAPATAN</option><option value="BEBAN_POKOK">BEBAN POKOK</option><option value="BEBAN_OPERASIONAL">BEBAN OPERASIONAL</option><option value="BEBAN_NON_OPERASIONAL">BEBAN NON OPERASIONAL</option></select></td><td className="px-4 py-2"><select aria-label={`Saldo normal ${account.code}`} className={account.normalBalance === "DEBIT" ? "rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-blue-700" : "rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-emerald-700"} disabled={account.isGroup} defaultValue={account.normalBalance} onChange={(event) => void updateAccount(account, { normalBalance: event.target.value as Account["normalBalance"] })}><option value="DEBIT">DEBIT</option><option value="KREDIT">KREDIT</option></select></td>
                  {mode === "opening" ? <><td className="px-4 py-2"><input aria-label={`Debit ${account.code}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-right font-mono tabular-nums hover:border-slate-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-blue-100" disabled={isLocked || account.isGroup} onBlur={(event) => updateBalance(account.id, "debitAmount", formatRupiah(event.target.value).replace(/^Rp\s*/, ""))} onChange={(event) => updateBalance(account.id, "debitAmount", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.closest("tr")?.querySelector<HTMLInputElement>(`[aria-label='Kredit ${account.code}']`)?.focus(); }} value={line.debitAmount} /></td><td className="px-4 py-2"><input aria-label={`Kredit ${account.code}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-right font-mono tabular-nums hover:border-slate-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-blue-100" disabled={isLocked || account.isGroup} onBlur={(event) => updateBalance(account.id, "creditAmount", formatRupiah(event.target.value).replace(/^Rp\s*/, ""))} onChange={(event) => updateBalance(account.id, "creditAmount", event.target.value)} value={line.creditAmount} /></td><td className="px-4 py-2"><input aria-label={`Catatan ${account.code}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-brand focus:outline-none" disabled={isLocked || account.isGroup} onChange={(event) => updateBalance(account.id, "notes", event.target.value)} value={line.notes ?? ""} /></td></> : <><td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">Rp {formatSen(runningBalance)}</td><td className="px-4 py-3 text-center"><label className="inline-flex items-center gap-2 text-xs text-emerald-700"><input aria-label={`Aktif ${account.code}`} disabled={account.isGroup} checked={account.isActive} onChange={(event) => void updateAccount(account, { isActive: event.target.checked })} type="checkbox" />Aktif</label></td><td className="px-4 py-3 text-center"><button aria-label={`Hapus ${account.code}`} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" disabled={account.isGroup} onClick={() => deleteAccount(account.id)} type="button"><Trash2 size={16} /></button></td></>}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      {mode === "structure" && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-4"><div className="flex flex-col gap-3 md:flex-row md:items-end"><label className="flex-1 text-xs font-semibold text-slate-500">Kode akun<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setNewAccount({ ...newAccount, code: event.target.value })} placeholder="Contoh 1210" value={newAccount.code} /></label><label className="flex-[2] text-xs font-semibold text-slate-500">Nama akun<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setNewAccount({ ...newAccount, name: event.target.value })} placeholder="Nama akun baru" value={newAccount.name} /></label><select aria-label="Induk akun baru" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(event) => { const parent = accounts.find((account) => account.id === event.target.value); setNewAccount({ ...newAccount, parentId: event.target.value, level: parent ? parent.level + 1 : 1 }); }} value={newAccount.parentId}><option value="">Tanpa induk</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select><select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setNewAccount({ ...newAccount, classification: event.target.value })} value={newAccount.classification}><option value="ASET_LANCAR">Aset Lancar</option><option value="KEWAJIBAN_LANCAR">Kewajiban</option><option value="EKUITAS">Ekuitas</option><option value="PENDAPATAN">Pendapatan</option><option value="BEBAN_OPERASIONAL">Beban Operasional</option></select><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={addAccount} type="button"><Plus size={16} /> Tambah Akun</button></div></section>}

      {mode === "opening" && <div className={`sticky bottom-3 z-20 flex flex-col gap-4 rounded-2xl border p-4 shadow-lg md:flex-row md:items-center md:justify-between ${totals.difference.isZero() ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><div className="grid grid-cols-3 gap-5 text-sm"><div><p className="text-xs text-slate-500">Total Debit Awal</p><p className="mt-1 font-mono font-bold tabular-nums">Rp {totals.debit.toFixed(2)}</p></div><div><p className="text-xs text-slate-500">Total Kredit Awal</p><p className="mt-1 font-mono font-bold tabular-nums">Rp {totals.credit.toFixed(2)}</p></div><div><p className="text-xs text-slate-500">Selisih</p><p className={`mt-1 font-mono font-bold tabular-nums ${totals.difference.isZero() ? "text-emerald-700" : "text-red-700"}`}>Rp {totals.difference.toFixed(2)}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${totals.difference.isZero() ? "bg-white text-emerald-700" : "bg-white text-red-700"}`}>{totals.difference.isZero() ? <Check size={14} /> : <span>!</span>} {totals.difference.isZero() ? "Seimbang" : "Belum seimbang"}</span><button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={isLocked || totals.difference.isZero()} onClick={autoBalance} type="button"><WandSparkles size={16} /> Alokasikan Selisih</button><button className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={isLocked || !totals.difference.isZero()} onClick={saveAndLock} type="button">{isLocked ? <LockKeyhole size={16} /> : <Save size={16} />} {isLocked ? "Terkunci" : "Simpan & Terapkan"}</button></div></div>}
    </div>
  );
}

export default CoAPage;
