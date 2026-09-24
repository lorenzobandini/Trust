import { useState } from 'react';
import type { ReactNode } from 'react';
import { BaseError } from 'viem';
import { useWaitForTransactionReceipt } from 'wagmi';
import { CheckCircle, PencilSimple, WarningCircle } from '@phosphor-icons/react';
import { shortAddr } from '../lib/format';
import { useNames } from '../lib/names';

export function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      {children}
    </section>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">{children}</h2>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-zinc-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none';

export const btnCls =
  'rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition active:scale-[0.98] disabled:opacity-40';

export const ghostCls =
  'rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition active:scale-[0.98] disabled:opacity-40';

export function shortError(e: unknown): string {
  if (e instanceof BaseError) return e.shortMessage.slice(0, 180);
  if (e instanceof Error) return e.message.split('\n')[0].slice(0, 180);
  return 'Transaction failed.';
}

export function TxStatus({
  hash,
  error,
}: {
  hash: `0x${string}` | undefined;
  error?: unknown;
}) {
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (error)
    return (
      <p className="flex items-start gap-1 text-sm text-red-400">
        <WarningCircle size={16} className="mt-0.5 shrink-0" />
        {shortError(error)}
      </p>
    );
  if (!hash) return null;
  if (isLoading) return <p className="text-sm text-amber-400">Confirming…</p>;
  if (isSuccess)
    return (
      <p className="flex items-center gap-1 text-sm text-emerald-400">
        <CheckCircle size={16} /> Confirmed.
      </p>
    );
  return null;
}

/** Address rendered as nickname (editable) + short 0x. */
export function Addr({ value }: { value: string }) {
  const { name, rename } = useNames();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!editing)
    return (
      <span className="inline-flex items-center gap-1">
        <span className="font-medium text-zinc-100">{name(value)}</span>
        <span className="font-mono text-xs text-zinc-500">{shortAddr(value)}</span>
        <button
          className="text-zinc-500 hover:text-zinc-200"
          title="Rename (saved in this browser)"
          onClick={() => {
            setDraft('');
            setEditing(true);
          }}
        >
          <PencilSimple size={14} />
        </button>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        className="w-28 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-sm"
        placeholder="Nickname"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            rename(value, draft);
            setEditing(false);
          }
          if (e.key === 'Escape') setEditing(false);
        }}
      />
      <button
        className="text-sm text-emerald-400"
        onClick={() => {
          rename(value, draft);
          setEditing(false);
        }}
      >
        Save
      </button>
    </span>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-center text-sm text-zinc-500">
      {text}
    </p>
  );
}
