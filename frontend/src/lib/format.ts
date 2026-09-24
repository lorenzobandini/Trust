import { formatEther } from 'viem';

export function fmtTrust(v: bigint | undefined): string {
  return v === undefined ? '…' : formatEther(v);
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function parseAddrList(s: string): `0x${string}`[] {
  return s
    .split(/[\s,]+/)
    .map((a) => a.trim())
    .filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a)) as `0x${string}`[];
}
