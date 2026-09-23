# SECURITY.md

## Trust model

- Contracts are custodial for ETH (TrustToken holds mint payments) and for
  accounting (debts/balances). No oracles, no external calls except ETH
  transfers (`redeem`, `withdraw`) and `TRUST.transferFrom` (`settleDebt`).
- Owner powers: `TrustToken.withdraw` (all ETH), set-once wiring
  (`setExpenseManager`, `setDebtSimplifierContract`). No upgrade proxy —
  owner cannot change accounting logic, only drain ETH and set wiring once.

## Reentrancy

- `redeem` burns before the ETH `call` (checks-effects-interactions) but has no
  `ReentrancyGuard`; same for `mint`/`withdraw`/`settleDebt`. Risk accepted at
  current size — add `ReentrancyGuard` + `Ownable2Step` before mainnet.
- `settleDebt` updates state after `transferFrom` (external ERC20 call);
  with the trusted TRUST token this is safe, with a malicious token address it
  is not — `TRUST_TOKEN` is immutable so the address is fixed at deploy.

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
