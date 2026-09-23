# DEPLOYMENT.md

## Order + wiring

Deploy with Ignition (does everything below in one module):

```bash
pnpm run deploy   # hardhat ignition deploy ignition/modules/TrustDeployment.ts
```

Manual order (same as `test/helpers.ts :: deployContractsSetup`):

1. Deploy `TrustToken` (no args).
2. Deploy `GroupManager` (no args).
3. Deploy `ExpenseManager(groupManager, trustToken)`.
4. Deploy `DebtSimplifier(groupManager, expenseManager)` —
   **order is (groupManager, expenseManager)**; the old module passed them
   inverted and deployed a broken system.
5. `GroupManager.setExpenseManager(expenseManager)` (owner, once).
6. `ExpenseManager.setDebtSimplifierContract(debtSimplifier)` (owner, once).

Without steps 5–6 the system is not connected: groups won't initialize balances
and `simplifyDebts` reverts (`Not debt simplifier`).

## Networks

- Local: `pnpm run deploy` (Hardhat network). No mainnet/testnet config yet —
  add `ignition` network entries + `PRIVATE_KEY` env when Sepolia is needed.
- Solidity 0.8.28, optimizer runs 200.

## Post-deploy checks

- `GROUP_MANAGER` / `EXPENSE_MANAGER` on DebtSimplifier point at the right
  addresses (not swapped).
- `groupManager.expenseManager() != 0`, `expenseManager.debtSimplifierContract() != 0`.
- Create group → add EQUAL expense → `sum(getNetBalance) == 0`.
