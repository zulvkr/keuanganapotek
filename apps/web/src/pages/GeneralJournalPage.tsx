import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ClipboardPaste, Pencil, Plus, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import { JournalEntrySchema, parseRupiahToSen, senToRupiah, sumDebitCredit, todayIsoDate } from "@keuangan-apotek/shared";

type Account = { id: string; code: string; name: string; isActive: boolean };
type DraftLine = { accountId: string; accountQuery: string; description: string; debit: string; credit: string };
type ApiResponse<T> = { data: T } | { error: string | object };
type JournalSummary = { id: string; journalNo: string; entryDate: string; referenceNo: string | null; memo: string | null; sourceModule: string; totalDebit: number; totalCredit: number; lineCount: number };
type JournalDetail = { journal: JournalSummary; lines: Array<{ accountId: string; accountCode: string; accountName: string; description: string | null; debit: number; credit: number }> };

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const emptyLine = (): DraftLine => ({ accountId: "", accountQuery: "", description: "", debit: "", credit: "" });

function formatAmount(value: string): string {
  try {
    const sen = parseRupiahToSen(value || "0");
    const fixed = senToRupiah(sen).toFixed(2);
    const [whole, fraction] = fixed.split(".");
    return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
  } catch {
    return value;
  }
}

function formatSen(value: number): string {
  return formatAmount(senToRupiah(value).toFixed(2));
}

function JournalAmount({ value }: { value: number }) {
  return <span className="font-mono tabular-nums">Rp {formatSen(value)}</span>;
}

function GeneralJournalPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entryDate, setEntryDate] = useState(todayIsoDate());
  const [referenceNo, setReferenceNo] = useState("");
  const [memo, setMemo] = useState("");
  const [rows, setRows] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [history, setHistory] = useState<DraftLine[][]>([]);
  const [future, setFuture] = useState<DraftLine[][]>([]);
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function loadJournals() {
    const query = new URLSearchParams();
    if (startDate) query.set("startDate", startDate);
    if (endDate) query.set("endDate", endDate);
    const response = await fetch(`${apiBase}/api/journals?${query.toString()}`);
    const payload = await response.json() as ApiResponse<JournalSummary[]>;
    if ("error" in payload) throw new Error(typeof payload.error === "string" ? payload.error : "Daftar jurnal tidak dapat dimuat");
    setJournals(payload.data);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`${apiBase}/api/accounts/tree`).then((response) => response.json() as Promise<ApiResponse<Account[]>>),
      loadJournals(),
    ]).then(([accountResponse]) => {
      if (cancelled) return;
      if ("error" in accountResponse) throw new Error("Daftar akun tidak dapat dimuat");
      setAccounts(accountResponse.data.filter((account) => account.isActive));
      setMessage("");
    }).catch((error: unknown) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : "API belum terhubung");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const totals = useMemo(() => {
    try {
      const result = sumDebitCredit(rows.map((row) => ({ debit: parseRupiahToSen(row.debit || "0"), credit: parseRupiahToSen(row.credit || "0") })));
      return result;
    } catch {
      return sumDebitCredit([{ debit: 1, credit: 0 }]);
    }
  }, [rows]);

  const hasInvalidRows = rows.some((row) => {
    const debit = row.debit.trim();
    const credit = row.credit.trim();
    return (debit && credit) || (debit && !parseable(debit)) || (credit && !parseable(credit));
  });
  const populatedRows = rows.filter((row) => row.accountId && (row.debit.trim() || row.credit.trim()));
  const canPost = !hasInvalidRows && populatedRows.length >= 2 && totals.difference.isZero();

  function parseable(value: string): boolean {
    try { parseRupiahToSen(value); return true; } catch { return false; }
  }

  function commitRows(next: DraftLine[] | ((current: DraftLine[]) => DraftLine[])) {
    setRows((current) => {
      const updated = typeof next === "function" ? next(current) : next;
      setHistory((previous) => [...previous.slice(-49), current]);
      setFuture([]);
      return updated;
    });
  }

  function updateRow(index: number, patch: Partial<DraftLine>) {
    commitRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function addRow() {
    commitRows((current) => [...current, emptyLine()]);
  }

  function removeRow(index: number) {
    if (rows.length <= 2) return;
    commitRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function moveFocus(rowIndex: number, column: "account" | "description" | "debit" | "credit") {
    const target = inputRefs.current[`${rowIndex}:${column}`];
    target?.focus();
  }

  function handleCellKeyDown(event: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, column: "account" | "description" | "debit" | "credit") {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      const previous = history.at(-1);
      if (previous) { setHistory((current) => current.slice(0, -1)); setFuture((current) => [...current, rows]); setRows(previous); }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      const next = future.at(-1);
      if (next) { setFuture((current) => current.slice(0, -1)); setHistory((current) => [...current, rows]); setRows(next); }
      return;
    }
    if (event.key === "Escape") { event.currentTarget.blur(); return; }
    if (event.key === "Tab" && !event.shiftKey && column === "credit" && rowIndex === rows.length - 1) {
      event.preventDefault();
      addRow();
      window.setTimeout(() => moveFocus(rowIndex + 1, "account"), 0);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (rowIndex === rows.length - 1) addRow();
      window.setTimeout(() => moveFocus(Math.min(rowIndex + 1, rows.length - 1), column), 0);
    }
  }

  function accountChanged(index: number, value: string) {
    const account = accounts.find((item) => item.code === value || `${item.code} · ${item.name}` === value || item.name.toLowerCase() === value.toLowerCase());
    updateRow(index, { accountQuery: value, accountId: account?.id ?? "" });
  }

  function pasteRows(event: React.ClipboardEvent<HTMLInputElement>, startIndex: number) {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.includes("\t") && !pasted.includes("\n")) return;
    event.preventDefault();
    const pastedRows = pasted.trimEnd().split(/\r?\n/).map((line) => line.split("\t"));
    commitRows((current) => {
      const next = [...current];
      pastedRows.forEach((values, offset) => {
        const rowIndex = startIndex + offset;
        const [accountQuery = "", description = "", debit = "", credit = ""] = values;
        const account = accounts.find((item) => item.code === accountQuery.trim() || `${item.code} · ${item.name}` === accountQuery.trim() || item.name.toLowerCase() === accountQuery.trim().toLowerCase());
        next[rowIndex] = { accountId: account?.id ?? "", accountQuery: accountQuery.trim(), description: description.trim(), debit: debit.trim(), credit: credit.trim() };
      });
      while (next.length < startIndex + pastedRows.length) next.push(emptyLine());
      return next;
    });
  }

  async function openForEdit(id: string) {
    const response = await fetch(`${apiBase}/api/journals/${id}`);
    const payload = await response.json() as ApiResponse<JournalDetail>;
    if ("error" in payload) { setMessage(typeof payload.error === "string" ? payload.error : "Jurnal tidak dapat dibuka"); return; }
    setEditingId(id);
    setEntryDate(payload.data.journal.entryDate);
    setReferenceNo(payload.data.journal.referenceNo ?? "");
    setMemo(payload.data.journal.memo ?? "");
    setRows(payload.data.lines.map((line) => ({ accountId: line.accountId, accountQuery: `${line.accountCode} · ${line.accountName}`, description: line.description ?? "", debit: line.debit ? formatSen(line.debit) : "", credit: line.credit ? formatSen(line.credit) : "" })));
    setHistory([]); setFuture([]); setMessage("Jurnal dimuat untuk diedit.");
  }

  async function submitJournal() {
    const resolvedRows = populatedRows.map((row) => {
      const account = accounts.find((item) => item.id === row.accountId || item.code === row.accountQuery || item.name.toLowerCase() === row.accountQuery.toLowerCase());
      return { accountId: account?.id ?? row.accountId, description: row.description, debit: row.debit || "0", credit: row.credit || "0" };
    });
    const parsed = JournalEntrySchema.safeParse({ entryDate, referenceNo, memo, lines: resolvedRows });
    if (!parsed.success) { setMessage(parsed.error.issues.map((issue) => issue.message).join("; ")); return; }
    const response = await fetch(`${apiBase}/api/journals${editingId ? `/${editingId}` : "/general"}`, {
      method: editingId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data),
    });
    const payload = await response.json() as ApiResponse<JournalDetail>;
    if ("error" in payload) { setMessage(typeof payload.error === "string" ? payload.error : "Jurnal belum dapat disimpan"); return; }
    setMessage(editingId ? "Jurnal berhasil diperbarui." : "Jurnal berhasil diposting.");
    setEditingId(null); setRows([emptyLine(), emptyLine()]); setReferenceNo(""); setMemo(""); setHistory([]); setFuture([]);
    await loadJournals();
  }

  async function removeJournal(id: string) {
    const response = await fetch(`${apiBase}/api/journals/${id}`, { method: "DELETE" });
    if (!response.ok) { const payload = await response.json() as ApiResponse<never>; setMessage("error" in payload && typeof payload.error === "string" ? payload.error : "Jurnal belum dapat dihapus"); return; }
    setMessage("Jurnal dihapus.");
    await loadJournals();
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Modul 2 · Double-entry</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Jurnal Umum</h2><p className="mt-1 text-sm text-muted">Catat jurnal penyesuaian dan transaksi manual dengan keseimbangan debit-kredit real-time.</p></div>
        <div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600" onClick={() => { setRows([emptyLine(), emptyLine()]); setEditingId(null); setReferenceNo(""); setMemo(""); }} type="button"><Plus size={16} /> Jurnal baru</button><span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"><ClipboardPaste size={15} /> Excel paste siap</span></div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-[180px_220px_1fr]"><label className="text-xs font-semibold text-slate-500">Tanggal jurnal<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums" onChange={(event) => setEntryDate(event.target.value)} type="date" value={entryDate} /></label><label className="text-xs font-semibold text-slate-500">No. referensi<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setReferenceNo(event.target.value)} placeholder="Bukti / referensi" value={referenceNo} /></label><label className="text-xs font-semibold text-slate-500">Memo singkat<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setMemo(event.target.value)} placeholder="Uraian jurnal" value={memo} /></label></div>
    </section>

    {message && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">{message}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-14 px-4 py-3 text-center">No.</th><th className="px-4 py-3">Akun (Kode / Nama)</th><th className="px-4 py-3">Keterangan / Uraian</th><th className="w-48 px-4 py-3 text-right">Debit (Rp)</th><th className="w-48 px-4 py-3 text-right">Kredit (Rp)</th><th className="w-16 px-4 py-3 text-center">Aksi</th></tr></thead><tbody>
        {rows.map((row, index) => <tr className={index % 2 ? "bg-slate-50/60" : "bg-white"} key={index}><td className="px-4 py-2 text-center font-mono tabular-nums text-slate-400">{index + 1}</td><td className="px-4 py-2"><input aria-label={`Akun baris ${index + 1}`} className={`w-full rounded-md border bg-transparent px-2 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-blue-100 ${row.accountQuery && !row.accountId ? "border-red-300" : "border-transparent hover:border-slate-200"}`} list="journal-accounts" onChange={(event) => accountChanged(index, event.target.value)} onKeyDown={(event) => handleCellKeyDown(event, index, "account")} onPaste={(event) => pasteRows(event, index)} ref={(element) => { inputRefs.current[`${index}:account`] = element; }} value={row.accountQuery} placeholder="Ketik kode atau nama akun..." /></td><td className="px-4 py-2"><input aria-label={`Keterangan baris ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => updateRow(index, { description: event.target.value })} onKeyDown={(event) => handleCellKeyDown(event, index, "description")} ref={(element) => { inputRefs.current[`${index}:description`] = element; }} value={row.description} placeholder="Uraian baris" /></td><td className="px-4 py-2"><input aria-label={`Debit baris ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-right font-mono tabular-nums outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onBlur={(event) => updateRow(index, { debit: formatAmount(event.currentTarget.value) })} onChange={(event) => updateRow(index, { debit: event.target.value, credit: event.target.value ? "" : row.credit })} onKeyDown={(event) => handleCellKeyDown(event, index, "debit")} ref={(element) => { inputRefs.current[`${index}:debit`] = element; }} value={row.debit} placeholder="0,00" /></td><td className="px-4 py-2"><input aria-label={`Kredit baris ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-right font-mono tabular-nums outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onBlur={(event) => updateRow(index, { credit: formatAmount(event.currentTarget.value) })} onChange={(event) => updateRow(index, { credit: event.target.value, debit: event.target.value ? "" : row.debit })} onKeyDown={(event) => handleCellKeyDown(event, index, "credit")} ref={(element) => { inputRefs.current[`${index}:credit`] = element; }} value={row.credit} placeholder="0,00" /></td><td className="px-4 py-2 text-center"><button aria-label={`Hapus baris ${index + 1}`} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" disabled={rows.length <= 2} onClick={() => removeRow(index)} type="button"><Trash2 size={16} /></button></td></tr>)}
      </tbody></table></div><datalist id="journal-accounts">{accounts.map((account) => <option key={account.id} value={`${account.code} · ${account.name}`} />)}</datalist><button className="m-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={addRow} type="button"><Plus size={15} /> Tambah baris</button>
    </section>

    <section className={`sticky bottom-3 z-20 flex flex-col gap-4 rounded-2xl border p-4 shadow-lg md:flex-row md:items-center md:justify-between ${totals.difference.isZero() && !hasInvalidRows ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><div className="grid grid-cols-3 gap-5 text-sm"><div><p className="text-xs text-slate-500">Total Debit</p><p className="mt-1 font-mono font-bold tabular-nums">Rp {formatSen(totals.debit.toNumber())}</p></div><div><p className="text-xs text-slate-500">Total Kredit</p><p className="mt-1 font-mono font-bold tabular-nums">Rp {formatSen(totals.credit.toNumber())}</p></div><div><p className="text-xs text-slate-500">Selisih</p><p className={`mt-1 font-mono font-bold tabular-nums ${totals.difference.isZero() && !hasInvalidRows ? "text-emerald-700" : "text-red-700"}`}>Rp {formatSen(totals.difference.toNumber())}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold ${totals.difference.isZero() && !hasInvalidRows ? "text-emerald-700" : "text-red-700"}`}>{totals.difference.isZero() && !hasInvalidRows ? <Check size={14} /> : <ChevronDown size={14} />} {totals.difference.isZero() && !hasInvalidRows ? "Seimbang" : "Belum seimbang"}</span><button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-40" disabled={!history.length} onClick={() => { const previous = history.at(-1); if (previous) { setHistory((current) => current.slice(0, -1)); setFuture((current) => [...current, rows]); setRows(previous); } }} type="button"><Undo2 size={15} /> Undo</button><button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-40" disabled={!future.length} onClick={() => { const next = future.at(-1); if (next) { setFuture((current) => current.slice(0, -1)); setHistory((current) => [...current, rows]); setRows(next); } }} type="button"><RotateCcw size={15} /> Redo</button><button className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canPost} onClick={submitJournal} type="button"><Save size={16} /> {editingId ? "Simpan Perubahan" : "Posting Jurnal"}</button></div></section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h3 className="font-semibold">Jurnal terposting</h3><p className="mt-1 text-xs text-muted">Daftar jurnal umum dan jurnal sistem yang tersimpan di buku besar.</p></div><div className="flex gap-2"><input aria-label="Filter jurnal mulai" className="rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /><input aria-label="Filter jurnal sampai" className="rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} /></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2">Nomor</th><th className="px-3 py-2">Tanggal</th><th className="px-3 py-2">Sumber</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Kredit</th><th className="px-3 py-2 text-center">Aksi</th></tr></thead><tbody>{loading ? <tr><td className="px-3 py-6 text-center text-muted" colSpan={6}>Memuat jurnal...</td></tr> : journals.map((journal) => <tr className="border-b border-slate-50 last:border-0" key={journal.id}><td className="px-3 py-3 font-mono tabular-nums font-semibold">{journal.journalNo}</td><td className="px-3 py-3 tabular-nums">{journal.entryDate}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{journal.sourceModule}</span></td><td className="px-3 py-3 text-right"><JournalAmount value={journal.totalDebit} /></td><td className="px-3 py-3 text-right"><JournalAmount value={journal.totalCredit} /></td><td className="px-3 py-3 text-center"><button aria-label={`Edit ${journal.journalNo}`} className="mr-1 rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-brand disabled:opacity-30" disabled={journal.sourceModule !== "GENERAL"} onClick={() => void openForEdit(journal.id)} type="button"><Pencil size={15} /></button><button aria-label={`Hapus ${journal.journalNo}`} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" disabled={journal.sourceModule !== "GENERAL"} onClick={() => void removeJournal(journal.id)} type="button"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div></section>
  </div>;
}

export default GeneralJournalPage;
