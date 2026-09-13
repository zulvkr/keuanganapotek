import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calculatePpn, parseRupiahToSen, senToRupiah, todayIsoDate } from "@keuangan-apotek/shared";
import { api, type RpcRequest } from "../lib/api";
import {
  createCashBankTransfer,
  createConsignmentItem,
  createConsignmentVendor,
  createPbfInvoice,
  createPosClearing,
  deletePosClearing,
  invalidateAccountingQueries,
  settleConsignment,
  updatePosClearing,
} from "../lib/mutations";
import {
  getAccounts,
  getCashiers,
  getCashBankSummary,
  getCashBankTransfers,
  getConsignmentItems,
  getPbfInvoices,
  getPaymentMethods,
  getPosClearings,
  getShifts,
  queryKeys,
  type PosClearing,
  type PosPaymentMethod,
  type Cashier,
  type Shift,
} from "../lib/queries";

type PbfPost = (typeof api.api)["pbf-invoices"]["$post"];
type CashBankPost = (typeof api.api)["cash-bank"]["transfers"]["$post"];
type PbfInput = RpcRequest<PbfPost>["json"];
type CashBankInput = RpcRequest<CashBankPost>["json"];
const money = (value: number | string) => {
  try {
    const fixed = senToRupiah(typeof value === "number" ? value : parseRupiahToSen(value)).toFixed(
      2,
    );
    const [whole, fraction] = fixed.split(".");
    return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
  } catch {
    return String(value);
  }
};
const amount = (value: string) => {
  try {
    return parseRupiahToSen(value);
  } catch {
    return 0;
  }
};
const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100";
const tableClass = "w-full min-w-[980px] text-sm";
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {children}
    </section>
  );
}
function Header({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </div>
  );
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      role="status"
    >
      {message}
    </p>
  ) : null;
}

type PosDraft = {
  clearingDate: string;
  shiftName: string;
  cashierName: string;
  cogsAmount: string;
  payments: Record<string, string>;
};

function emptyPosDraft(methods: Array<{ id: string }>): PosDraft {
  return {
    clearingDate: todayIsoDate(),
    shiftName: "",
    cashierName: "",
    cogsAmount: "",
    payments: Object.fromEntries(methods.map((method) => [method.id, ""])),
  };
}

function storedPosPayment(row: PosClearing, method: PosPaymentMethod) {
  const payment = row.payments?.find((item) => item.paymentMethodId === method.id);
  return (
    payment?.amount ??
    (method.code === "TUNAI"
      ? row.cashReceived
      : method.code === "QRIS_EDC"
        ? row.nonCashReceived
        : 0)
  );
}

function posDraftFromRow(row: PosClearing, methods: PosPaymentMethod[]): PosDraft {
  return {
    clearingDate: row.clearingDate,
    shiftName: row.shiftName ?? "",
    cashierName: row.cashierName ?? "",
    cogsAmount: row.cogsAmount ? money(row.cogsAmount) : "",
    payments: Object.fromEntries(
      methods.map((method) => [
        method.id,
        storedPosPayment(row, method) ? money(storedPosPayment(row, method)) : "",
      ]),
    ),
  };
}

function posInput(draft: PosDraft, methods: PosPaymentMethod[]) {
  const totalPosOmzet = methods.reduce(
    (sum, method) => sum + amount(draft.payments[method.id] ?? ""),
    0,
  );
  return {
    clearingDate: draft.clearingDate,
    shiftName: draft.shiftName,
    cashierName: draft.cashierName,
    totalPosOmzet: senToRupiah(totalPosOmzet).toFixed(2),
    cogsAmount: draft.cogsAmount || "0",
    payments: methods.map((method) => ({
      paymentMethodId: method.id,
      amount: draft.payments[method.id] || "0",
    })),
  };
}

function PosDraftRow({
  draft,
  rowLabel,
  methods,
  cashiers,
  shifts,
  onChange,
  action,
  status = "EDIT",
  className = "border-b border-blue-100 bg-blue-50/40",
}: {
  draft: PosDraft;
  rowLabel: string;
  methods: PosPaymentMethod[];
  cashiers: Cashier[];
  shifts: Shift[];
  onChange: (patch: Partial<PosDraft>) => void;
  action: React.ReactNode;
  status?: string;
  className?: string;
}) {
  return (
    <tr className={className}>
      <td className="px-2 py-2">
        <input
          aria-label={`Tanggal ${rowLabel}`}
          className={`${inputClass} min-w-[140px] tabular-nums`}
          type="date"
          value={draft.clearingDate}
          onChange={(e) => onChange({ clearingDate: e.target.value })}
        />
      </td>
      <td className="px-2 py-2">
        <select
          aria-label={`Kasir ${rowLabel}`}
          className={`${inputClass} min-w-[140px]`}
          value={draft.cashierName}
          onChange={(e) => onChange({ cashierName: e.target.value })}
        >
          <option value="">Pilih kasir</option>
          {cashiers
            .filter((cashier) => cashier.isActive)
            .map((cashier) => (
              <option key={cashier.id} value={cashier.name}>
                {cashier.name}
              </option>
            ))}
          {draft.cashierName && !cashiers.some((cashier) => cashier.name === draft.cashierName) && (
            <option value={draft.cashierName}>{draft.cashierName} (tersimpan)</option>
          )}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          aria-label={`Shift ${rowLabel}`}
          className={`${inputClass} min-w-[100px]`}
          value={draft.shiftName}
          onChange={(e) => onChange({ shiftName: e.target.value })}
        >
          <option value="">Pilih shift</option>
          {shifts
            .filter((shift) => shift.isActive)
            .map((shift) => (
              <option key={shift.id} value={shift.name}>
                {shift.name}
              </option>
            ))}
          {draft.shiftName && !shifts.some((shift) => shift.name === draft.shiftName) && (
            <option value={draft.shiftName}>{draft.shiftName} (tersimpan)</option>
          )}
        </select>
      </td>
      {methods.map((method) => (
        <td className="px-2 py-2" key={method.id}>
          <input
            aria-label={`${method.name} ${rowLabel}`}
            className={`${inputClass} min-w-[140px] text-right font-mono tabular-nums`}
            placeholder="0"
            value={draft.payments[method.id] ?? ""}
            onChange={(e) =>
              onChange({ payments: { ...draft.payments, [method.id]: e.target.value } })
            }
          />
        </td>
      ))}
      <td className="px-2 py-2">
        <input
          aria-label={`HPP ${rowLabel}`}
          className={`${inputClass} min-w-[140px] text-right font-mono tabular-nums`}
          placeholder="0"
          value={draft.cogsAmount}
          onChange={(e) => onChange({ cogsAmount: e.target.value })}
        />
      </td>
      <td className="px-2 py-2 text-xs font-medium text-brand">{status}</td>
      <td className="px-2 py-2 text-right">{action}</td>
    </tr>
  );
}

export function POSClearingPage() {
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<PosDraft[]>([emptyPosDraft([])]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<PosDraft | null>(null);
  const queryClient = useQueryClient();
  const rowsQuery = useQuery({ queryKey: queryKeys.posClearings, queryFn: getPosClearings });
  const methodsQuery = useQuery({ queryKey: queryKeys.paymentMethods, queryFn: getPaymentMethods });
  const cashiersQuery = useQuery({ queryKey: queryKeys.cashiers, queryFn: getCashiers });
  const shiftsQuery = useQuery({ queryKey: queryKeys.shifts, queryFn: getShifts });
  const rows = rowsQuery.data ?? [];
  const methods = methodsQuery.data ?? [];
  const cashiers = cashiersQuery.data ?? [];
  const shifts = shiftsQuery.data ?? [];
  const activeMethods = methods
    .filter((method) => method.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  useEffect(() => {
    setDrafts((current) =>
      current.map((draft) => ({
        ...draft,
        payments: Object.fromEntries(
          activeMethods.map((method) => [method.id, draft.payments[method.id] ?? ""]),
        ),
      })),
    );
  }, [methods]);

  const saveMutation = useMutation({
    mutationFn: async (items: PosDraft[]) => {
      for (const draft of items) {
        await createPosClearing(posInput(draft, activeMethods));
      }
    },
    onSuccess: async () => {
      setMessage("Rekap POS tersimpan dan jurnal berhasil dibuat.");
      setDrafts([emptyPosDraft(activeMethods)]);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Rekap belum tersimpan"),
  });
  const saveRowMutation = useMutation({
    mutationFn: ({ draft }: { index: number; draft: PosDraft }) =>
      createPosClearing(posInput(draft, activeMethods)),
    onSuccess: async (_, variables) => {
      setMessage("Rekap POS tersimpan dan jurnal berhasil dibuat.");
      setDrafts((current) => {
        const remaining = current.filter((_, index) => index !== variables.index);
        return remaining.length > 0 ? remaining : [emptyPosDraft(activeMethods)];
      });
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Rekap POS belum tersimpan"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: PosDraft }) =>
      updatePosClearing(id, posInput(draft, activeMethods)),
    onSuccess: async () => {
      setMessage("Rekap POS dan jurnal berhasil diperbarui.");
      setEditingId(null);
      setEditingDraft(null);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Rekap POS belum diperbarui"),
  });
  const deleteMutation = useMutation({
    mutationFn: deletePosClearing,
    onSuccess: async () => {
      setMessage("Rekap POS dan jurnal berhasil dihapus.");
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Rekap POS belum dihapus"),
  });

  function updateDraft(index: number, patch: Partial<PosDraft>) {
    setDrafts((current) =>
      current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)),
    );
  }

  function startEdit(row: PosClearing) {
    setEditingId(row.id);
    setEditingDraft(posDraftFromRow(row, activeMethods));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingDraft(null);
  }

  function saveEdit() {
    if (!editingId || !editingDraft) return;
    if (!editingDraft.clearingDate) {
      setMessage("Tanggal wajib diisi.");
      return;
    }
    if (
      !activeMethods.some((method) => editingDraft.payments[method.id]?.trim()) &&
      !editingDraft.cogsAmount.trim()
    ) {
      setMessage("Isi minimal satu penerimaan atau nilai HPP pada baris ini.");
      return;
    }
    updateMutation.mutate({ id: editingId, draft: editingDraft });
  }

  function removeRow(row: PosClearing) {
    if (!window.confirm(`Hapus rekap POS tanggal ${row.clearingDate} beserta jurnalnya?`)) return;
    deleteMutation.mutate(row.id);
  }

  function saveDrafts() {
    if (activeMethods.length === 0) {
      setMessage("Aktifkan minimal satu metode pembayaran POS.");
      return;
    }
    const readyDrafts = drafts.filter(
      (draft) =>
        draft.clearingDate &&
        (activeMethods.some((method) => draft.payments[method.id]?.trim()) ||
          draft.cogsAmount.trim()),
    );
    if (readyDrafts.length === 0) {
      setMessage("Isi minimal satu penerimaan atau nilai HPP pada satu baris.");
      return;
    }
    saveMutation.mutate(readyDrafts);
  }

  function saveRow(index: number) {
    if (activeMethods.length === 0) {
      setMessage("Aktifkan minimal satu metode pembayaran POS.");
      return;
    }
    const draft = drafts[index];
    if (!draft || !draft.clearingDate) {
      setMessage("Tanggal wajib diisi.");
      return;
    }
    if (
      !activeMethods.some((method) => draft.payments[method.id]?.trim()) &&
      !draft.cogsAmount.trim()
    ) {
      setMessage("Isi minimal satu penerimaan atau nilai HPP pada baris ini.");
      return;
    }
    saveRowMutation.mutate({ index, draft });
  }

  return (
    <div className="space-y-5">
      <ErrorMessage
        message={
          message ||
          (rowsQuery.error instanceof Error
            ? rowsQuery.error.message
            : methodsQuery.error instanceof Error
              ? methodsQuery.error.message
              : cashiersQuery.error instanceof Error
                ? cashiersQuery.error.message
                : shiftsQuery.error instanceof Error
                  ? shiftsQuery.error.message
                  : "")
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
            onClick={() => setDrafts((current) => [...current, emptyPosDraft(activeMethods)])}
            type="button"
          >
            + Tambah baris
          </button>
          <button
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={saveMutation.isPending || activeMethods.length === 0}
            onClick={saveDrafts}
            type="button"
          >
            {saveMutation.isPending ? "Menyimpan…" : "Simpan semua baris"}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className={tableClass}>
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-2 py-3">Tanggal</th>
                <th className="px-2 py-3">Kasir</th>
                <th className="px-2 py-3">Shift</th>
                {activeMethods.map((method) => (
                  <th className="px-2 py-3 text-right" key={method.id}>
                    <span className="whitespace-nowrap">{method.name}</span>
                    <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal">
                      {method.accountCode} · {method.accountName}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-3 text-right">HPP harian</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft, index) => (
                <PosDraftRow
                  action={
                    <div className="flex justify-end gap-1">
                      <button
                        className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                        disabled={saveRowMutation.isPending}
                        onClick={() => saveRow(index)}
                        type="button"
                      >
                        Simpan
                      </button>
                      {drafts.length > 1 && (
                        <button
                          className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                          onClick={() =>
                            setDrafts((current) => current.filter((_, i) => i !== index))
                          }
                          type="button"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  }
                  cashiers={cashiers}
                  draft={draft}
                  key={`draft-${index}`}
                  methods={activeMethods}
                  onChange={(patch) => updateDraft(index, patch)}
                  rowLabel={`POS draft baris ${index + 1}`}
                  shifts={shifts}
                  status="DRAFT"
                />
              ))}
              {rows.map((row) =>
                editingId === row.id && editingDraft ? (
                  <PosDraftRow
                    action={
                      <div className="flex justify-end gap-1">
                        <button
                          className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                          disabled={updateMutation.isPending}
                          onClick={saveEdit}
                          type="button"
                        >
                          Simpan
                        </button>
                        <button
                          className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                          onClick={cancelEdit}
                          type="button"
                        >
                          Batal
                        </button>
                      </div>
                    }
                    className="border-b border-amber-100 bg-amber-50/50"
                    cashiers={cashiers}
                    draft={editingDraft}
                    key={row.id}
                    methods={activeMethods}
                    onChange={(patch) => setEditingDraft({ ...editingDraft, ...patch })}
                    rowLabel={`POS tersimpan ${row.id.slice(0, 8)}`}
                    shifts={shifts}
                  />
                ) : (
                  <tr className="border-b border-slate-50" key={row.id}>
                    <td className="px-2 py-3 tabular-nums">{row.clearingDate}</td>
                    <td className="px-2 py-3">{row.cashierName || "—"}</td>
                    <td className="px-2 py-3">{row.shiftName || "—"}</td>
                    {activeMethods.map((method) => {
                      const payment = row.payments?.find(
                        (item) => item.paymentMethodId === method.id,
                      );
                      const legacyAmount =
                        method.code === "TUNAI"
                          ? row.cashReceived
                          : method.code === "QRIS_EDC"
                            ? row.nonCashReceived
                            : 0;
                      return (
                        <td className="px-2 py-3 text-right font-mono tabular-nums" key={method.id}>
                          Rp {money(payment?.amount ?? legacyAmount)}
                        </td>
                      );
                    })}
                    <td className="px-2 py-3 text-right font-mono tabular-nums">
                      Rp {money(row.cogsAmount)}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          row.status === "POSTED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                          disabled={deleteMutation.isPending}
                          onClick={() => startEdit(row)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40"
                          disabled={deleteMutation.isPending}
                          onClick={() => removeRow(row)}
                          type="button"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

type PbfDraft = {
  invoiceDate: string;
  dueDate: string;
  pbfName: string;
  invoiceNumber: string;
  dppAmount: string;
  ppnAmount: string;
  paymentTerms: string;
};
const emptyPbf = (): PbfDraft => ({
  invoiceDate: todayIsoDate(),
  dueDate: todayIsoDate(),
  pbfName: "",
  invoiceNumber: "",
  dppAmount: "",
  ppnAmount: "",
  paymentTerms: "TEMPO_30",
});
function pbfDpp(row: PbfDraft) {
  try {
    return senToRupiah(parseRupiahToSen(row.dppAmount));
  } catch {
    return senToRupiah(0);
  }
}
export function PBFInvoicesPage() {
  const [drafts, setDrafts] = useState<PbfDraft[]>([emptyPbf()]);
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const rowsQuery = useQuery({ queryKey: queryKeys.pbfInvoices, queryFn: getPbfInvoices });
  const rows = rowsQuery.data ?? [];
  function update(index: number, patch: Partial<PbfDraft>) {
    setDrafts((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }
  function paste(event: React.ClipboardEvent<HTMLInputElement>, index: number) {
    const text = event.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    event.preventDefault();
    const pasted = text
      .trimEnd()
      .split(/\r?\n/)
      .map((line) => line.split("\t"));
    setDrafts((current) => {
      const next = [...current];
      pasted.forEach((cells, offset) => {
        const [
          invoiceDate = todayIsoDate(),
          dueDate = invoiceDate,
          pbfName = "",
          invoiceNumber = "",
          dppAmount = "",
          ppnAmount = "",
          paymentTerms = "TEMPO_30",
        ] = cells.map((value) => value.trim());
        next[index + offset] = {
          invoiceDate,
          dueDate,
          pbfName,
          invoiceNumber,
          dppAmount,
          ppnAmount,
          paymentTerms: paymentTerms || "TEMPO_30",
        };
      });
      return next;
    });
  }
  const saveMutation = useMutation({
    mutationFn: async (items: PbfDraft[]) => {
      for (const row of items) {
        const ppn = row.ppnAmount || calculatePpn(pbfDpp(row)).toFixed(2);
        await createPbfInvoice({ ...row, ppnAmount: ppn } as PbfInput);
      }
    },
    onSuccess: async () => {
      setDrafts([emptyPbf()]);
      setMessage("Faktur PBF berhasil disimpan dan dijurnal.");
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Faktur belum tersimpan"),
  });
  function saveAll() {
    saveMutation.mutate(
      drafts.filter((item) => item.pbfName && item.invoiceNumber && item.dppAmount),
    );
  }
  return (
    <div className="space-y-5">
      <Card>
        <Header
          eyebrow="Phase 3 · Modul Operasional"
          title="Faktur Pembelian PBF"
          note="Batch ledger dengan Ctrl+V dari Excel, PPN 11% berbasis Decimal, dan jurnal persediaan–utang otomatis."
        />
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
            onClick={() => setDrafts((current) => [...current, emptyPbf()])}
            type="button"
          >
            + Tambah baris
          </button>
          <button
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void saveAll()}
            type="button"
          >
            Simpan & Jurnal Batch
          </button>
          <span className="text-xs text-muted">
            Kolom pertama menerima TSV Excel: tanggal, jatuh tempo, PBF, no faktur, DPP, PPN,
            termin.
          </span>
        </div>
      </Card>
      <ErrorMessage message={message} />
      <Card>
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-2 py-3">Tgl faktur</th>
                <th className="px-2 py-3">Jatuh tempo</th>
                <th className="px-2 py-3">PBF</th>
                <th className="px-2 py-3">No. faktur</th>
                <th className="px-2 py-3 text-right">DPP</th>
                <th className="px-2 py-3 text-right">PPN 11%</th>
                <th className="px-2 py-3 text-right">Total</th>
                <th className="px-2 py-3">Termin</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((row, index) => {
                const key = `${row.pbfName.toLowerCase()}|${row.invoiceNumber.toLowerCase()}`;
                const duplicate =
                  (row.pbfName &&
                    row.invoiceNumber &&
                    drafts.filter(
                      (item) =>
                        `${item.pbfName.toLowerCase()}|${item.invoiceNumber.toLowerCase()}` === key,
                    ).length > 1) ||
                  rows.some(
                    (item) =>
                      `${item.pbfName.toLowerCase()}|${item.invoiceNumber.toLowerCase()}` === key,
                  );
                const dpp = pbfDpp(row);
                const ppn = row.ppnAmount
                  ? pbfDpp({ ...row, dppAmount: row.ppnAmount })
                  : calculatePpn(dpp);
                return (
                  <tr className="border-b border-slate-50" key={index}>
                    <td className="px-2 py-2">
                      <input
                        className={`${inputClass} tabular-nums`}
                        type="date"
                        value={row.invoiceDate}
                        onChange={(e) => update(index, { invoiceDate: e.target.value })}
                        onPaste={(e) => paste(e, index)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={`${inputClass} tabular-nums`}
                        type="date"
                        value={row.dueDate}
                        onChange={(e) => update(index, { dueDate: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={inputClass}
                        value={row.pbfName}
                        placeholder="Kimia Farma"
                        onChange={(e) => update(index, { pbfName: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={`${inputClass} ${duplicate ? "border-red-400 bg-red-50" : ""}`}
                        value={row.invoiceNumber}
                        placeholder="INV-..."
                        onChange={(e) => update(index, { invoiceNumber: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={`${inputClass} text-right font-mono tabular-nums`}
                        value={row.dppAmount}
                        placeholder="0"
                        onChange={(e) => update(index, { dppAmount: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={`${inputClass} text-right font-mono tabular-nums`}
                        value={row.ppnAmount || money(calculatePpn(dpp).times(100).toNumber())}
                        onChange={(e) => update(index, { ppnAmount: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">
                      Rp {money(`${dpp.plus(ppn).toFixed(2)}`)}
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className={inputClass}
                        value={row.paymentTerms}
                        onChange={(e) => update(index, { paymentTerms: e.target.value })}
                      >
                        <option value="TUNAI">Tunai</option>
                        <option value="TEMPO_14">Tempo 14</option>
                        <option value="TEMPO_30">Tempo 30</option>
                        <option value="TEMPO_45">Tempo 45</option>
                        <option value="TEMPO_60">Tempo 60</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold">Faktur tersimpan</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <tbody>
              {rows.map((row) => (
                <tr className="border-b border-slate-50" key={row.id}>
                  <td className="px-3 py-2 tabular-nums">{row.invoiceDate}</td>
                  <td className="px-3 py-2">{row.pbfName}</td>
                  <td className="px-3 py-2 font-mono">{row.invoiceNumber}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    Rp {money(row.totalAmount)}
                  </td>
                  <td className="px-3 py-2">{row.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ConsignmentPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [productName, setProductName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({
    queryKey: queryKeys.consignmentItems,
    queryFn: getConsignmentItems,
  });
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const rows = itemsQuery.data ?? [];
  const accounts = (accountsQuery.data ?? []).filter((account) =>
    ["1101", "1111", "1112"].includes(account.code),
  );
  useEffect(() => {
    if (!paymentAccountId)
      setPaymentAccountId(accounts.find((account) => account.code === "1101")?.id ?? "");
  }, [accounts, paymentAccountId]);
  const total = rows
    .filter((row) => selected.includes(row.id))
    .reduce((sum, row) => sum + row.totalPayable, 0);
  const addMutation = useMutation({
    mutationFn: async () => {
      let id = vendorId;
      if (!id) {
        const vendor = await createConsignmentVendor({ vendorName });
        id = vendor.data.id;
        setVendorId(id);
      }
      return createConsignmentItem({
        vendorId: id,
        productName,
        qtySold: Number(qty),
        agreedCostPrice: price,
      });
    },
    onSuccess: async () => {
      setMessage("Item konsinyasi ditambahkan.");
      setProductName("");
      setPrice("");
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Item belum ditambahkan"),
  });
  const settleMutation = useMutation({
    mutationFn: () =>
      settleConsignment({ itemIds: selected, settlementDate: todayIsoDate(), paymentAccountId }),
    onSuccess: async () => {
      setMessage("Tagihan terpilih lunas dan jurnal kas keluar dibuat.");
      setSelected([]);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Pembayaran belum diproses"),
  });
  function add() {
    addMutation.mutate();
  }
  function settle() {
    settleMutation.mutate();
  }
  return (
    <div className="space-y-5">
      <Card>
        <Header
          eyebrow="Phase 3 · Modul Operasional"
          title="Konsinyasi & Bagi Hasil"
          note="Hitung utang vendor dari qty × harga kesepakatan dan selesaikan beberapa item sekaligus."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <label className="text-xs font-semibold text-slate-500 md:col-span-2">
            Nama vendor baru / pilih vendor
            <input
              className={inputClass}
              value={vendorName}
              placeholder="Vendor herbal"
              onChange={(e) => setVendorName(e.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Produk
            <input
              className={inputClass}
              value={productName}
              placeholder="Madu"
              onChange={(e) => setProductName(e.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Qty
            <input
              className={`${inputClass} text-right tabular-nums`}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Harga bagi hasil
            <input
              className={`${inputClass} text-right font-mono tabular-nums`}
              value={price}
              placeholder="0"
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        </div>
        <button
          className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
          onClick={() => void add()}
          type="button"
        >
          + Tambah item siap bayar
        </button>
      </Card>
      <ErrorMessage message={message} />
      <Card>
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3" />
                <th className="px-3 py-3">Vendor</th>
                <th className="px-3 py-3">Produk</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Harga bagi hasil</th>
                <th className="px-3 py-3 text-right">Total utang</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b border-slate-50" key={row.id}>
                  <td className="px-3 py-3">
                    <input
                      aria-label={`Pilih ${row.productName}`}
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      disabled={row.status === "PAID"}
                      onChange={(e) =>
                        setSelected((current) =>
                          e.target.checked
                            ? [...current, row.id]
                            : current.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-3">{row.vendorName}</td>
                  <td className="px-3 py-3">{row.productName}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{row.qtySold}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    Rp {money(row.agreedCostPrice)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    Rp {money(row.totalPayable)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${row.status === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {selected.length > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-lg">
          <span className="text-sm font-semibold text-blue-900">
            Selesaikan tagihan terpilih ({selected.length}) — Rp {money(total)}
          </span>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void settle()}
              type="button"
            >
              Bayar & Jurnal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CashBankPage() {
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    transactionTime: `${todayIsoDate()}T09:00`,
    transactionType: "DEPOSIT",
    sourceAccountId: "",
    targetAccountId: "",
    netAmount: "",
    adminFee: "",
    referenceNo: "",
    memo: "",
  });
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const summaryQuery = useQuery({
    queryKey: queryKeys.cashBankSummary,
    queryFn: getCashBankSummary,
  });
  const rowsQuery = useQuery({
    queryKey: queryKeys.cashBankTransfers,
    queryFn: getCashBankTransfers,
  });
  const accounts = (accountsQuery.data ?? []).filter((account) =>
    ["1101", "1111", "1112"].includes(account.code),
  );
  const summary = summaryQuery.data ?? [];
  const rows = rowsQuery.data ?? [];
  useEffect(() => {
    setForm((current) => ({
      ...current,
      sourceAccountId:
        current.sourceAccountId || accounts.find((account) => account.code === "1101")?.id || "",
      targetAccountId:
        current.targetAccountId || accounts.find((account) => account.code === "1111")?.id || "",
    }));
  }, [accounts]);
  const saveMutation = useMutation({
    mutationFn: () => createCashBankTransfer(form as CashBankInput),
    onSuccess: async () => {
      setMessage("Mutasi berhasil dicatat dengan jurnal ganda.");
      setForm((current) => ({
        ...current,
        netAmount: "",
        adminFee: "",
        referenceNo: "",
        memo: "",
      }));
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Mutasi belum tersimpan"),
  });
  function save() {
    saveMutation.mutate();
  }
  return (
    <div className="space-y-5">
      <Card>
        <Header
          eyebrow="Phase 3 · Modul Operasional"
          title="Kas, Bank & Mutasi Rekening"
          note="Setoran kasir, transfer antar rekening, dan biaya admin membentuk jurnal debit-kredit otomatis."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {summary.map((account) => (
            <div className="rounded-xl bg-slate-50 p-4" key={account.id}>
              <p className="text-xs text-muted">
                {account.code} · {account.name}
              </p>
              <p className="mt-2 font-mono text-xl font-bold tabular-nums">
                Rp {money(account.balance)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <label className="text-xs font-semibold text-slate-500">
            Waktu
            <input
              className={`${inputClass} tabular-nums`}
              type="datetime-local"
              value={form.transactionTime}
              onChange={(e) => setForm({ ...form, transactionTime: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Tipe
            <select
              className={inputClass}
              value={form.transactionType}
              onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
            >
              <option value="DEPOSIT">Setoran kas ke bank</option>
              <option value="BANK_TRANSFER">Transfer antar bank</option>
              <option value="EXPENSE">Pengeluaran</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Akun sumber
            <select
              className={inputClass}
              value={form.sourceAccountId}
              onChange={(e) => setForm({ ...form, sourceAccountId: e.target.value })}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Akun tujuan
            <select
              className={inputClass}
              value={form.targetAccountId}
              onChange={(e) => setForm({ ...form, targetAccountId: e.target.value })}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Nominal bersih
            <input
              className={`${inputClass} text-right font-mono tabular-nums`}
              value={form.netAmount}
              placeholder="0"
              onChange={(e) => setForm({ ...form, netAmount: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Biaya admin
            <input
              className={`${inputClass} text-right font-mono tabular-nums`}
              value={form.adminFee}
              placeholder="0"
              onChange={(e) => setForm({ ...form, adminFee: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            No. referensi
            <input
              className={inputClass}
              value={form.referenceNo}
              onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
            />
          </label>
          <label className="flex items-end">
            <button
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void save()}
              type="button"
            >
              Catat Mutasi
            </button>
          </label>
        </div>
      </Card>
      <ErrorMessage message={message} />
      <Card>
        <h3 className="font-semibold">Riwayat mutasi</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3">Waktu</th>
                <th className="px-3 py-3">Tipe</th>
                <th className="px-3 py-3 text-right">Bersih</th>
                <th className="px-3 py-3 text-right">Admin</th>
                <th className="px-3 py-3 text-right">Total sumber</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b border-slate-50" key={row.id}>
                  <td className="px-3 py-3 tabular-nums">{row.transactionTime}</td>
                  <td className="px-3 py-3">{row.transactionType}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    Rp {money(row.netAmount)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    Rp {money(row.adminFee)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    Rp {money(row.totalDeducted)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
