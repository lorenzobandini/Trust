# ARCHITECTURE.md

Four contracts, deployed + wired via `ignition/modules/TrustDeployment.ts`.

```
GroupManager ──setExpenseManager──▶ ExpenseManager ──setDebtSimplifierContract──▶ DebtSimplifier
     │                                    │  ▲                                            │
     │ initializeGroupBalances            │  │ recordSimplifiedDebt / clearDebts           │ reads
     │                                    │  │ (onlyDebtSimplifier)                        │ getNetBalance/getDebt
     ▼                                    ▼  │                                            ▼
  groups/isGroupMember              debts[group][debtor][creditor]                  simplifyDebts
                                    groupUserNetBalances                            (onlyGroupMember)
                                    TrustToken.transferFrom (settleDebt)
```

## Permissions

| Action | Who |
|---|---|
| `GroupManager.setExpenseManager` | OWNER (deploy), once |
| `ExpenseManager.setDebtSimplifierContract` | OWNER (deploy), once |
| `createGroup / joinGroup` | anyone (member checks) |
| `leaveGroup` | member, not creator, zero debts both directions |
| `deleteGroup` | creator, all pairwise debts zero |
| `addExpense / settleDebt / simplifyDebts` | group member only |
| `initializeGroupBalances` | only GroupManager |
| `clearDebtsAndBalancesForGroup / recordSimplifiedDebt` | only DebtSimplifier |
| `TrustToken.mint` | anyone with ETH (1 ETH = 1000 TRUST) |
| `TrustToken.withdraw` | owner |

## Sequences

- **Expense**: `createGroup` → (auto `initializeGroupBalances` if wired) →
  `addExpense` validates split → `_updateDebts` updates `debts` + net balances.
- **Settle**: `mint` → `approve(expenseManager)` → `settleDebt` (`transferFrom`,
  debt −= amount, debtor +amount / creditor −amount net).
- **Simplify**: `simplifyDebts` reads net balances → greedy creditor/debtor match →
  `clearDebtsAndBalancesForGroup` (debts only, name lies — see DATABASE.md) →
  `recordSimplifiedDebt` per edge. Net balances persist untouched
  (recording writes `debts` only, conservation holds).
- **Leave/Delete**: blocked if any `getDebt != 0` in either direction (O(n²) scan,
  fine at ≤ 50 members).
