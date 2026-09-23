import type { Abi, Address } from 'viem';
import GroupManagerArtifact from '../../artifacts/contracts/GroupManager.sol/GroupManager.json';
import ExpenseManagerArtifact from '../../artifacts/contracts/ExpenseManager.sol/ExpenseManager.json';
import DebtSimplifierArtifact from '../../artifacts/contracts/DebtSimplifier.sol/DebtSimplifier.json';
import TrustTokenArtifact from '../../artifacts/contracts/TrustToken.sol/TrustToken.json';

// ABIs come from `pnpm run compile` output (run it before `pnpm dev`).
export const groupManagerAbi = GroupManagerArtifact.abi as unknown as Abi;
export const expenseManagerAbi = ExpenseManagerArtifact.abi as unknown as Abi;
export const debtSimplifierAbi = DebtSimplifierArtifact.abi as unknown as Abi;
export const trustTokenAbi = TrustTokenArtifact.abi as unknown as Abi;

function envAddress(v: string | undefined): Address | undefined {
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined;
}

// Addresses come from `.env` — copy them from the Ignition deploy output
// (`pnpm run deploy` against a local node). See README.
export const ADDRESSES = {
  groupManager: envAddress(import.meta.env.VITE_GROUP_MANAGER),
  expenseManager: envAddress(import.meta.env.VITE_EXPENSE_MANAGER),
  debtSimplifier: envAddress(import.meta.env.VITE_DEBT_SIMPLIFIER),
  trustToken: envAddress(import.meta.env.VITE_TRUST_TOKEN),
};

export const ADDRESSES_SET = Object.values(ADDRESSES).every(Boolean);

export const SplitMethod = { EQUAL: 0, EXACT: 1, PERCENTAGE: 2 } as const;
