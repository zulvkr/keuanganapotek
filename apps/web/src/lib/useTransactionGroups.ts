import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  TRANSACTION_GROUPS,
  type TransactionGroupDetail,
  type TransactionType,
  inferTransactionGroup,
} from "@keuangan-apotek/shared";
import { getTransactionGroups, queryKeys, type Account } from "./queries";

export function useDynamicTransactionGroups(options?: {
  transactionTypes?: TransactionType[];
  accountById?: Map<string, Account>;
}) {
  const groupsQuery = useQuery({
    queryKey: queryKeys.transactionGroups,
    queryFn: getTransactionGroups,
    staleTime: 60 * 1000,
  });

  const transactionGroups = useMemo(() => {
    const serverGroups = groupsQuery.data ?? [];
    const knownServerKeys = new Set(serverGroups.map((g) => g.key));
    const missingDefaultGroups = TRANSACTION_GROUPS.filter((g) => !knownServerKeys.has(g.key)).map(
      (g, idx) => ({
        ...g,
        sortOrder: serverGroups.length + idx,
        isSystem: true,
        isCustomized: false,
      }),
    );

    const combinedKnownKeys = new Set([
      ...serverGroups.map((g) => g.key),
      ...missingDefaultGroups.map((g) => g.key),
    ]);

    const discoveredGroups: TransactionGroupDetail[] = [];
    if (options?.transactionTypes && options?.accountById) {
      options.transactionTypes.forEach((t) => {
        const debitAcc = options.accountById?.get(t.debitAccountId);
        const creditAcc = options.accountById?.get(t.creditAccountId);
        const g = t.group || inferTransactionGroup(debitAcc, creditAcc);
        if (g && !combinedKnownKeys.has(g)) {
          combinedKnownKeys.add(g);
          discoveredGroups.push({
            key: g,
            label: g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            badgeLabel: g,
            description: `Grup ${g}`,
            badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
            metadataSchema: [],
            sortOrder: 999,
            isSystem: false,
            isCustomized: true,
          });
        }
      });
    }

    return [...serverGroups, ...missingDefaultGroups, ...discoveredGroups].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  }, [groupsQuery.data, options?.transactionTypes, options?.accountById]);

  const groupByKey = useMemo(
    () => new Map(transactionGroups.map((g) => [g.key, g])),
    [transactionGroups],
  );

  return {
    ...groupsQuery,
    transactionGroups,
    groupByKey,
  };
}
