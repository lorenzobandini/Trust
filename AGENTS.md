# AGENTS.md

## Commands (pnpm; CI uses npm)

- `pnpm run compile` — compile contracts
- `pnpm run test` — full test suite (Hardhat + ethers v6 + TypeScript)
- `pnpm run test:coverage` — coverage (also runs tests)
- `pnpm run test:gas` — tests with gas report (`gas-report.txt`)
- `pnpm run lint` — `eslint` (ignition + test) + `solhint` (contracts)
- `pnpm run format` — prettier write on ignition + test
- `pnpm run deploy` — `hardhat ignition deploy ignition/modules/TrustDeployment.ts`

## Wiring (order matters, set-once)

1. Deploy `TrustToken`, `GroupManager`.
2. Deploy `ExpenseManager(groupManager, trustToken)`.
3. Deploy `DebtSimplifier(groupManager, expenseManager)` — **never invert**:
   constructor is `(address _groupManager, address _expenseManager)`.
4. Call `GroupManager.setExpenseManager(expenseManager)` then
   `ExpenseManager.setDebtSimplifierContract(debtSimplifier)`.
   Both are set-once (`Already set`). Ignition module does deploy + wiring
   together; tests do the same in `test/helpers.ts` (`deployContractsSetup`).

## Conventions

- Solidity `0.8.28`, pragma `^0.8.28` in every contract.
- Short revert strings (< 32 chars) for gas.
- `uint16` loop counters (max 50 members); never `uint8` for member loops.
- Dust rule: payer absorbs integer-division remainder (EQUAL/PERCENTAGE);
  `TrustToken.redeem` reverts unless `tokenAmount % MINT_RATE == 0`.
  Invariant: sum of net balances per group == 0 after every expense.
- No off-chain DB: on-chain mappings are the source of truth; read-model
  (Ponder/The Graph) is future work, see `DATABASE.md`.
