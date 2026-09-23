# AGENTS.md

## Toolchain (Hardhat 3, Node ≥ 22.13, ESM)

- `hardhat@3` + `@nomicfoundation/hardhat-toolbox-mocha-ethers` +
  `hardhat-ignition-ethers` + `hardhat-network-helpers` + `hardhat-typechain`.
  No `ts-node`, no gas-reporter, no solidity-coverage (H3 has native
  `--coverage` and `--gas-stats` flags).
- ESM (`"type": "module"`, tsconfig nodenext): relative imports in tests use
  `.js` extensions (`./helpers.js`); no global `hre.ethers`.
- Tests connect per file: `const { ethers, networkHelpers } = await network.create()`
  in `test/helpers.ts`, which re-exports `ethers` + `loadFixture` for all suites.
- Contract types are generated to `types/ethers-contracts/` on build; deploy
  in tests via generated factories (`new TrustToken__factory(owner).deploy()`),
  because H3 `deployContract` returns untyped `BaseContract`.
- Regression test for the Ignition module lives in `test/TrustDeployment.test.ts`
  (constructor order + wiring assertions).

## Commands (pnpm; CI uses npm)

- `pnpm run compile` — `hardhat build` (also regenerates `types/`)
- `pnpm run test` — full suite (Mocha + ethers v6 on H3 connections)
- `pnpm run test:coverage` — `hardhat test --coverage` (native, no plugin)
- `pnpm run test:gas` — `hardhat test --gas-stats` (native, Windows-safe)
- `pnpm run lint` — `eslint` (ignition + test) + `solhint` (contracts)
- `pnpm run format` — prettier write on ignition + test
- `pnpm run deploy` — `hardhat ignition deploy ./ignition/modules/TrustDeployment.ts` (in-memory network by default; add `--network localhost` with `hardhat node` running)

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
