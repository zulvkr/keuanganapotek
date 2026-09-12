import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ClipboardPaste, Pencil, Plus, RotateCcw, Save, Trash2, Undo2, X } from "lucide-react";
import { JournalEntrySchema, parseRupiahToSen, senToRupiah, sumDebitCredit, todayIsoDate } from "@keuangan-apotek/shared";
import { createJournal, deleteJournal, updateJournal } from "../lib/mutations";
import { getAccounts, getJournals, queryKeys, type JournalSummary } from "../lib/queries";

type Account = { id: string; code: string; name: string; isActive: boolean };
type DraftLine = { accountId: string; accountQuery: string; description: string; debit: string; credit: string };
type InlineJournalEdit = { id: string; entryDate: string; referenceNo: string; memo: string; rows: DraftLine[] };

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

function toDraftRows(journal: JournalSummary): DraftLine[] {
  return journal.lines.map((line) => ({
    accountId: line.accountId,
    accountQuery: `${line.accountCode} · ${line.accountName}`,
    description: line.description ?? "",
    debit: line.debit ? formatSen(line.debit) : "",
    credit: line.credit ? formatSen(line.credit) : "",
  }));
}

function GeneralJournalPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entryDate, setEntryDate] = useState(todayIsoDate());
  const [referenceNo, setReferenceNo] = useState("");
  const [memo, setMemo] = useState("");
  const [rows, setRows] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [history, setHistory] = useState<DraftLine[][]>([]);
  const [future, setFuture] = useState<DraftLine[][]>([]);
  const [inlineEdit, setInlineEdit] = useState<InlineJournalEdit | null>(null);
  const [singleLine, setSingleLine] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const journalsQuery = useQuery({ queryKey: queryKeys.journals({ startDate: startDate || undefined, endDate: endDate || undefined }), queryFn: () => getJournals({ ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) }) });
  const journals = journalsQuery.data ?? [];

  useEffect(() => { setAccounts((accountsQuery.data ?? []).filter((account) => account.isActive)); }, [accountsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: Parameters<typeof createJournal>[0] }) => id ? updateJournal(id, input) : createJournal(input),
    onSuccess: async (_, variables) => {
      setMessage(variables.id ? "Jurnal berhasil diperbarui." : "Jurnal berhasil diposting.");
      if (variables.id) setInlineEdit(null);
      else resetDraft();
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Jurnal belum dapat disimpan"),
  });
  const removeMutation = useMutation({ mutationFn: deleteJournal, onSuccess: async () => { setMessage("Jurnal dihapus."); await queryClient.invalidateQueries({ queryKey: ["journals"] }); await queryClient.invalidateQueries({ queryKey: ["reports"] }); }, onError: (error) => setMessage(error instanceof Error ? error.message : "Jurnal belum dapat dihapus") });

  const totals = useMemo(() => {
    try {
      return sumDebitCredit(rows.map((row) => ({ debit: parseRupiahToSen(row.debit || "0"), credit: parseRupiahToSen(row.credit || "0") })));
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

  function resetDraft() {
    setEntryDate(todayIsoDate());
    setReferenceNo("");
    setMemo("");
    setRows([emptyLine(), emptyLine()]);
    setHistory([]);
    setFuture([]);
  }

  function newJournal() {
    setInlineEdit(null);
    resetDraft();
    setMessage("");
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

  function addRow() { commitRows((current) => [...current, emptyLine()]); }

  function removeRow(index: number) {
    if (rows.length <= 2) return;
    commitRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function moveFocus(rowIndex: number, column: "account" | "description" | "debit" | "credit") {
    inputRefs.current[`${rowIndex}:${column}`]?.focus();
  }

  function handleCellKeyDown(event: KeyboardEvent<HTMLInputElement>, rowIndex: number, column: "account" | "description" | "debit" | "credit") {
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

  function findAccount(value: string): Account | undefined {
    const normalized = value.trim();
    return accounts.find((account) => account.code === normalized || `${account.code} · ${account.name}` === normalized || account.name.toLowerCase() === normalized.toLowerCase());
  }

  function accountChanged(index: number, value: string) {
    const account = findAccount(value);
    updateRow(index, { accountQuery: value, accountId: account?.id ?? "" });
  }

  function updateInlineRow(index: number, patch: Partial<DraftLine>) {
    setInlineEdit((current) => current ? { ...current, rows: current.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) } : current);
  }

  function addInlineRow() {
    setInlineEdit((current) => current ? { ...current, rows: [...current.rows, emptyLine()] } : current);
  }

  function removeInlineRow(index: number) {
    setInlineEdit((current) => current && current.rows.length > 2 ? { ...current, rows: current.rows.filter((_, rowIndex) => rowIndex !== index) } : current);
  }

  function inlineAccountChanged(index: number, value: string) {
    const account = findAccount(value);
    updateInlineRow(index, { accountQuery: value, accountId: account?.id ?? "" });
  }

  function pasteRows(event: ClipboardEvent<HTMLInputElement>, startIndex: number) {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.includes("\t") && !pasted.includes("\n")) return;
    event.preventDefault();
    const pastedRows = pasted.trimEnd().split(/\r?\n/).map((line) => line.split("\t"));
    commitRows((current) => {
      const next = [...current];
      pastedRows.forEach((values, offset) => {
        const rowIndex = startIndex + offset;
        const [accountQuery = "", description = "", debit = "", credit = ""] = values;
        const account = findAccount(accountQuery);
        next[rowIndex] = { accountId: account?.id ?? "", accountQuery: accountQuery.trim(), description: description.trim(), debit: debit.trim(), credit: credit.trim() };
      });
      while (next.length < startIndex + pastedRows.length) next.push(emptyLine());
      return next;
    });
  }

  async function startInlineEdit(journal: JournalSummary) {
    if (journal.sourceModule !== "GENERAL") return;
    if (singleLine && journal.lines.length !== 2) setSingleLine(false);
    setInlineEdit({ id: journal.id, entryDate: journal.entryDate, referenceNo: journal.referenceNo ?? "", memo: journal.memo ?? "", rows: toDraftRows(journal) });
    setMessage("");
  }

  function buildInput(edit: InlineJournalEdit | null) {
    const sourceRows = edit ? edit.rows : rows;
    const resolvedRows = sourceRows.filter((row) => row.accountId && (row.debit.trim() || row.credit.trim())).map((row) => {
      const account = findAccount(row.accountQuery);
      return { accountId: account?.id ?? row.accountId, description: row.description, debit: row.debit || "0", credit: row.credit || "0" };
    });
    return JournalEntrySchema.safeParse({ entryDate: edit?.entryDate ?? entryDate, referenceNo: edit?.referenceNo ?? referenceNo, memo: edit?.memo ?? memo, lines: resolvedRows });
  }

  function submitJournal() {
    const parsed = buildInput(null);
    if (!parsed.success) { setMessage(parsed.error.issues.map((issue) => issue.message).join("; ")); return; }
    saveMutation.mutate({ id: null, input: parsed.data });
  }

  function submitInlineEdit() {
    if (!inlineEdit) return;
    const parsed = buildInput(inlineEdit);
    if (!parsed.success) { setMessage(parsed.error.issues.map((issue) => issue.message).join("; ")); return; }
    saveMutation.mutate({ id: inlineEdit.id, input: parsed.data });
  }

  function accountSummary(journal: JournalSummary, side: "debit" | "credit") {
    return journal.lines.filter((line) => line[side] > 0).map((line) => `${line.accountCode} · ${line.accountName}`).join(" · ") || "—";
  }

  function renderTableHeader() {
    return singleLine ? <tr><th className="w-24 px-3 py-3">Nomor</th><th className="w-40 px-3 py-3">Tanggal</th><th className="w-56 px-3 py-3">Referensi / Memo</th><th className="min-w-[230px] px-3 py-3">Akun debit</th><th className="min-w-[230px] px-3 py-3">Akun kredit</th><th className="w-48 px-3 py-3 text-right">Nominal (Rp)</th><th className="min-w-[190px] px-3 py-3">Keterangan</th><th className="w-28 px-3 py-3 text-center">Aksi</th></tr> : <tr><th className="w-24 px-3 py-3">Nomor</th><th className="w-40 px-3 py-3">Tanggal</th><th className="w-56 px-3 py-3">Referensi / Memo</th><th className="min-w-[230px] px-3 py-3">Akun</th><th className="min-w-[190px] px-3 py-3">Keterangan</th><th className="w-48 px-3 py-3 text-right">Debit (Rp)</th><th className="w-48 px-3 py-3 text-right">Kredit (Rp)</th><th className="w-28 px-3 py-3 text-center">Aksi</th></tr>;
  }

  function renderDraftRows() {
    if (singleLine) {
      const debitRow = rows[0] ?? emptyLine();
      const creditRow = rows[1] ?? emptyLine();
      const amount = debitRow.debit || creditRow.credit;
      return <tr>
        <td className="border-r border-blue-100 bg-blue-50/50 px-3 py-2 text-center align-top font-semibold text-brand">Baru</td>
        <td className="border-r border-blue-100 bg-blue-50/50 px-3 py-2 align-top"><input aria-label="Tanggal jurnal draft" className="w-full rounded-md border border-transparent bg-white px-2 py-2 text-sm tabular-nums outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setEntryDate(event.target.value)} type="date" value={entryDate} /></td>
        <td className="border-r border-blue-100 bg-blue-50/50 px-3 py-2 align-top"><input aria-label="Referensi jurnal draft" className="w-full rounded-md border border-transparent bg-white px-2 py-2 text-sm outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setReferenceNo(event.target.value)} placeholder="No. bukti / referensi" value={referenceNo} /><input aria-label="Memo jurnal draft" className="mt-2 w-full rounded-md border border-transparent bg-white px-2 py-2 text-sm outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setMemo(event.target.value)} placeholder="Memo singkat" value={memo} /></td>
        <td className="px-3 py-2"><input aria-label="Akun debit jurnal draft" className={`w-full rounded-md border bg-transparent px-2 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-blue-100 ${debitRow.accountQuery && !debitRow.accountId ? "border-red-300" : "border-transparent hover:border-slate-200"}`} list="journal-accounts" onChange={(event) => accountChanged(0, event.target.value)} value={debitRow.accountQuery} placeholder="Akun debit..." /></td>
        <td className="px-3 py-2"><input aria-label="Akun kredit jurnal draft" className={`w-full rounded-md border bg-transparent px-2 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-blue-100 ${creditRow.accountQuery && !creditRow.accountId ? "border-red-300" : "border-transparent hover:border-slate-200"}`} list="journal-accounts" onChange={(event) => accountChanged(1, event.target.value)} value={creditRow.accountQuery} placeholder="Akun kredit..." /></td>
        <td className="px-3 py-2"><input aria-label="Nominal jurnal draft" className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-right font-mono tabular-nums outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onBlur={(event) => { const value = formatAmount(event.currentTarget.value); commitRows((current) => current.map((row, rowIndex) => rowIndex === 0 ? { ...row, debit: value, credit: "" } : rowIndex === 1 ? { ...row, debit: "", credit: value } : row)); }} onChange={(event) => { const value = event.target.value; setRows((current) => current.map((row, rowIndex) => rowIndex === 0 ? { ...row, debit: value, credit: "" } : rowIndex === 1 ? { ...row, debit: "", credit: value } : row)); }} placeholder="0,00" value={amount} /></td>
        <td className="px-3 py-2"><input aria-label="Keterangan jurnal draft" className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => updateRow(0, { description: event.target.value })} value={debitRow.description || creditRow.description} placeholder="Uraian transaksi" /></td>
        <td className="bg-blue-50/50 px-3 py-2 text-center align-top"><button className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={!canPost || saveMutation.isPending} onClick={submitJournal} type="button"><Save size={14} /> Posting</button></td>
      </tr>;
    }
    return rows.map((row, index) => <tr className={singleLine && index % 2 ? "bg-blue-50/30" : ""} key={`draft-${index}`}>
      {(singleLine || index === 0) && <>
        <td className="border-r border-blue-100 bg-blue-50/50 px-3 py-2 text-center align-top font-semibold text-brand" rowSpan={singleLine ? undefined : rows.length}>Baru</td>
        <td className="border-r border-blue-100 bg-blue-50/50 px-3 py-2 align-top" rowSpan={singleLine ? undefined : rows.length}><input aria-label="Tanggal jurnal draft" className="w-full rounded-md border border-transparent bg-white px-2 py-2 text-sm tabular-nums outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setEntryDate(event.target.value)} type="date" value={entryDate} /></td>
        <td className="border-r border-blue-100 bg-blue-50/50 px-3 py-2 align-top" rowSpan={singleLine ? undefined : rows.length}><input aria-label="Referensi jurnal draft" className="w-full rounded-md border border-transparent bg-white px-2 py-2 text-sm outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setReferenceNo(event.target.value)} placeholder="No. bukti / referensi" value={referenceNo} /><input aria-label="Memo jurnal draft" className="mt-2 w-full rounded-md border border-transparent bg-white px-2 py-2 text-sm outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setMemo(event.target.value)} placeholder="Memo singkat" value={memo} /></td>
      </>}
      <td className="px-3 py-2"><div className="flex items-center gap-1"><input aria-label={`Akun baris ${index + 1}`} className={`min-w-0 flex-1 rounded-md border bg-transparent px-2 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-blue-100 ${row.accountQuery && !row.accountId ? "border-red-300" : "border-transparent hover:border-slate-200"}`} list="journal-accounts" onChange={(event) => accountChanged(index, event.target.value)} onKeyDown={(event) => handleCellKeyDown(event, index, "account")} onPaste={(event) => pasteRows(event, index)} ref={(element) => { inputRefs.current[`${index}:account`] = element; }} value={row.accountQuery} placeholder="Ketik kode atau nama akun..." /><button aria-label={`Hapus baris draft ${index + 1}`} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" disabled={rows.length <= 2} onClick={() => removeRow(index)} type="button"><Trash2 size={15} /></button></div></td>
      <td className="px-3 py-2"><input aria-label={`Keterangan baris ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => updateRow(index, { description: event.target.value })} onKeyDown={(event) => handleCellKeyDown(event, index, "description")} ref={(element) => { inputRefs.current[`${index}:description`] = element; }} value={row.description} placeholder="Uraian baris" /></td>
      <td className="px-3 py-2"><input aria-label={`Debit baris ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-right font-mono tabular-nums outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onBlur={(event) => updateRow(index, { debit: formatAmount(event.currentTarget.value) })} onChange={(event) => updateRow(index, { debit: event.target.value, credit: event.target.value ? "" : row.credit })} onKeyDown={(event) => handleCellKeyDown(event, index, "debit")} ref={(element) => { inputRefs.current[`${index}:debit`] = element; }} value={row.debit} placeholder="0,00" /></td>
      <td className="px-3 py-2"><input aria-label={`Kredit baris ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-right font-mono tabular-nums outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onBlur={(event) => updateRow(index, { credit: formatAmount(event.currentTarget.value) })} onChange={(event) => updateRow(index, { credit: event.target.value, debit: event.target.value ? "" : row.debit })} onKeyDown={(event) => handleCellKeyDown(event, index, "credit")} ref={(element) => { inputRefs.current[`${index}:credit`] = element; }} value={row.credit} placeholder="0,00" /></td>
      {index === 0 ? <td className="bg-blue-50/50 px-3 py-2 text-center align-top" rowSpan={singleLine ? undefined : rows.length}><button className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={!canPost || saveMutation.isPending} onClick={submitJournal} type="button"><Save size={14} /> Posting</button></td> : <td className="bg-blue-50/30 px-3 py-2" />}
    </tr>);
  }

  function renderInlineRows(journal: JournalSummary) {
    const edit = inlineEdit?.id === journal.id ? inlineEdit : null;
    const displayRows = edit?.rows ?? toDraftRows(journal);
    const isEditing = Boolean(edit);
    if (singleLine) {
      const debitRow = edit?.rows[0] ?? emptyLine();
      const creditRow = edit?.rows[1] ?? emptyLine();
      const amount = debitRow.debit || creditRow.credit || String(journal.totalDebit / 100);
      return <tr key={`${journal.id}-single`}>
        <td className="border-r border-slate-100 px-3 py-3 align-top font-mono font-semibold tabular-nums">{journal.journalNo}</td>
        <td className="border-r border-slate-100 px-3 py-3 align-top">{isEditing ? <input aria-label={`Tanggal jurnal ${journal.journalNo}`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setInlineEdit((current) => current ? { ...current, entryDate: event.target.value } : current)} type="date" value={edit!.entryDate} /> : journal.entryDate}</td>
        <td className="border-r border-slate-100 px-3 py-3 align-top">{isEditing ? <><input aria-label={`Referensi jurnal ${journal.journalNo}`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setInlineEdit((current) => current ? { ...current, referenceNo: event.target.value } : current)} placeholder="No. referensi" value={edit!.referenceNo} /><input aria-label={`Memo jurnal ${journal.journalNo}`} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setInlineEdit((current) => current ? { ...current, memo: event.target.value } : current)} placeholder="Memo" value={edit!.memo} /></> : <><p>{journal.referenceNo || "—"}</p><p className="mt-1 text-xs text-slate-500">{journal.memo || "—"}</p></>}</td>
        <td className="px-3 py-3 align-top">{isEditing ? <input aria-label={`Akun debit ${journal.journalNo}`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" list="journal-accounts" onChange={(event) => inlineAccountChanged(0, event.target.value)} value={debitRow.accountQuery} /> : accountSummary(journal, "debit")}</td>
        <td className="px-3 py-3 align-top">{isEditing ? <input aria-label={`Akun kredit ${journal.journalNo}`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" list="journal-accounts" onChange={(event) => inlineAccountChanged(1, event.target.value)} value={creditRow.accountQuery} /> : accountSummary(journal, "credit")}</td>
        <td className="px-3 py-3 text-right align-top font-mono tabular-nums">{isEditing ? <input aria-label={`Nominal ${journal.journalNo}`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-right font-mono tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => { const value = event.target.value; setInlineEdit((current) => current ? { ...current, rows: current.rows.map((row, rowIndex) => rowIndex === 0 ? { ...row, debit: value, credit: "" } : rowIndex === 1 ? { ...row, debit: "", credit: value } : row) } : current); }} value={amount} /> : <JournalAmount value={journal.totalDebit} />}</td>
        <td className="px-3 py-3 align-top text-slate-600">{isEditing ? <input aria-label={`Keterangan ${journal.journalNo}`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => updateInlineRow(0, { description: event.target.value })} value={debitRow.description || creditRow.description} /> : journal.lines.map((line) => line.description).filter(Boolean).join(" · ") || "—"}</td>
        <td className="px-3 py-3 text-center align-top">{isEditing ? <div className="flex flex-col items-center gap-1"><button aria-label={`Simpan ${journal.journalNo}`} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50" disabled={saveMutation.isPending} onClick={submitInlineEdit} type="button"><Save size={13} /> Simpan</button><button aria-label={`Batal edit ${journal.journalNo}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600" onClick={() => setInlineEdit(null)} type="button"><X size={13} /> Batal</button></div> : <div className="flex flex-col items-center gap-1"><button aria-label={`Edit ${journal.journalNo}`} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-brand disabled:opacity-30" disabled={journal.sourceModule !== "GENERAL" || inlineEdit !== null} onClick={() => void startInlineEdit(journal)} type="button"><Pencil size={15} /></button><button aria-label={`Hapus ${journal.journalNo}`} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" disabled={journal.sourceModule !== "GENERAL" || removeMutation.isPending} onClick={() => removeMutation.mutate(journal.id)} type="button"><Trash2 size={15} /></button></div>}</td>
      </tr>;
    }
    return displayRows.map((row, index) => <tr className={singleLine && index % 2 ? "bg-slate-50/60" : ""} key={`${journal.id}-${index}`}>
      {(singleLine || index === 0) && <>
        <td className="border-r border-slate-100 px-3 py-3 align-top font-mono font-semibold tabular-nums" rowSpan={singleLine ? undefined : displayRows.length}>{journal.journalNo}</td>
        <td className="border-r border-slate-100 px-3 py-3 align-top" rowSpan={singleLine ? undefined : displayRows.length}>{isEditing ? <input aria-label={`Tanggal jurnal ${journal.journalNo}`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setInlineEdit((current) => current ? { ...current, entryDate: event.target.value } : current)} type="date" value={edit!.entryDate} /> : journal.entryDate}</td>
        <td className="border-r border-slate-100 px-3 py-3 align-top" rowSpan={singleLine ? undefined : displayRows.length}>{isEditing ? <><input aria-label={`Referensi jurnal ${journal.journalNo}`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setInlineEdit((current) => current ? { ...current, referenceNo: event.target.value } : current)} placeholder="No. referensi" value={edit!.referenceNo} /><input aria-label={`Memo jurnal ${journal.journalNo}`} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => setInlineEdit((current) => current ? { ...current, memo: event.target.value } : current)} placeholder="Memo" value={edit!.memo} /></> : <><p>{journal.referenceNo || "—"}</p><p className="mt-1 text-xs text-slate-500">{journal.memo || "—"}</p></>}</td>
      </>}
      {isEditing ? <>
        <td className="px-3 py-2"><div className="flex items-center gap-1"><input aria-label={`Akun ${journal.journalNo} baris ${index + 1}`} className={`min-w-0 flex-1 rounded-md border bg-transparent px-2 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-blue-100 ${row.accountQuery && !row.accountId ? "border-red-300" : "border-transparent hover:border-slate-200"}`} list="journal-accounts" onChange={(event) => inlineAccountChanged(index, event.target.value)} value={row.accountQuery} /><button aria-label={`Hapus baris ${journal.journalNo} ${index + 1}`} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" disabled={displayRows.length <= 2} onClick={() => removeInlineRow(index)} type="button"><Trash2 size={15} /></button></div></td>
        <td className="px-3 py-2"><input aria-label={`Keterangan ${journal.journalNo} baris ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onChange={(event) => updateInlineRow(index, { description: event.target.value })} value={row.description} /></td>
        <td className="px-3 py-2"><input aria-label={`Debit ${journal.journalNo} baris ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-right font-mono tabular-nums outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onBlur={(event) => updateInlineRow(index, { debit: formatAmount(event.currentTarget.value) })} onChange={(event) => updateInlineRow(index, { debit: event.target.value, credit: event.target.value ? "" : row.credit })} value={row.debit} /></td>
        <td className="px-3 py-2"><input aria-label={`Kredit ${journal.journalNo} baris ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-right font-mono tabular-nums outline-none hover:border-slate-200 focus:border-brand focus:ring-2 focus:ring-blue-100" onBlur={(event) => updateInlineRow(index, { credit: formatAmount(event.currentTarget.value) })} onChange={(event) => updateInlineRow(index, { credit: event.target.value, debit: event.target.value ? "" : row.debit })} value={row.credit} /></td>
      </> : <><td className="px-3 py-3 align-top"><p><span className="font-mono font-semibold">{journal.lines[index]?.accountCode}</span> · {journal.lines[index]?.accountName}</p></td><td className="px-3 py-3 align-top text-slate-600">{row.description || "—"}</td><td className="px-3 py-3 text-right align-top font-mono tabular-nums">{row.debit ? <JournalAmount value={journal.lines[index]!.debit} /> : "—"}</td><td className="px-3 py-3 text-right align-top font-mono tabular-nums">{row.credit ? <JournalAmount value={journal.lines[index]!.credit} /> : "—"}</td></>}
      {index === 0 ? <td className="px-3 py-3 text-center align-top" rowSpan={singleLine ? undefined : displayRows.length}>{isEditing ? <div className="flex flex-col items-center gap-1"><button aria-label={`Simpan ${journal.journalNo}`} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50" disabled={saveMutation.isPending} onClick={submitInlineEdit} type="button"><Save size={13} /> Simpan</button><button aria-label={`Tambah baris ${journal.journalNo}`} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-600" onClick={addInlineRow} type="button"><Plus size={13} /> Baris</button><button aria-label={`Batal edit ${journal.journalNo}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600" onClick={() => setInlineEdit(null)} type="button"><X size={13} /> Batal</button></div> : <div className="flex flex-col items-center gap-1"><button aria-label={`Edit ${journal.journalNo}`} className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-brand disabled:opacity-30" disabled={journal.sourceModule !== "GENERAL" || inlineEdit !== null} onClick={() => void startInlineEdit(journal)} type="button"><Pencil size={15} /></button><button aria-label={`Hapus ${journal.journalNo}`} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" disabled={journal.sourceModule !== "GENERAL" || removeMutation.isPending} onClick={() => removeMutation.mutate(journal.id)} type="button"><Trash2 size={15} /></button></div>}</td> : <td className="px-3 py-3" />}
    </tr>);
  }

  return <div className="space-y-5">
    {message && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">{message}</p>}
    <section className={`sticky bottom-3 z-20 flex flex-col gap-4 rounded-2xl border p-4 shadow-lg md:flex-row md:items-center md:justify-between ${totals.difference.isZero() && !hasInvalidRows ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><div className="grid grid-cols-3 gap-5 text-sm"><div><p className="text-xs text-slate-500">Draft · Total Debit</p><p className="mt-1 font-mono font-bold tabular-nums">Rp {formatSen(totals.debit.toNumber())}</p></div><div><p className="text-xs text-slate-500">Total Kredit</p><p className="mt-1 font-mono font-bold tabular-nums">Rp {formatSen(totals.credit.toNumber())}</p></div><div><p className="text-xs text-slate-500">Selisih</p><p className={`mt-1 font-mono font-bold tabular-nums ${totals.difference.isZero() && !hasInvalidRows ? "text-emerald-700" : "text-red-700"}`}>Rp {formatSen(totals.difference.toNumber())}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold ${totals.difference.isZero() && !hasInvalidRows ? "text-emerald-700" : "text-red-700"}`}>{totals.difference.isZero() && !hasInvalidRows ? <Check size={14} /> : <ChevronDown size={14} />} {totals.difference.isZero() && !hasInvalidRows ? "Seimbang" : "Belum seimbang"}</span><button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-40" disabled={!history.length} onClick={() => { const previous = history.at(-1); if (previous) { setHistory((current) => current.slice(0, -1)); setFuture((current) => [...current, rows]); setRows(previous); } }} type="button"><Undo2 size={15} /> Undo</button><button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-40" disabled={!future.length} onClick={() => { const next = future.at(-1); if (next) { setFuture((current) => current.slice(0, -1)); setHistory((current) => [...current, rows]); setRows(next); } }} type="button"><RotateCcw size={15} /> Redo</button><button className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canPost || saveMutation.isPending} onClick={submitJournal} type="button"><Save size={16} /> Posting Jurnal</button></div></section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Modul 2 · Double-entry</p><h2 className="mt-1 text-xl font-bold tracking-tight">Jurnal Umum</h2><p className="mt-1 text-xs text-muted">Grid jurnal: baris biru adalah draft baru. Jurnal tersimpan dan input detail berada di tabel yang sama.</p></div><div className="flex flex-wrap items-center gap-2"><div aria-label="Mode tampilan grid jurnal" className="inline-flex items-center rounded-lg border border-slate-200 p-1" role="group"><button aria-pressed={singleLine} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${singleLine ? "bg-blue-50 text-brand" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => setSingleLine(true)} type="button">1 line</button><button aria-pressed={!singleLine} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${!singleLine ? "bg-blue-50 text-brand" : "text-slate-500 hover:bg-slate-50"}`} onClick={() => setSingleLine(false)} type="button">2 line</button></div><button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600" onClick={newJournal} type="button"><Plus size={16} /> Jurnal baru</button><span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"><ClipboardPaste size={15} /> Excel paste siap</span><input aria-label="Filter jurnal mulai" className="rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /><input aria-label="Filter jurnal sampai" className="rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} /></div></div></div><div className="max-w-full overflow-x-auto"><table className="w-full min-w-[1420px] border-collapse text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">{renderTableHeader()}</thead><tbody className="divide-y divide-slate-50">{renderDraftRows()}{journalsQuery.isLoading ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={8}>Memuat jurnal...</td></tr> : journals.map((journal) => renderInlineRows(journal))}</tbody></table></div><datalist id="journal-accounts">{accounts.map((account) => <option key={account.id} value={`${account.code} · ${account.name}`} />)}</datalist><button className="m-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={addRow} type="button"><Plus size={15} /> Tambah baris draft</button></section>
  </div>;
}

export default GeneralJournalPage;
