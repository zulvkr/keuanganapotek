import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { saveCashier, savePaymentMethod, saveShift } from "../lib/mutations";
import {
  getAccounts,
  getCashiers,
  getPaymentMethods,
  getShifts,
  queryKeys,
  type Cashier,
  type Shift,
} from "../lib/queries";

type PosPaymentMethod = Awaited<ReturnType<typeof getPaymentMethods>>[number];
type SavePaymentMethodInput = Parameters<typeof savePaymentMethod>[0];
type SaveCashierInput = Parameters<typeof saveCashier>[0];
type SaveShiftInput = Parameters<typeof saveShift>[0];

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {children}
    </section>
  );
}

function SettingsPage() {
  const [methods, setMethods] = useState<PosPaymentMethod[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [newCashier, setNewCashier] = useState("");
  const [newShift, setNewShift] = useState("");
  const [newMethod, setNewMethod] = useState({ name: "", accountId: "" });
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const [methods, accounts, cashiers, shifts] = await Promise.all([
        getPaymentMethods(),
        getAccounts(),
        getCashiers(),
        getShifts(),
      ]);
      return { methods, accounts, cashiers, shifts };
    },
  });
  useEffect(() => {
    if (settingsQuery.data) {
      setMethods(settingsQuery.data.methods);
      setCashiers(settingsQuery.data.cashiers);
      setShifts(settingsQuery.data.shifts);
    }
  }, [settingsQuery.data]);
  const accounts = settingsQuery.data?.accounts ?? [];
  const loading = settingsQuery.isLoading;
  const eligibleAccounts = accounts.filter(
    (account) =>
      account.isActive &&
      !account.isGroup &&
      account.classification === "ASET_LANCAR" &&
      account.normalBalance === "DEBIT" &&
      (account.code.startsWith("11") || account.code.startsWith("12")),
  );
  const saveMutation = useMutation({
    mutationFn: (input: SavePaymentMethodInput) => savePaymentMethod(input),
    onSuccess: async (_, input) => {
      setMessage(`Metode ${input.name} berhasil disimpan.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods }),
        queryClient.invalidateQueries({ queryKey: queryKeys.posClearings }),
      ]);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Konfigurasi metode belum tersimpan"),
  });
  const saveCashierMutation = useMutation({
    mutationFn: (input: SaveCashierInput) => saveCashier(input),
    onSuccess: async (_, input) => {
      setMessage(`Kasir ${input.name} berhasil disimpan.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.cashiers }),
      ]);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Kasir belum tersimpan"),
  });
  const saveShiftMutation = useMutation({
    mutationFn: (input: SaveShiftInput) => saveShift(input),
    onSuccess: async (_, input) => {
      setMessage(`Shift ${input.name} berhasil disimpan.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shifts }),
      ]);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Shift belum tersimpan"),
  });

  function saveMethod(method: PosPaymentMethod) {
    saveMutation.mutate({
      id: method.id,
      name: method.name,
      accountId: method.accountId,
      isActive: method.isActive,
      sortOrder: method.sortOrder,
    });
  }

  function addMethod() {
    if (!newMethod.name.trim() || !newMethod.accountId) {
      setMessage("Nama metode dan akun tujuan wajib diisi.");
      return;
    }
    saveMutation.mutate(
      {
        name: newMethod.name.trim(),
        accountId: newMethod.accountId,
        isActive: true,
        sortOrder: methods.length * 10 + 10,
      },
      {
        onSuccess: async () => {
          setNewMethod({ name: "", accountId: newMethod.accountId });
          setMessage("Metode pembayaran baru ditambahkan.");
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["settings"] }),
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods }),
            queryClient.invalidateQueries({ queryKey: queryKeys.posClearings }),
          ]);
        },
      },
    );
  }

  function addCashier() {
    if (!newCashier.trim()) {
      setMessage("Nama kasir wajib diisi.");
      return;
    }
    saveCashierMutation.mutate({
      name: newCashier.trim(),
      isActive: true,
      sortOrder: cashiers.length * 10 + 10,
    });
    setNewCashier("");
  }

  function addShift() {
    if (!newShift.trim()) {
      setMessage("Nama shift wajib diisi.");
      return;
    }
    saveShiftMutation.mutate({
      name: newShift.trim(),
      isActive: true,
      sortOrder: shifts.length * 10 + 10,
    });
    setNewShift("");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Konfigurasi aplikasi
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Pengaturan</h2>
        <p className="mt-1 text-sm text-muted">
          Atur parameter yang dipakai saat mencatat POS Clearing dan HPP Harian.
        </p>
      </div>

      {message && (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="status"
        >
          {message}
        </p>
      )}

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              POS Clearing
            </p>
            <h3 className="mt-1 text-lg font-semibold">Metode pembayaran</h3>
            <p className="mt-1 text-sm text-muted">
              Pilih akun kas, bank, atau piutang untuk setiap metode. Hanya metode aktif yang muncul
              pada form POS.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-brand">
            Konfigurasi
          </span>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-muted">Memuat pengaturan…</p>
        ) : (
          <>
            <div className="mt-5 space-y-2">
              {methods.map((method) => (
                <div
                  className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1.2fr_1.5fr_auto_auto]"
                  key={method.id}
                >
                  <input
                    aria-label={`Nama metode ${method.code}`}
                    className={inputClass}
                    value={method.name}
                    onChange={(e) =>
                      setMethods((current) =>
                        current.map((item) =>
                          item.id === method.id ? { ...item, name: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <select
                    aria-label={`Akun metode ${method.code}`}
                    className={inputClass}
                    value={method.accountId}
                    onChange={(e) =>
                      setMethods((current) =>
                        current.map((item) =>
                          item.id === method.id ? { ...item, accountId: e.target.value } : item,
                        ),
                      )
                    }
                  >
                    {eligibleAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                  </select>
                  <span className="px-2 py-2 text-xs font-medium text-slate-500">
                    {method.isReceivable ? "Piutang" : "Kas / Bank"}
                  </span>
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand"
                    onClick={() => void saveMethod(method)}
                    type="button"
                  >
                    Simpan
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1.2fr_1.5fr_auto_auto]">
              <input
                aria-label="Nama metode pembayaran baru"
                className={inputClass}
                placeholder="Contoh Marketplace"
                value={newMethod.name}
                onChange={(e) => setNewMethod({ ...newMethod, name: e.target.value })}
              />
              <select
                aria-label="Akun metode pembayaran baru"
                className={inputClass}
                value={newMethod.accountId}
                onChange={(e) => setNewMethod({ ...newMethod, accountId: e.target.value })}
              >
                <option value="">Pilih akun tujuan</option>
                {eligibleAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
              <span className="px-2 py-2 text-xs text-slate-500">Kategori otomatis dari akun</span>
              <button
                className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white"
                onClick={() => void addMethod()}
                type="button"
              >
                + Tambah metode
              </button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">POS Clearing</p>
        <h3 className="mt-1 text-lg font-semibold">Master kasir dan shift</h3>
        <p className="mt-1 text-sm text-muted">
          Input dan aktifkan kasir serta shift di sini. Data aktif akan tersedia sebagai dropdown di
          form POS Clearing.
        </p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold">Kasir</h4>
            <div className="mt-3 space-y-2">
              {cashiers.map((cashier) => (
                <div
                  className="flex items-center gap-2 rounded-lg bg-slate-50 p-2"
                  key={cashier.id}
                >
                  <input
                    aria-label={`Nama kasir ${cashier.id}`}
                    className={inputClass}
                    value={cashier.name}
                    onChange={(e) =>
                      setCashiers((current) =>
                        current.map((item) =>
                          item.id === cashier.id ? { ...item, name: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                    <input
                      checked={cashier.isActive}
                      onChange={(e) =>
                        setCashiers((current) =>
                          current.map((item) =>
                            item.id === cashier.id ? { ...item, isActive: e.target.checked } : item,
                          ),
                        )
                      }
                      type="checkbox"
                    />
                    Aktif
                  </label>
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand"
                    onClick={() =>
                      saveCashierMutation.mutate({
                        id: cashier.id,
                        name: cashier.name,
                        isActive: cashier.isActive,
                        sortOrder: cashier.sortOrder,
                      })
                    }
                    type="button"
                  >
                    Simpan
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                aria-label="Nama kasir baru"
                className={inputClass}
                placeholder="Contoh: Siti"
                value={newCashier}
                onChange={(e) => setNewCashier(e.target.value)}
              />
              <button
                className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white"
                onClick={addCashier}
                type="button"
              >
                + Tambah
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Shift</h4>
            <div className="mt-3 space-y-2">
              {shifts.map((shift) => (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2" key={shift.id}>
                  <input
                    aria-label={`Nama shift ${shift.id}`}
                    className={inputClass}
                    value={shift.name}
                    onChange={(e) =>
                      setShifts((current) =>
                        current.map((item) =>
                          item.id === shift.id ? { ...item, name: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                    <input
                      checked={shift.isActive}
                      onChange={(e) =>
                        setShifts((current) =>
                          current.map((item) =>
                            item.id === shift.id ? { ...item, isActive: e.target.checked } : item,
                          ),
                        )
                      }
                      type="checkbox"
                    />
                    Aktif
                  </label>
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand"
                    onClick={() =>
                      saveShiftMutation.mutate({
                        id: shift.id,
                        name: shift.name,
                        isActive: shift.isActive,
                        sortOrder: shift.sortOrder,
                      })
                    }
                    type="button"
                  >
                    Simpan
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                aria-label="Nama shift baru"
                className={inputClass}
                placeholder="Contoh: Shift Pagi"
                value={newShift}
                onChange={(e) => setNewShift(e.target.value)}
              />
              <button
                className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white"
                onClick={addShift}
                type="button"
              >
                + Tambah
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">HPP Harian</p>
        <h3 className="mt-1 text-lg font-semibold">Parameter pengakuan HPP</h3>
        <p className="mt-1 text-sm text-muted">
          Nilai HPP tetap diinput per tanggal pada halaman POS Clearing agar sesuai rekap penjualan
          harian.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-muted">Akun beban HPP default</p>
            <p className="mt-1 font-semibold">5101 · HPP Obat Resep</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-muted">Akun pengurang persediaan default</p>
            <p className="mt-1 font-semibold">1301 · Persediaan Obat Resep (Etikal)</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Setiap rekap yang diposting akan membuat jurnal pengakuan HPP dan pengurangan persediaan
          secara otomatis.
        </p>
      </Card>
    </div>
  );
}

export default SettingsPage;
