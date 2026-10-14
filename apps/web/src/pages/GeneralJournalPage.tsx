import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Pencil, Plus, RotateCcw, Save, Trash2, Undo2, X } from "lucide-react";
import {
  JournalEntrySchema,
  parseRupiahToSen,
  senToRupiah,
  sumDebitCredit,
  todayIsoDate,
} from "@keuangan-apotek/shared";
import { createJournal, deleteJournal, updateJournal } from "../lib/mutations";
import { getAccounts, getJournals, queryKeys, type JournalSummary } from "../lib/queries";
import { toast } from "../lib/toast";

type Account = { id: string; code: string; name: string; isActive: boolean };
type DraftLine = {
  accountId: string;
  accountQuery: string;
  description: string;
  debit: string;
  credit: string;
};
type InlineJournalEdit = {
  id: string;
  entryDate: string;
  referenceNo: string;
  rows: DraftLine[];
};

const emptyLine = (): DraftLine => ({
  accountId: "",
  accountQuery: "",
  description: "",
  debit: "",
  credit: "",
});

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

type DatePreset = "ALL" | "THIS_MONTH" | "PREV_MONTH" | "THIS_YEAR" | "TODAY" | "CUSTOM";

function getDatePresetRange(preset: DatePreset): { startDate: string; endDate: string } {
  const today = todayIsoDate();
  const [yearStr, monthStr] = today.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (preset === "TODAY") {
    return { startDate: today, endDate: today };
  }
  if (preset === "THIS_MONTH") {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mm = String(month).padStart(2, "0");
    return {
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  if (preset === "PREV_MONTH") {
    const prevDate = new Date(Date.UTC(year, month - 2, 1));
    const prevYear = prevDate.getUTCFullYear();
    const prevMonth = prevDate.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const mm = String(prevMonth).padStart(2, "0");
    return {
      startDate: `${prevYear}-${mm}-01`,
      endDate: `${prevYear}-${mm}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  if (preset === "THIS_YEAR") {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }
  return { startDate: "", endDate: "" };
}

function GeneralJournalPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entryDate, setEntryDate] = useState(todayIsoDate());
  const [referenceNo, setReferenceNo] = useState("");
  const [rows, setRows] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [history, setHistory] = useState<DraftLine[][]>([]);
  const [future, setFuture] = useState<DraftLine[][]>([]);
  const [inlineEdit, setInlineEdit] = useState<InlineJournalEdit | null>(null);
  const [activePreset, setActivePreset] = useState<DatePreset>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const draftRowRef = useRef<HTMLTableRowElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const journalsQuery = useQuery({
    queryKey: queryKeys.journals({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    queryFn: () =>
      getJournals({ ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) }),
  });
  const journals = journalsQuery.data ?? [];

  useEffect(() => {
    setAccounts((accountsQuery.data ?? []).filter((account) => account.isActive));
  }, [accountsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string | null;
      input: Parameters<typeof createJournal>[0];
    }) => (id ? updateJournal(id, input) : createJournal(input)),
    onSuccess: async (_, variables) => {
      toast.success(variables.id ? "Jurnal berhasil diperbarui." : "Jurnal berhasil diposting.");
      if (variables.id) setInlineEdit(null);
      else resetDraft();
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Jurnal belum dapat disimpan"),
  });
  const removeMutation = useMutation({
    mutationFn: deleteJournal,
    onSuccess: async () => {
      toast.success("Jurnal dihapus.");
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Jurnal belum dapat dihapus"),
  });

  const totals = useMemo(() => {
    try {
      return sumDebitCredit(
        rows.map((row) => ({
          debit: parseRupiahToSen(row.debit || "0"),
          credit: parseRupiahToSen(row.credit || "0"),
        })),
      );
    } catch {
      return sumDebitCredit([{ debit: 1, credit: 0 }]);
    }
  }, [rows]);

  const hasInvalidRows = rows.some((row) => {
    const debit = row.debit.trim();
    const credit = row.credit.trim();
    return (debit && credit) || (debit && !parseable(debit)) || (credit && !parseable(credit));
  });
  const populatedRows = rows.filter(
    (row) => row.accountId && (row.debit.trim() || row.credit.trim()),
  );
  const canPost = !hasInvalidRows && populatedRows.length >= 2 && totals.difference.isZero();

  function parseable(value: string): boolean {
    try {
      parseRupiahToSen(value);
      return true;
    } catch {
      return false;
    }
  }

  function resetDraft() {
    setEntryDate(todayIsoDate());
    setReferenceNo("");
    setRows([emptyLine(), emptyLine()]);
    setHistory([]);
    setFuture([]);
  }

  function applyPreset(preset: DatePreset) {
    setActivePreset(preset);
    const range = getDatePresetRange(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  function newJournal() {
    setInlineEdit(null);
    resetDraft();
    toast.info("Draft jurnal baru siap diisi.");
    window.setTimeout(() => {
      draftRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      inputRefs.current["0:account"]?.focus();
    }, 50);
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
    commitRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    commitRows((current) => [...current, emptyLine()]);
  }

  function removeRow(index: number) {
    if (rows.length <= 2) return;
    commitRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function moveFocus(rowIndex: number, column: "account" | "description" | "debit" | "credit") {
    inputRefs.current[`${rowIndex}:${column}`]?.focus();
  }

  function handleCellKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    column: "account" | "description" | "debit" | "credit",
  ) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      const previous = history.at(-1);
      if (previous) {
        setHistory((current) => current.slice(0, -1));
        setFuture((current) => [...current, rows]);
        setRows(previous);
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      const next = future.at(-1);
      if (next) {
        setFuture((current) => current.slice(0, -1));
        setHistory((current) => [...current, rows]);
        setRows(next);
      }
      return;
    }
    if (event.key === "Escape") {
      event.currentTarget.blur();
      return;
    }
    if (
      event.key === "Tab" &&
      !event.shiftKey &&
      column === "credit" &&
      rowIndex === rows.length - 1
    ) {
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
    return accounts.find(
      (account) =>
        account.code === normalized ||
        `${account.code} · ${account.name}` === normalized ||
        account.name.toLowerCase() === normalized.toLowerCase(),
    );
  }

  function accountChanged(index: number, value: string) {
    const account = findAccount(value);
    updateRow(index, { accountQuery: value, accountId: account?.id ?? "" });
  }

  function updateInlineRow(index: number, patch: Partial<DraftLine>) {
    setInlineEdit((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row, rowIndex) =>
              rowIndex === index ? { ...row, ...patch } : row,
            ),
          }
        : current,
    );
  }

  function addInlineRow() {
    setInlineEdit((current) =>
      current ? { ...current, rows: [...current.rows, emptyLine()] } : current,
    );
  }

  function removeInlineRow(index: number) {
    setInlineEdit((current) =>
      current && current.rows.length > 2
        ? { ...current, rows: current.rows.filter((_, rowIndex) => rowIndex !== index) }
        : current,
    );
  }

  function inlineAccountChanged(index: number, value: string) {
    const account = findAccount(value);
    updateInlineRow(index, { accountQuery: value, accountId: account?.id ?? "" });
  }

  function pasteRows(event: ClipboardEvent<HTMLInputElement>, startIndex: number) {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.includes("\t") && !pasted.includes("\n")) return;
    event.preventDefault();
    const pastedRows = pasted
      .trimEnd()
      .split(/\r?\n/)
      .map((line) => line.split("\t"));
    commitRows((current) => {
      const next = [...current];
      pastedRows.forEach((values, offset) => {
        const rowIndex = startIndex + offset;
        const [accountQuery = "", description = "", debit = "", credit = ""] = values;
        const account = findAccount(accountQuery);
        next[rowIndex] = {
          accountId: account?.id ?? "",
          accountQuery: accountQuery.trim(),
          description: description.trim(),
          debit: debit.trim(),
          credit: credit.trim(),
        };
      });
      while (next.length < startIndex + pastedRows.length) next.push(emptyLine());
      return next;
    });
  }

  async function startInlineEdit(journal: JournalSummary) {
    if (journal.sourceModule !== "GENERAL") return;
    setInlineEdit({
      id: journal.id,
      entryDate: journal.entryDate,
      referenceNo: journal.referenceNo ?? "",
      rows: toDraftRows(journal),
    });
  }

  function buildInput(edit: InlineJournalEdit | null) {
    const sourceRows = edit ? edit.rows : rows;
    const resolvedRows = sourceRows
      .filter((row) => row.accountId && (row.debit.trim() || row.credit.trim()))
      .map((row) => {
        const account = findAccount(row.accountQuery);
        return {
          accountId: account?.id ?? row.accountId,
          description: row.description,
          debit: row.debit || "0",
          credit: row.credit || "0",
        };
      });
    return JournalEntrySchema.safeParse({
      entryDate: edit?.entryDate ?? entryDate,
      referenceNo: edit?.referenceNo ?? referenceNo,
      lines: resolvedRows,
    });
  }

  function submitJournal() {
    const parsed = buildInput(null);
    if (!parsed.success) {
      toast.error(parsed.error.issues.map((issue) => issue.message).join("; "));
      return;
    }
    saveMutation.mutate({ id: null, input: parsed.data });
  }

  function submitInlineEdit() {
    if (!inlineEdit) return;
    const parsed = buildInput(inlineEdit);
    if (!parsed.success) {
      toast.error(parsed.error.issues.map((issue) => issue.message).join("; "));
      return;
    }
    saveMutation.mutate({ id: inlineEdit.id, input: parsed.data });
  }

  function renderTableHeader() {
    return (
      <tr>
        <th className="w-28 px-2 py-1 border-r border-slate-200">Tanggal</th>
        <th className="w-36 px-2 py-1 border-r border-slate-200">Referensi</th>
        <th className="min-w-[200px] px-2 py-1 border-r border-slate-200">Akun</th>
        <th className="min-w-[160px] px-2 py-1 border-r border-slate-200">Keterangan</th>
        <th className="w-36 px-2 py-1 text-right border-r border-slate-200">Debit (Rp)</th>
        <th className="w-36 px-2 py-1 text-right border-r border-slate-200">Kredit (Rp)</th>
        <th className="w-20 px-2 py-1 text-center">Aksi</th>
      </tr>
    );
  }

  function renderDraftRows() {
    return rows.map((row, index) => (
      <tr
        key={`draft-${index}`}
        ref={index === 0 ? draftRowRef : undefined}
        className="bg-blue-50/40"
      >
        {index === 0 && (
          <>
            <td
              className="border-r border-blue-200 bg-blue-50/70 px-2 py-1 align-top"
              rowSpan={rows.length}
            >
              <input
                aria-label="Tanggal jurnal draft"
                className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs tabular-nums outline-none focus:border-brand"
                onChange={(event) => setEntryDate(event.target.value)}
                type="date"
                value={entryDate}
              />
            </td>
            <td
              className="border-r border-blue-200 bg-blue-50/70 px-2 py-1 align-top"
              rowSpan={rows.length}
            >
              <input
                aria-label="Referensi jurnal draft"
                className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand"
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="No. referensi"
                value={referenceNo}
              />
            </td>
          </>
        )}
        <td className="px-2 py-1 border-r border-slate-200">
          <div className="flex items-center gap-1">
            <input
              aria-label={`Akun baris ${index + 1}`}
              className={`min-w-0 flex-1 h-6 rounded border bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand ${row.accountQuery && !row.accountId ? "border-red-300" : "border-slate-200"}`}
              list="journal-accounts"
              onChange={(event) => accountChanged(index, event.target.value)}
              onKeyDown={(event) => handleCellKeyDown(event, index, "account")}
              onPaste={(event) => pasteRows(event, index)}
              ref={(element) => {
                inputRefs.current[`${index}:account`] = element;
              }}
              value={row.accountQuery}
              placeholder="Kode / nama akun..."
            />
            <button
              aria-label={`Hapus baris draft ${index + 1}`}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              disabled={rows.length <= 2}
              onClick={() => removeRow(index)}
              type="button"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
        <td className="px-2 py-1 border-r border-slate-200">
          <input
            aria-label={`Keterangan baris ${index + 1}`}
            className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand"
            onChange={(event) => updateRow(index, { description: event.target.value })}
            onKeyDown={(event) => handleCellKeyDown(event, index, "description")}
            ref={(element) => {
              inputRefs.current[`${index}:description`] = element;
            }}
            value={row.description}
            placeholder="Uraian baris"
          />
        </td>
        <td className="px-2 py-1 border-r border-slate-200">
          <input
            aria-label={`Debit baris ${index + 1}`}
            className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right font-mono text-xs tabular-nums outline-none focus:border-brand"
            onBlur={(event) => updateRow(index, { debit: formatAmount(event.currentTarget.value) })}
            onChange={(event) =>
              updateRow(index, {
                debit: event.target.value,
                credit: event.target.value ? "" : row.credit,
              })
            }
            onKeyDown={(event) => handleCellKeyDown(event, index, "debit")}
            ref={(element) => {
              inputRefs.current[`${index}:debit`] = element;
            }}
            value={row.debit}
            placeholder="0,00"
          />
        </td>
        <td className="px-2 py-1 border-r border-slate-200">
          <input
            aria-label={`Kredit baris ${index + 1}`}
            className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right font-mono text-xs tabular-nums outline-none focus:border-brand"
            onBlur={(event) =>
              updateRow(index, { credit: formatAmount(event.currentTarget.value) })
            }
            onChange={(event) =>
              updateRow(index, {
                credit: event.target.value,
                debit: event.target.value ? "" : row.debit,
              })
            }
            onKeyDown={(event) => handleCellKeyDown(event, index, "credit")}
            ref={(element) => {
              inputRefs.current[`${index}:credit`] = element;
            }}
            value={row.credit}
            placeholder="0,00"
          />
        </td>
        {index === 0 ? (
          <td
            className="bg-blue-50/70 px-2 py-1 text-center align-top border-r border-blue-200"
            rowSpan={rows.length}
          >
            <div className="flex flex-col items-center gap-1">
              <button
                className="inline-flex items-center gap-1 rounded bg-brand px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                disabled={!canPost || saveMutation.isPending}
                onClick={submitJournal}
                type="button"
              >
                <Save size={12} /> Posting
              </button>
              <button
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-brand hover:bg-blue-50"
                onClick={addRow}
                type="button"
              >
                <Plus size={11} /> Baris
              </button>
            </div>
          </td>
        ) : (
          <td className="bg-blue-50/30 px-2 py-1" />
        )}
      </tr>
    ));
  }

  function renderInlineRows(journal: JournalSummary) {
    const edit = inlineEdit?.id === journal.id ? inlineEdit : null;
    const displayRows = edit?.rows ?? toDraftRows(journal);
    const isEditing = Boolean(edit);

    return displayRows.map((row, index) => (
      <tr
        key={`${journal.id}-${index}`}
        className={
          isEditing
            ? "bg-amber-50/60"
            : index % 2 === 0
              ? "bg-white hover:bg-blue-50/30"
              : "bg-slate-50/60 hover:bg-blue-50/30"
        }
      >
        {index === 0 && (
          <>
            <td
              className="border-r border-slate-200 px-2 py-1 align-top tabular-nums text-xs"
              rowSpan={displayRows.length}
            >
              {isEditing ? (
                <input
                  aria-label={`Tanggal jurnal ${journal.journalNo}`}
                  className="w-full h-6 rounded border border-slate-200 px-1.5 py-0.5 text-xs tabular-nums outline-none focus:border-brand"
                  onChange={(event) =>
                    setInlineEdit((current) =>
                      current ? { ...current, entryDate: event.target.value } : current,
                    )
                  }
                  type="date"
                  value={edit!.entryDate}
                />
              ) : (
                journal.entryDate
              )}
            </td>
            <td
              className="border-r border-slate-200 px-2 py-1 align-top text-xs"
              rowSpan={displayRows.length}
            >
              {isEditing ? (
                <input
                  aria-label={`Referensi jurnal ${journal.journalNo}`}
                  className="w-full h-6 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand"
                  onChange={(event) =>
                    setInlineEdit((current) =>
                      current ? { ...current, referenceNo: event.target.value } : current,
                    )
                  }
                  placeholder="No. referensi"
                  value={edit!.referenceNo}
                />
              ) : (
                <p className="truncate">{journal.referenceNo || "—"}</p>
              )}
            </td>
          </>
        )}
        {isEditing ? (
          <>
            <td className="px-2 py-1 border-r border-slate-200">
              <div className="flex items-center gap-1">
                <input
                  aria-label={`Akun ${journal.journalNo} baris ${index + 1}`}
                  className={`min-w-0 flex-1 h-6 rounded border bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand ${row.accountQuery && !row.accountId ? "border-red-300" : "border-slate-200"}`}
                  list="journal-accounts"
                  onChange={(event) => inlineAccountChanged(index, event.target.value)}
                  value={row.accountQuery}
                />
                <button
                  aria-label={`Hapus baris ${journal.journalNo} ${index + 1}`}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  disabled={displayRows.length <= 2}
                  onClick={() => removeInlineRow(index)}
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </td>
            <td className="px-2 py-1 border-r border-slate-200">
              <input
                aria-label={`Keterangan ${journal.journalNo} baris ${index + 1}`}
                className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand"
                onChange={(event) => updateInlineRow(index, { description: event.target.value })}
                value={row.description}
              />
            </td>
            <td className="px-2 py-1 border-r border-slate-200">
              <input
                aria-label={`Debit ${journal.journalNo} baris ${index + 1}`}
                className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right font-mono text-xs tabular-nums outline-none focus:border-brand"
                onBlur={(event) =>
                  updateInlineRow(index, { debit: formatAmount(event.currentTarget.value) })
                }
                onChange={(event) =>
                  updateInlineRow(index, {
                    debit: event.target.value,
                    credit: event.target.value ? "" : row.credit,
                  })
                }
                value={row.debit}
              />
            </td>
            <td className="px-2 py-1 border-r border-slate-200">
              <input
                aria-label={`Kredit ${journal.journalNo} baris ${index + 1}`}
                className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right font-mono text-xs tabular-nums outline-none focus:border-brand"
                onBlur={(event) =>
                  updateInlineRow(index, { credit: formatAmount(event.currentTarget.value) })
                }
                onChange={(event) =>
                  updateInlineRow(index, {
                    credit: event.target.value,
                    debit: event.target.value ? "" : row.debit,
                  })
                }
                value={row.credit}
              />
            </td>
          </>
        ) : (
          <>
            <td className="px-2 py-1 align-top border-r border-slate-100 text-xs">
              <p className="truncate">
                <span className="font-mono font-semibold tabular-nums">
                  {journal.lines[index]?.accountCode}
                </span>{" "}
                · {journal.lines[index]?.accountName}
              </p>
            </td>
            <td className="px-2 py-1 align-top text-slate-600 border-r border-slate-100 text-xs truncate">
              {row.description || "—"}
            </td>
            <td className="px-2 py-1 text-right align-top font-mono text-xs tabular-nums border-r border-slate-100">
              {row.debit ? <JournalAmount value={journal.lines[index]!.debit} /> : "—"}
            </td>
            <td className="px-2 py-1 text-right align-top font-mono text-xs tabular-nums border-r border-slate-100">
              {row.credit ? <JournalAmount value={journal.lines[index]!.credit} /> : "—"}
            </td>
          </>
        )}
        {index === 0 ? (
          <td className="px-2 py-1 text-center align-top" rowSpan={displayRows.length}>
            {isEditing ? (
              <div className="flex flex-col items-center gap-0.5">
                <button
                  aria-label={`Simpan ${journal.journalNo}`}
                  className="inline-flex items-center gap-1 rounded bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50"
                  disabled={saveMutation.isPending}
                  onClick={submitInlineEdit}
                  type="button"
                >
                  <Save size={11} /> Simpan
                </button>
                <button
                  aria-label={`Tambah baris ${journal.journalNo}`}
                  className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600"
                  onClick={addInlineRow}
                  type="button"
                >
                  <Plus size={11} /> Baris
                </button>
                <button
                  aria-label={`Batal edit ${journal.journalNo}`}
                  className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600"
                  onClick={() => setInlineEdit(null)}
                  type="button"
                >
                  <X size={11} /> Batal
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-0.5">
                <button
                  aria-label={`Edit ${journal.journalNo}`}
                  className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-brand disabled:opacity-30"
                  disabled={journal.sourceModule !== "GENERAL" || inlineEdit !== null}
                  onClick={() => void startInlineEdit(journal)}
                  type="button"
                >
                  <Pencil size={12} />
                </button>
                <button
                  aria-label={`Hapus ${journal.journalNo}`}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  disabled={journal.sourceModule !== "GENERAL" || removeMutation.isPending}
                  onClick={() => removeMutation.mutate(journal.id)}
                  type="button"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </td>
        ) : (
          <td className="px-2 py-1" />
        )}
      </tr>
    ));
  }

  return (
    <div className="space-y-1.5 text-xs">
      {/* Main Table Section */}
      <section className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-1">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900 tracking-tight">
                Jurnal Umum (Double-Entry)
              </h2>
              <span className="text-[11px] text-muted hidden sm:inline">
                Pencatatan multibaris debit & kredit terpisah
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                className="inline-flex items-center gap-1 rounded bg-brand px-2 py-0.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                onClick={newJournal}
                type="button"
              >
                <Plus size={12} /> Jurnal baru
              </button>
              <div
                aria-label="Filter periode preset"
                className="inline-flex items-center rounded border border-slate-200 bg-slate-50 p-0.5"
                role="group"
              >
                <button
                  className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${activePreset === "THIS_MONTH" ? "bg-white font-semibold text-brand shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                  onClick={() => applyPreset("THIS_MONTH")}
                  type="button"
                >
                  Bulan ini
                </button>
                <button
                  className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${activePreset === "PREV_MONTH" ? "bg-white font-semibold text-brand shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                  onClick={() => applyPreset("PREV_MONTH")}
                  type="button"
                >
                  Bulan lalu
                </button>
                <button
                  className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${activePreset === "THIS_YEAR" ? "bg-white font-semibold text-brand shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                  onClick={() => applyPreset("THIS_YEAR")}
                  type="button"
                >
                  Tahun ini
                </button>
                <button
                  className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${activePreset === "ALL" ? "bg-white font-semibold text-brand shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                  onClick={() => applyPreset("ALL")}
                  type="button"
                >
                  Semua
                </button>
              </div>
              <div className="flex items-center gap-1">
                <input
                  aria-label="Filter jurnal mulai"
                  className="rounded border border-slate-200 px-1 py-0.5 text-xs tabular-nums outline-none focus:border-brand"
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setActivePreset("CUSTOM");
                  }}
                  type="date"
                  value={startDate}
                />
                <span className="text-[10px] text-slate-400">s/d</span>
                <input
                  aria-label="Filter jurnal sampai"
                  className="rounded border border-slate-200 px-1 py-0.5 text-xs tabular-nums outline-none focus:border-brand"
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setActivePreset("CUSTOM");
                  }}
                  type="date"
                  value={endDate}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-left text-[11px] font-semibold text-slate-700">
              {renderTableHeader()}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {renderDraftRows()}
              {journalsQuery.isLoading ? (
                <tr>
                  <td className="px-2 py-6 text-center text-muted" colSpan={7}>
                    Memuat jurnal...
                  </td>
                </tr>
              ) : (
                journals.map((journal) => renderInlineRows(journal))
              )}
            </tbody>
          </table>
        </div>
        <datalist id="journal-accounts">
          {accounts.map((account) => (
            <option key={account.id} value={`${account.code} · ${account.name}`} />
          ))}
        </datalist>
      </section>

      {/* Sticky Compact Balance Summary Bar */}
      <section
        className={`sticky bottom-1 z-20 flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1 text-xs ${totals.difference.isZero() && !hasInvalidRows ? "border-emerald-200 bg-emerald-50/90" : "border-red-200 bg-red-50/90"}`}
      >
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Draft Debit:</span>
            <span className="font-mono font-bold tabular-nums">
              Rp {formatSen(totals.debit.toNumber())}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Draft Kredit:</span>
            <span className="font-mono font-bold tabular-nums">
              Rp {formatSen(totals.credit.toNumber())}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Selisih:</span>
            <span
              className={`font-mono font-bold tabular-nums ${totals.difference.isZero() && !hasInvalidRows ? "text-emerald-700" : "text-red-700"}`}
            >
              Rp {formatSen(totals.difference.toNumber())}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${totals.difference.isZero() && !hasInvalidRows ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
          >
            {totals.difference.isZero() && !hasInvalidRows ? (
              <Check size={11} />
            ) : (
              <ChevronDown size={11} />
            )}
            {totals.difference.isZero() && !hasInvalidRows ? "Seimbang" : "Belum seimbang"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            disabled={!history.length}
            onClick={() => {
              const previous = history.at(-1);
              if (previous) {
                setHistory((current) => current.slice(0, -1));
                setFuture((current) => [...current, rows]);
                setRows(previous);
              }
            }}
            type="button"
          >
            <Undo2 size={12} /> Undo
          </button>
          <button
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            disabled={!future.length}
            onClick={() => {
              const next = future.at(-1);
              if (next) {
                setFuture((current) => current.slice(0, -1));
                setHistory((current) => [...current, rows]);
                setRows(next);
              }
            }}
            type="button"
          >
            <RotateCcw size={12} /> Redo
          </button>
          <button
            className="inline-flex items-center gap-1 rounded bg-brand px-3 py-0.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-blue-700"
            disabled={!canPost || saveMutation.isPending}
            onClick={submitJournal}
            type="button"
          >
            <Save size={12} /> Posting Jurnal
          </button>
        </div>
      </section>
    </div>
  );
}

export default GeneralJournalPage;
