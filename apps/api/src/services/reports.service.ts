import { and, asc, eq, gte, lt, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import {
  isCashBankAccount,
  isInventoryAccount,
  isPayableAccount,
  isReceivableAccount,
  isRevenueAccount,
  type CashFlowReport,
  type ReportPeriod,
} from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { accounts, journalLines, journals } from "../db/schema/index.js";

type Db = SqliteClient["db"];

type AccountTotals = {
  debit: Decimal;
  credit: Decimal;
};

type ReportRow = {
  accountId: string;
  code: string;
  name: string;
  classification: string;
  normalBalance: string;
  debit: number;
  credit: number;
  amount: number;
  compareAmount: number;
  variance: number;
  growthPercent: number | null;
};

const incomeClassifications = [
  "PENDAPATAN",
  "BEBAN_POKOK",
  "BEBAN_OPERASIONAL",
  "BEBAN_NON_OPERASIONAL",
] as const;
const assetClassifications = ["ASET_LANCAR", "ASET_TIDAK_LANCAR"] as const;
const liabilityClassifications = ["KEWAJIBAN_LANCAR", "KEWAJIBAN_JANGKA_PANJANG"] as const;

function emptyTotals(): AccountTotals {
  return { debit: new Decimal(0), credit: new Decimal(0) };
}

function addTotals(target: AccountTotals, debit: number, credit: number): void {
  target.debit = target.debit.plus(debit);
  target.credit = target.credit.plus(credit);
}

function totalsForAccount(totals: Map<string, AccountTotals>, accountId: string): AccountTotals {
  const current = totals.get(accountId);
  if (current) return current;
  const next = emptyTotals();
  totals.set(accountId, next);
  return next;
}

function rangeConditions(period: ReportPeriod) {
  return and(gte(journals.entryDate, period.startDate), lte(journals.entryDate, period.endDate));
}

function allThroughConditions(asOfDate: string) {
  return lte(journals.entryDate, asOfDate);
}

function collectTotals(db: Db, period: ReportPeriod): Map<string, AccountTotals> {
  const rows = db
    .select({
      accountId: journalLines.accountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journals.id, journalLines.journalId))
    .where(rangeConditions(period))
    .all();

  const totals = new Map<string, AccountTotals>();
  for (const row of rows) addTotals(totalsForAccount(totals, row.accountId), row.debit, row.credit);
  return totals;
}

function collectTotalsThrough(db: Db, asOfDate: string): Map<string, AccountTotals> {
  const rows = db
    .select({
      accountId: journalLines.accountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journals.id, journalLines.journalId))
    .where(allThroughConditions(asOfDate))
    .all();

  const totals = new Map<string, AccountTotals>();
  for (const row of rows) addTotals(totalsForAccount(totals, row.accountId), row.debit, row.credit);
  return totals;
}

function economicAmount(classification: string, totals: AccountTotals): Decimal {
  return classification === "PENDAPATAN"
    ? totals.credit.minus(totals.debit)
    : totals.debit.minus(totals.credit);
}

function growthPercent(current: Decimal, compare: Decimal): number | null {
  if (compare.isZero()) return current.isZero() ? 0 : null;
  return current.minus(compare).dividedBy(compare.abs()).times(100).toDecimalPlaces(2).toNumber();
}

function reportRow(
  account: typeof accounts.$inferSelect,
  currentTotals: AccountTotals,
  compareTotals: AccountTotals,
  useIncomeAmount: boolean,
): ReportRow {
  const current = useIncomeAmount
    ? economicAmount(account.classification, currentTotals)
    : currentTotals.debit.minus(currentTotals.credit);
  const compare = useIncomeAmount
    ? economicAmount(account.classification, compareTotals)
    : compareTotals.debit.minus(compareTotals.credit);
  const variance = current.minus(compare);
  return {
    accountId: account.id,
    code: account.code,
    name: account.name,
    classification: account.classification,
    normalBalance: account.normalBalance,
    debit: currentTotals.debit.toNumber(),
    credit: currentTotals.credit.toNumber(),
    amount: current.toNumber(),
    compareAmount: compare.toNumber(),
    variance: variance.toNumber(),
    growthPercent: growthPercent(current, compare),
  };
}

function aggregate(rows: readonly ReportRow[]): {
  amount: number;
  compareAmount: number;
  variance: number;
  growthPercent: number | null;
} {
  const current = rows.reduce((total, row) => total.plus(row.amount), new Decimal(0));
  const compare = rows.reduce((total, row) => total.plus(row.compareAmount), new Decimal(0));
  return {
    amount: current.toNumber(),
    compareAmount: compare.toNumber(),
    variance: current.minus(compare).toNumber(),
    growthPercent: growthPercent(current, compare),
  };
}

function incomeRowsFor(
  accountsList: readonly (typeof accounts.$inferSelect)[],
  currentTotals: Map<string, AccountTotals>,
  compareTotals: Map<string, AccountTotals>,
): ReportRow[] {
  return accountsList
    .filter((account) =>
      (incomeClassifications as readonly string[]).includes(account.classification),
    )
    .map((account) =>
      reportRow(
        account,
        currentTotals.get(account.id) ?? emptyTotals(),
        compareTotals.get(account.id) ?? emptyTotals(),
        true,
      ),
    );
}

export function getIncomeStatement(
  db: Db,
  input: { period: ReportPeriod; comparePeriod?: ReportPeriod },
) {
  const accountsList = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.isActive, true), eq(accounts.isGroup, false)))
    .orderBy(asc(accounts.code))
    .all();
  const currentTotals = collectTotals(db, input.period);
  const compareTotals = input.comparePeriod
    ? collectTotals(db, input.comparePeriod)
    : new Map<string, AccountTotals>();
  const rows = incomeRowsFor(accountsList, currentTotals, compareTotals);
  const revenueRows = rows.filter((row) => row.classification === "PENDAPATAN");
  const cogsRows = rows.filter((row) => row.classification === "BEBAN_POKOK");
  const operatingRows = rows.filter((row) => row.classification === "BEBAN_OPERASIONAL");
  const nonOperatingRows = rows.filter((row) => row.classification === "BEBAN_NON_OPERASIONAL");
  const revenue = aggregate(revenueRows);
  const cogs = aggregate(cogsRows);
  const operatingExpenses = aggregate(operatingRows);
  const nonOperatingExpenses = aggregate(nonOperatingRows);
  const grossProfit = {
    amount: new Decimal(revenue.amount).minus(cogs.amount).toNumber(),
    compareAmount: new Decimal(revenue.compareAmount).minus(cogs.compareAmount).toNumber(),
  };
  const netProfit = {
    amount: new Decimal(grossProfit.amount)
      .minus(operatingExpenses.amount)
      .minus(nonOperatingExpenses.amount)
      .toNumber(),
    compareAmount: new Decimal(grossProfit.compareAmount)
      .minus(operatingExpenses.compareAmount)
      .minus(nonOperatingExpenses.compareAmount)
      .toNumber(),
  };

  return {
    period: input.period,
    comparePeriod: input.comparePeriod ?? null,
    rows,
    sections: [
      { key: "REVENUE", label: "Pendapatan Penjualan", rows: revenueRows, total: revenue },
      { key: "COGS", label: "HPP Obat", rows: cogsRows, total: cogs },
      {
        key: "OPERATING_EXPENSES",
        label: "Beban Operasional",
        rows: operatingRows,
        total: operatingExpenses,
      },
      {
        key: "NON_OPERATING_EXPENSES",
        label: "Beban Non-Operasional",
        rows: nonOperatingRows,
        total: nonOperatingExpenses,
      },
    ],
    revenue,
    cogs,
    grossProfit: {
      ...grossProfit,
      variance: new Decimal(grossProfit.amount).minus(grossProfit.compareAmount).toNumber(),
      growthPercent: growthPercent(
        new Decimal(grossProfit.amount),
        new Decimal(grossProfit.compareAmount),
      ),
    },
    operatingExpenses,
    nonOperatingExpenses,
    netProfit: {
      ...netProfit,
      variance: new Decimal(netProfit.amount).minus(netProfit.compareAmount).toNumber(),
      growthPercent: growthPercent(
        new Decimal(netProfit.amount),
        new Decimal(netProfit.compareAmount),
      ),
    },
  };
}

type BalanceRow = {
  accountId: string;
  code: string;
  name: string;
  classification: string;
  normalBalance: string;
  debit: number;
  credit: number;
  balance: number;
  signedBalance: number;
};

function balanceRow(account: typeof accounts.$inferSelect, totals: AccountTotals): BalanceRow {
  const signedBalance = totals.debit.minus(totals.credit);
  const displayBalance =
    (liabilityClassifications as readonly string[]).includes(account.classification) ||
    account.classification === "EKUITAS"
      ? signedBalance.negated()
      : signedBalance;
  return {
    accountId: account.id,
    code: account.code,
    name: account.name,
    classification: account.classification,
    normalBalance: account.normalBalance,
    debit: totals.debit.toNumber(),
    credit: totals.credit.toNumber(),
    balance: displayBalance.toNumber(),
    signedBalance: signedBalance.toNumber(),
  };
}

function sumBalance(rows: readonly BalanceRow[]): Decimal {
  return rows.reduce((total, row) => total.plus(row.balance), new Decimal(0));
}

export function getBalanceSheet(db: Db, asOfDate: string) {
  const accountsList = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.isActive, true), eq(accounts.isGroup, false)))
    .orderBy(asc(accounts.code))
    .all();
  const totals = collectTotalsThrough(db, asOfDate);
  const rows = accountsList.map((account) =>
    balanceRow(account, totals.get(account.id) ?? emptyTotals()),
  );
  const assets = rows.filter((row) =>
    (assetClassifications as readonly string[]).includes(row.classification),
  );
  const liabilities = rows.filter((row) =>
    (liabilityClassifications as readonly string[]).includes(row.classification),
  );
  const equityAccounts = rows.filter((row) => row.classification === "EKUITAS");
  const incomeRows = rows.filter((row) =>
    (incomeClassifications as readonly string[]).includes(row.classification),
  );
  // Revenue rows are displayed as negative signed balances; all income-statement
  // balances therefore invert once when rolled into retained/current earnings.
  const currentEarnings = incomeRows.reduce(
    (total, row) => total.minus(row.balance),
    new Decimal(0),
  );
  const totalAssets = sumBalance(assets);
  const totalLiabilities = sumBalance(liabilities);
  const totalEquityAccounts = sumBalance(equityAccounts);
  const totalEquity = totalEquityAccounts.plus(currentEarnings);
  const difference = totalAssets.minus(totalLiabilities).minus(totalEquity);

  return {
    asOfDate,
    rows,
    sections: [
      { key: "ASSETS", label: "Aset", rows: assets, total: totalAssets.toNumber() },
      {
        key: "LIABILITIES",
        label: "Kewajiban",
        rows: liabilities,
        total: totalLiabilities.toNumber(),
      },
      {
        key: "EQUITY",
        label: "Ekuitas",
        rows: equityAccounts,
        total: totalEquityAccounts.toNumber(),
      },
    ],
    assets,
    liabilities,
    equity: equityAccounts,
    currentEarnings: currentEarnings.toNumber(),
    totalAssets: totalAssets.toNumber(),
    totalLiabilities: totalLiabilities.toNumber(),
    totalEquity: totalEquity.toNumber(),
    difference: difference.toNumber(),
    isBalanced: difference.isZero(),
  };
}

type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  classification: string;
  normalBalance: string;
  debit: number;
  credit: number;
  debitBalance: number;
  creditBalance: number;
  endingBalance: number;
};

export function getTrialBalance(db: Db, period: ReportPeriod) {
  const accountsList = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.isActive, true), eq(accounts.isGroup, false)))
    .orderBy(asc(accounts.code))
    .all();
  const totals = collectTotals(db, period);
  const rows: TrialBalanceRow[] = accountsList.map((account) => {
    const current = totals.get(account.id) ?? emptyTotals();
    const net = current.debit.minus(current.credit);
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      classification: account.classification,
      normalBalance: account.normalBalance,
      debit: current.debit.toNumber(),
      credit: current.credit.toNumber(),
      debitBalance: Decimal.max(net, 0).toNumber(),
      creditBalance: Decimal.max(net.negated(), 0).toNumber(),
      endingBalance: (account.normalBalance === "KREDIT" ? net.negated() : net).toNumber(),
    };
  });
  const totalDebit = rows.reduce((total, row) => total.plus(row.debitBalance), new Decimal(0));
  const totalCredit = rows.reduce((total, row) => total.plus(row.creditBalance), new Decimal(0));
  return {
    period,
    rows,
    totalDebit: totalDebit.toNumber(),
    totalCredit: totalCredit.toNumber(),
    difference: totalDebit.minus(totalCredit).toNumber(),
    isBalanced: totalDebit.eq(totalCredit),
  };
}

export function getAccountJournalDrillDown(
  db: Db,
  input: { accountId: string; period: ReportPeriod },
) {
  const account = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
  if (!account) throw new Error("Akun tidak ditemukan");
  const entries = db
    .select({
      lineId: journalLines.id,
      journalId: journals.id,
      journalNo: journals.journalNo,
      entryDate: journals.entryDate,
      referenceNo: journals.referenceNo,
      memo: journals.memo,
      sourceModule: journals.sourceModule,
      lineNumber: journalLines.lineNumber,
      description: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journals.id, journalLines.journalId))
    .where(and(eq(journalLines.accountId, input.accountId), rangeConditions(input.period)))
    .orderBy(asc(journals.entryDate), asc(journals.journalNo), asc(journalLines.lineNumber))
    .all();
  const totalDebit = entries.reduce((total, row) => total.plus(row.debit), new Decimal(0));
  const totalCredit = entries.reduce((total, row) => total.plus(row.credit), new Decimal(0));
  const journalsById = new Map<
    string,
    {
      journalId: string;
      journalNo: string;
      entryDate: string;
      referenceNo: string | null;
      memo: string | null;
      sourceModule: string;
      lines: typeof entries;
    }
  >();
  for (const entry of entries) {
    const current = journalsById.get(entry.journalId);
    if (current) current.lines.push(entry);
    else
      journalsById.set(entry.journalId, {
        journalId: entry.journalId,
        journalNo: entry.journalNo,
        entryDate: entry.entryDate,
        referenceNo: entry.referenceNo,
        memo: entry.memo,
        sourceModule: entry.sourceModule,
        lines: [entry],
      });
  }
  return {
    account,
    period: input.period,
    entries,
    journals: [...journalsById.values()],
    totalDebit: totalDebit.toNumber(),
    totalCredit: totalCredit.toNumber(),
    netMovement: totalDebit.minus(totalCredit).toNumber(),
  };
}

export function getCashFlowStatement(db: Db, period: ReportPeriod): CashFlowReport {
  const accountsList = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.isActive, true), eq(accounts.isGroup, false)))
    .orderBy(asc(accounts.code))
    .all();

  const cashAccounts = accountsList.filter((a) => isCashBankAccount(a));
  const cashAccountIds = new Set(cashAccounts.map((a) => a.id));
  const accountById = new Map(accountsList.map((a) => [a.id, a]));

  // 1. Prior balances (all transactions strictly before period.startDate)
  const priorRows = db
    .select({
      accountId: journalLines.accountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journals.id, journalLines.journalId))
    .where(lt(journals.entryDate, period.startDate))
    .all();

  const priorTotals = new Map<string, AccountTotals>();
  for (const row of priorRows) {
    if (cashAccountIds.has(row.accountId)) {
      addTotals(totalsForAccount(priorTotals, row.accountId), row.debit, row.credit);
    }
  }

  // 2. Period totals for cash accounts
  const periodTotals = collectTotals(db, period);

  const cashAccountSummaries = cashAccounts.map((acc) => {
    const prior = priorTotals.get(acc.id) ?? emptyTotals();
    const beginningBalance = prior.debit.minus(prior.credit);
    const during = periodTotals.get(acc.id) ?? emptyTotals();
    const inflow = during.debit;
    const outflow = during.credit;
    const netMovement = inflow.minus(outflow);
    const endingBalance = beginningBalance.plus(netMovement);

    return {
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      beginningBalance: beginningBalance.toNumber(),
      inflow: inflow.toNumber(),
      outflow: outflow.toNumber(),
      netMovement: netMovement.toNumber(),
      endingBalance: endingBalance.toNumber(),
    };
  });

  const totalBeginningCash = cashAccountSummaries.reduce(
    (sum, a) => sum.plus(a.beginningBalance),
    new Decimal(0),
  );
  const totalEndingCash = cashAccountSummaries.reduce(
    (sum, a) => sum.plus(a.endingBalance),
    new Decimal(0),
  );
  const totalNetCashFlow = totalEndingCash.minus(totalBeginningCash);

  // 3. Classify cash movements by activity
  const journalLinesInPeriod = db
    .select({
      journalId: journals.id,
      journalNo: journals.journalNo,
      entryDate: journals.entryDate,
      memo: journals.memo,
      accountId: journalLines.accountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journals.id, journalLines.journalId))
    .where(rangeConditions(period))
    .all();

  const linesByJournal = new Map<string, typeof journalLinesInPeriod>();
  for (const line of journalLinesInPeriod) {
    const list = linesByJournal.get(line.journalId);
    if (list) list.push(line);
    else linesByJournal.set(line.journalId, [line]);
  }

  type FlowBucket = {
    accountId?: string;
    code?: string;
    name: string;
    amount: Decimal;
  };

  const operatingInflows = new Map<string, FlowBucket>();
  const operatingOutflows = new Map<string, FlowBucket>();
  const investingInflows = new Map<string, FlowBucket>();
  const investingOutflows = new Map<string, FlowBucket>();
  const financingInflows = new Map<string, FlowBucket>();
  const financingOutflows = new Map<string, FlowBucket>();

  function addBucket(
    map: Map<string, FlowBucket>,
    key: string,
    name: string,
    amount: Decimal,
    acc?: typeof accounts.$inferSelect,
  ) {
    const existing = map.get(key);
    if (existing) {
      existing.amount = existing.amount.plus(amount);
    } else {
      map.set(key, {
        accountId: acc?.id,
        code: acc?.code,
        name,
        amount,
      });
    }
  }

  for (const lines of linesByJournal.values()) {
    const cashLines = lines.filter((l) => cashAccountIds.has(l.accountId));
    if (cashLines.length === 0) continue;

    let cashDebit = new Decimal(0);
    let cashCredit = new Decimal(0);
    for (const cl of cashLines) {
      cashDebit = cashDebit.plus(cl.debit);
      cashCredit = cashCredit.plus(cl.credit);
    }

    const deltaCash = cashDebit.minus(cashCredit);
    if (deltaCash.isZero()) continue;

    const nonCashLines = lines.filter((l) => !cashAccountIds.has(l.accountId));

    if (deltaCash.greaterThan(0)) {
      let sumNetCredits = new Decimal(0);
      for (const ncl of nonCashLines) {
        const netCred = new Decimal(ncl.credit).minus(ncl.debit);
        if (netCred.greaterThan(0)) {
          sumNetCredits = sumNetCredits.plus(netCred);
        }
      }

      if (sumNetCredits.greaterThan(0)) {
        for (const ncl of nonCashLines) {
          const netCred = new Decimal(ncl.credit).minus(ncl.debit);
          if (netCred.greaterThan(0)) {
            const allocated = netCred.dividedBy(sumNetCredits).times(deltaCash);
            const acc = accountById.get(ncl.accountId);
            const key = acc?.id ?? "other";
            const name = acc?.name ?? "Penerimaan Lainnya";

            if (isRevenueAccount(acc)) {
              addBucket(operatingInflows, key, name, allocated, acc);
            } else if (isReceivableAccount(acc)) {
              addBucket(operatingInflows, key, name, allocated, acc);
            } else if (acc?.classification === "ASET_TIDAK_LANCAR") {
              addBucket(investingInflows, key, name, allocated, acc);
            } else if (acc?.classification === "EKUITAS") {
              addBucket(financingInflows, key, name, allocated, acc);
            } else if (acc?.classification === "KEWAJIBAN_JANGKA_PANJANG") {
              addBucket(financingInflows, key, name, allocated, acc);
            } else {
              addBucket(operatingInflows, key, name, allocated, acc);
            }
          }
        }
      } else {
        addBucket(operatingInflows, "other-inflow", "Penerimaan Operasional Lainnya", deltaCash);
      }
    } else {
      const absDelta = deltaCash.abs();
      let sumNetDebits = new Decimal(0);
      for (const ncl of nonCashLines) {
        const netDeb = new Decimal(ncl.debit).minus(ncl.credit);
        if (netDeb.greaterThan(0)) {
          sumNetDebits = sumNetDebits.plus(netDeb);
        }
      }

      if (sumNetDebits.greaterThan(0)) {
        for (const ncl of nonCashLines) {
          const netDeb = new Decimal(ncl.debit).minus(ncl.credit);
          if (netDeb.greaterThan(0)) {
            const allocated = netDeb.dividedBy(sumNetDebits).times(absDelta);
            const acc = accountById.get(ncl.accountId);
            const key = acc?.id ?? "other";
            const name = acc?.name ?? "Pengeluaran Lainnya";

            if (
              acc?.classification === "BEBAN_POKOK" ||
              isInventoryAccount(acc) ||
              isPayableAccount(acc)
            ) {
              addBucket(operatingOutflows, key, name, allocated, acc);
            } else if (acc?.classification === "BEBAN_OPERASIONAL") {
              addBucket(operatingOutflows, key, name, allocated, acc);
            } else if (acc?.classification === "BEBAN_NON_OPERASIONAL") {
              addBucket(operatingOutflows, key, name, allocated, acc);
            } else if (acc?.classification === "ASET_TIDAK_LANCAR") {
              addBucket(investingOutflows, key, name, allocated, acc);
            } else if (acc?.classification === "EKUITAS") {
              addBucket(financingOutflows, key, name, allocated, acc);
            } else if (acc?.classification === "KEWAJIBAN_JANGKA_PANJANG") {
              addBucket(financingOutflows, key, name, allocated, acc);
            } else {
              addBucket(operatingOutflows, key, name, allocated, acc);
            }
          }
        }
      } else {
        addBucket(operatingOutflows, "other-outflow", "Pengeluaran Operasional Lainnya", absDelta);
      }
    }
  }

  function formatCategory(
    key: string,
    label: string,
    inflowsMap: Map<string, FlowBucket>,
    outflowsMap: Map<string, FlowBucket>,
  ) {
    const inflows = [...inflowsMap.values()]
      .filter((b) => !b.amount.isZero())
      .map((b) => ({
        accountId: b.accountId,
        code: b.code,
        name: b.name,
        amount: b.amount.toNumber(),
      }));
    const outflows = [...outflowsMap.values()]
      .filter((b) => !b.amount.isZero())
      .map((b) => ({
        accountId: b.accountId,
        code: b.code,
        name: b.name,
        amount: b.amount.toNumber(),
      }));

    const totalInflow = inflows.reduce((s, i) => s.plus(i.amount), new Decimal(0));
    const totalOutflow = outflows.reduce((s, o) => s.plus(o.amount), new Decimal(0));
    const netAmount = totalInflow.minus(totalOutflow);

    return {
      key,
      label,
      inflows,
      outflows,
      totalInflow: totalInflow.toNumber(),
      totalOutflow: totalOutflow.toNumber(),
      netAmount: netAmount.toNumber(),
    };
  }

  const operating = formatCategory(
    "OPERATING",
    "Aktivitas Operasi",
    operatingInflows,
    operatingOutflows,
  );
  const investing = formatCategory(
    "INVESTING",
    "Aktivitas Investasi",
    investingInflows,
    investingOutflows,
  );
  const financing = formatCategory(
    "FINANCING",
    "Aktivitas Pendanaan",
    financingInflows,
    financingOutflows,
  );

  return {
    period,
    operating,
    investing,
    financing,
    netCashFlow: totalNetCashFlow.toNumber(),
    beginningCash: totalBeginningCash.toNumber(),
    endingCash: totalEndingCash.toNumber(),
    cashAccounts: cashAccountSummaries,
  };
}
