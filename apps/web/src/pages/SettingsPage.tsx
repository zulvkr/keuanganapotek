import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { savePaymentMethod } from "../lib/mutations";
import { getAccounts, getPaymentMethods, queryKeys } from "../lib/queries";

type PosPaymentMethod = Awaited<ReturnType<typeof getPaymentMethods>>[number];
type SavePaymentMethodInput = Parameters<typeof savePaymentMethod>[0];

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
  const [newMethod, setNewMethod] = useState({ name: "", accountId: "" });
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const [methods, accounts] = await Promise.all([getPaymentMethods(), getAccounts()]);
      return { methods, accounts };
    },
  });
  useEffect(() => {
    if (settingsQuery.data) setMethods(settingsQuery.data.methods);
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
