# DATABASE.md

## A. On-chain storage (source of truth — no off-chain DB)

- `GroupManager.groups: groupId → { name, creator, members[], exists }`;
  `isGroupMember[groupId][addr] → bool`. No per-group expense index, no pagination.
- `ExpenseManager.expenses: expenseId → Expense` (append-only, never deleted).
- `ExpenseManager.debts[groupId][debtor][creditor] → uint256` — the debt graph.
- `ExpenseManager.groupUserNetBalances[groupId][user] → int256`
  (positive = creditor, negative = debtor).

### Invariants

- **Conservation**: sum of net balances per group == 0 after every expense,
  settle, and simplify. Integer division remainder ("dust") is absorbed by the
  payer: the payer is credited `share * n` (EQUAL) or `sum(shares)` (PERCENTAGE),
  not the full `amount`. EXACT has no dust (`total == amount` enforced).
- **`clearDebtsAndBalancesForGroup` clears debts only**, despite the name —
  balances are preserved (required for conservation). Don't "fix" the name by
  zeroing balances; rename only.
- Limits: 50 members/group; `uint16` counters; expense timestamps `uint48`.
- Events exist (`ExpenseAdded`, `DebtSettled`, `DebtsCleared`, …) but there is
  no event/list for "expenses of group" — enumerate via `ExpenseAdded` logs.

## B. Future read-model (not built — YAGNI now)

When lists/pagination are needed: Ponder or The Graph indexer over the events
above → cache in Postgres/SQLite. Declared interface (future):

- `GET /groups/:id/expenses?cursor=&limit=` — expense list
- `GET /groups/:id/balances` — net balances per member
- `GET /groups/:id/debts?simplified=true` — payment plan

Do **not** build a manual off-chain Postgres mirror now — double source of truth.
