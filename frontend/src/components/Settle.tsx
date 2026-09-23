import { useState } from 'react';
import { formatEther, parseEther } from 'viem';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import {
  ADDRESSES, debtSimplifierAbi, expenseManagerAbi, groupManagerAbi, trustTokenAbi,
} from '../contracts';
import { TxStatus, btnCls, inputCls } from './TxStatus';

const EM = () => ADDRESSES.expenseManager!;
const TT = () => ADDRESSES.trustToken!;

function DebtRow({ groupId, debtor, creditor, onPaid }: {
  groupId: bigint; debtor: string; creditor: string; onPaid: () => void;
}) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { data, refetch } = useReadContract({
    address: EM(), abi: expenseManagerAbi, functionName: 'getDebt',
    args: [groupId, debtor as `0x${string}`, creditor as `0x${string}`],
    query: { enabled: ADDRESSES.expenseManager !== undefined },
  });
  const debt = (data as bigint | undefined) ?? 0n;
  if (debt === 0n) return null;
  const mine = address?.toLowerCase() === debtor.toLowerCase();
  return (
    <li className="flex items-center gap-2">
      <span>{debtor.slice(0, 6)}… owes {creditor.slice(0, 6)}… {formatEther(debt)} TRUST</span>
      {mine && (
        <>
          <button className={btnCls} disabled={isPending}
            onClick={async () => {
              await writeContract({
                address: TT(), abi: trustTokenAbi, functionName: 'approve',
                args: [EM(), debt],
              });
            }}>Approve</button>
          <button className={btnCls} disabled={isPending}
            onClick={() => writeContract({
              address: EM(), abi: expenseManagerAbi, functionName: 'settleDebt',
              args: [groupId, creditor as `0x${string}`, debt],
            }, { onSuccess: () => { refetch(); onPaid(); } })}>Pay</button>
        </>
      )}
      <TxStatus hash={hash} />
    </li>
  );
}

export function Settle() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const [groupId, setGroupId] = useState('0');
  const [mintEth, setMintEth] = useState('');
  const [tick, setTick] = useState(0);
  const id = BigInt(groupId || '0');

  const { data: members } = useReadContract({
    address: ADDRESSES.groupManager!, abi: groupManagerAbi, functionName: 'getGroupMembers',
    args: [id],
    query: { enabled: ADDRESSES.groupManager !== undefined },
  });
  const memberList = (members as string[] | undefined) ?? [];
  const pairs: [string, string][] = [];
  for (const d of memberList) for (const c of memberList) if (d !== c) pairs.push([d, c]);

  return (
    <div className="space-y-6" key={tick}>
      <section className="space-y-2">
        <h2 className="font-semibold">Mint TRUST (1 ETH = 1000)</h2>
        <input className={inputCls} placeholder="ETH amount" value={mintEth}
          onChange={(e) => setMintEth(e.target.value)} />
        <button className={btnCls} disabled={isPending || !mintEth}
          onClick={() => writeContract({
            address: TT(), abi: trustTokenAbi, functionName: 'mint',
            value: parseEther(mintEth || '0'),
          })}>Mint</button>
        <TxStatus hash={hash} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Debts</h2>
        <input className={inputCls} placeholder="Group id" value={groupId}
          onChange={(e) => setGroupId(e.target.value)} />
        <button className={btnCls} disabled={isPending}
          onClick={() => writeContract({
            address: ADDRESSES.debtSimplifier!, abi: debtSimplifierAbi,
            functionName: 'simplifyDebts', args: [id],
          }, { onSuccess: () => setTick((t) => t + 1) })}>Simplify debts</button>
        <ul className="space-y-1 text-sm">
          {pairs.map(([d, c]) => (
            <DebtRow key={`${d}-${c}`} groupId={id} debtor={d} creditor={c}
              onPaid={() => setTick((t) => t + 1)} />
          ))}
        </ul>
      </section>
    </div>
  );
}
