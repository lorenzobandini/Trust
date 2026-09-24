import { useState } from 'react';
import { formatEther, parseEther } from 'viem';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { ArrowRight } from '@phosphor-icons/react';
import {
  ADDRESSES, debtSimplifierAbi, expenseManagerAbi, groupManagerAbi, trustTokenAbi,
} from '../contracts';
import { useNames } from '../lib/names';
import { Addr, Card, Empty, Title, TxStatus, btnCls, ghostCls, inputCls, shortError } from './ui';

const EM = () => ADDRESSES.expenseManager!;
const TT = () => ADDRESSES.trustToken!;
const DS = () => ADDRESSES.debtSimplifier!;

function DebtCard({
  groupId, debtor, creditor, isMine, onDone,
}: {
  groupId: bigint; debtor: string; creditor: string; isMine: boolean; onDone: () => void;
}) {
  const { name } = useNames();
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { data, refetch } = useReadContract({
    address: EM(), abi: expenseManagerAbi, functionName: 'getDebt',
    args: [groupId, debtor as `0x${string}`, creditor as `0x${string}`],
    query: { enabled: ADDRESSES.expenseManager !== undefined },
  });
  const debt = (data as bigint | undefined) ?? 0n;
  if (debt === 0n) return null;

  async function pay() {
    setError(null);
    try {
      setStep('1/2 Approving TRUST…');
      await writeContractAsync({
        address: TT(), abi: trustTokenAbi, functionName: 'approve', args: [EM(), debt],
      });
      setStep('2/2 Paying…');
      await writeContractAsync({
        address: EM(), abi: expenseManagerAbi, functionName: 'settleDebt',
        args: [groupId, creditor as `0x${string}`, debt],
      });
      setStep(null);
      refetch();
      onDone();
    } catch (e) {
      setStep(null);
      setError(e);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2">
      <span className="flex items-center gap-1 text-sm">
        <Addr value={debtor} />
        <ArrowRight size={14} className="text-zinc-500" />
        <Addr value={creditor} />
        <span className="font-mono text-zinc-100">{formatEther(debt)}</span>
      </span>
      {isMine ? (
        <span className="flex items-center gap-2">
          {step && <span className="text-xs text-amber-400">{step}</span>}
          <button className={btnCls} disabled={isPending} onClick={pay}>
            Pay {formatEther(debt)}
          </button>
        </span>
      ) : (
        <span className="text-xs text-zinc-500">waiting on {name(debtor)}</span>
      )}
      <TxStatus hash={hash} error={error ?? undefined} />
    </li>
  );
}

export function Settle({ groupId }: { groupId: number | null }) {
  const { address } = useAccount();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const [mintEth, setMintEth] = useState('');
  const [redeemAmt, setRedeemAmt] = useState('');
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const id = BigInt(groupId ?? 0);

  const { data: members } = useReadContract({
    address: ADDRESSES.groupManager!, abi: groupManagerAbi, functionName: 'getGroupMembers',
    args: [id],
    query: { enabled: ADDRESSES.groupManager !== undefined && groupId !== null },
  });
  const { data: trustBal } = useReadContract({
    address: TT(), abi: trustTokenAbi, functionName: 'balanceOf',
    args: [address!],
    query: { enabled: ADDRESSES.trustToken !== undefined && address !== undefined },
  });
  const memberList = (members as string[] | undefined) ?? [];
  const pairs: [string, string][] = [];
  for (const d of memberList) for (const c of memberList) if (d !== c) pairs.push([d, c]);

  if (groupId === null)
    return <Empty text="Pick a group in the Groups tab first — debts belong to a group." />;

  return (
    <div className="space-y-4" key={tick}>
      <Card>
        <Title>Your TRUST</Title>
        <p className="font-mono text-2xl">
          {trustBal === undefined ? '…' : formatEther(trustBal as bigint)}
        </p>
        <div className="mt-3 flex gap-2">
          <input className={inputCls} inputMode="decimal" value={mintEth}
            placeholder="ETH to swap (1 ETH = 1000 TRUST)"
            onChange={(e) => setMintEth(e.target.value)} />
          <button
            className={ghostCls} disabled={isPending || !mintEth}
            onClick={() => {
              try {
                writeContract({
                  address: TT(), abi: trustTokenAbi, functionName: 'mint',
                  value: parseEther(mintEth || '0'),
                });
              } catch (e) {
                void e;
              }
            }}
          >
            Mint
          </button>
        </div>
        <TxStatus hash={hash} error={error ?? undefined} />
      </Card>

      <Card>
        <Title>Debts — group #{groupId}</Title>
        {memberList.length === 0 ? (
          <Empty text="No members found." />
        ) : (
          <ul className="space-y-2">
            {pairs.map(([d, c]) => (
              <DebtCard key={`${d}-${c}`} groupId={id} debtor={d} creditor={c}
                isMine={address?.toLowerCase() === d.toLowerCase()} onDone={bump} />
            ))}
          </ul>
        )}
        <div className="mt-3">
          <button
            className={ghostCls} disabled={isPending}
            onClick={() =>
              writeContract({
                address: DS(), abi: debtSimplifierAbi, functionName: 'simplifyDebts', args: [id],
              })
            }
          >
            Simplify debts
          </button>
          <p className="mt-1 text-xs text-zinc-500">
            Rewrites who-owes-whom into the fewest payments. Balances stay the same.
          </p>
        </div>
      </Card>

      <Card>
        <Title>Cash out</Title>
        <div className="flex gap-2">
          <input className={inputCls} inputMode="decimal" value={redeemAmt}
            placeholder="TRUST to redeem"
            onChange={(e) => setRedeemAmt(e.target.value)} />
          <button
            className={ghostCls} disabled={isPending || !redeemAmt}
            onClick={() => {
              try {
                writeContract({
                  address: TT(), abi: trustTokenAbi, functionName: 'redeem',
                  args: [parseEther(redeemAmt || '0')],
                });
              } catch (e) {
                void e;
              }
            }}
          >
            Redeem
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Multiples of 1000 only, minus 2% fee. {error ? shortError(error) : ''}
        </p>
      </Card>
    </div>
  );
}
