import { useWaitForTransactionReceipt } from 'wagmi';

export function TxStatus({ hash }: { hash: `0x${string}` | undefined }) {
  const { isLoading, isSuccess, isError } = useWaitForTransactionReceipt({
    hash,
  });
  if (!hash) return null;
  if (isLoading) return <p className="text-sm text-yellow-600">Confirming…</p>;
  if (isError) return <p className="text-sm text-red-600">Failed.</p>;
  if (isSuccess) return <p className="text-sm text-green-600">Confirmed.</p>;
  return null;
}

export const inputCls =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900';
export const btnCls =
  'rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-40';
