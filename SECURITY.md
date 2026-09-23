# SECURITY.md

## Static analysis (slither 0.11.6, solc 0.8.28)

Run: `slither . --solc solc-0.8.28 --exclude-dependencies`.
Baseline: 25 INFO findings, 0 High/Medium. Triage:

- `divide-before-multiply` (`_updateDebts`): intentional — dust to payer,
  conservation invariant holds (tested).
- `reentrancy-no-eth`/`benign` (`settleDebt`): mitigated — `nonReentrant` +
  immutable OZ ERC20 without hooks.
- `calls-loop`: all calls to trusted sibling contracts, bounded ≤ 50 members.
- `reentrancy-events`: events after calls to trusted contracts only.
- `assembly` (array resize), `low-level-calls` (checked ETH `call`),
  `pragma` (OZ `^0.8.20` compiles under one solc), `naming-convention`
  (UPPER immutables): accepted style.
- `missing-inheritance` (`ExpenseManager` vs `IExpenseManager`): deferred,
  rename-only value.
- Not in CI (needs Python+solc runners) — run locally before mainnet.

## Trust model

- Contracts are custodial for ETH (TrustToken holds mint payments) and for
  accounting (debts/balances). No oracles, no external calls except ETH
  transfers (`redeem`, `withdraw`) and `TRUST.transferFrom` (`settleDebt`).
- Owner powers: `TrustToken.withdraw` (all ETH), set-once wiring
  (`setExpenseManager`, `setDebtSimplifierContract`). No upgrade proxy —
  owner cannot change accounting logic, only drain ETH and set wiring once.

## Reentrancy

- `mint`/`redeem`/`withdraw` (`TrustToken`) and `settleDebt` (`ExpenseManager`)
  carry OZ `nonReentrant` (storage-based guard, no EIP-1153 dependency).
  `redeem` additionally burns before the ETH `call` (checks-effects-interactions).
- Ownership is two-step (`Ownable2Step`): `transferOwnership` + `acceptOwnership`.
  Tested in `test/TrustToken.test.ts` ("Ownership Transfer").
- `settleDebt` updates state after `transferFrom` but under the guard; with the
  trusted immutable `TRUST_TOKEN` (plain OZ ERC20, no receiver hooks) there is
  no callback vector — guard is defense in depth.

## Dust / conservation

- EQUAL/PERCENTAGE truncate; remainder is absorbed by the payer (credited only
  the distributed sum). Invariant sum == 0 holds; payer silently overpays dust
  (< n wei per expense). Documented, tested in `test/DustConservation.test.ts`.
- `redeem` reverts on `tokenAmount % MINT_RATE != 0` (`Amount not multiple`)
  instead of silently burning dust value. `ethAmountFull == 0` also reverts
  (`Token amount too small`).

## Redeem fee

- 2% of the ETH value stays in the contract (`REDEMPTION_FEE_PERCENT = 2`);
  only owner can withdraw it. The token side never truncates (non-multiples
  revert); only `(ethAmountBeforeFee * 2) / 100` can truncate sub-wei dust.

## Access-control notes

- `initializeGroupBalances` callable only by GroupManager; groups created
  before wiring keep implicit zero balances (mapping default) — safe.
- `joinGroup` relies on implicit zero balance for newcomers — safe but implicit.
- `leaveGroup`/`deleteGroup` debt scans are O(n²) external `getDebt` calls;
  DoS-safe at 50 members, revisit if the cap rises.
