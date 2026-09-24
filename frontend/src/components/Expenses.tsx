import { useState } from 'react';
import { formatEther, parseEther } from 'viem';
import { useReadContract, useWriteContract } from 'wagmi';
import { ADDRESSES, SplitMethod, expenseManagerAbi, groupManagerAbi } from '../contracts';
import { parseAddrList } from '../lib/format';
import { useNames } from '../lib/names';
import { Addr, Card, Empty, Field, Title, TxStatus, btnCls, inputCls } from './ui';

const EM = () => ADDRESSES.expenseManager!;
const GM = () => ADDRESSES.groupManager!;
const METHODS = ['EQUAL', 'EXACT', 'PERCENTAGE'] as const;

function BalanceRow({ groupId, user }: { groupId: bigint; user: string }) {
  const { data } = useReadContract({
    address: EM(), abi: expenseManagerAbi, functionName: 'getNetBalance',
    args: [groupId, user as `0x${string}`],
    query: { enabled: ADDRESSES.expenseManager !== undefined },
  });
  const v = data as bigint | undefined;
  return (
    <li className="flex items-center justify-between py-1">
      <Addr value={user} />
      <span className={`font-mono text-sm ${(v ?? 0n) < 0n ? 'text-red-400' : 'text-emerald-400'}`}>
        {v === undefined ? '…' : `${v > 0n ? '+' : ''}${formatEther(v)}`}
      </span>
    </li>
  );
}

export function Expenses({ groupId }: { groupId: number | null }) {
  const { name } = useNames();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('EQUAL');
  const [participants, setParticipants] = useState('');
  const [splitValues, setSplitValues] = useState('');

  const id = BigInt(groupId ?? 0);
  const { data: members } = useReadContract({
    address: GM(), abi: groupManagerAbi, functionName: 'getGroupMembers',
    args: [id],
    query: { enabled: ADDRESSES.groupManager !== undefined && groupId !== null },
  });
  const memberList = (members as string[] | undefined) ?? [];

  const addrs = parseAddrList(participants);
  const rawValues = splitValues.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
  let values: bigint[] = [];
  let valuesHint = '';
  if (method === 'EXACT') {
    values = rawValues.map((v) => {
      try {
        return parseEther(v);
      } catch {
        return -1n;
      }
    });
    if (rawValues.length !== addrs.length) valuesHint = `Need one amount per participant (${addrs.length}).`;
    else if (values.some((v) => v < 0n)) valuesHint = 'Amounts must be numbers.';
    else {
      const sum = values.reduce((a, b) => a + b, 0n);
      try {
        valuesHint =
          sum === parseEther(amount || '0')
            ? `Sums to ${formatEther(sum)} — matches.`
            : `Sums to ${formatEther(sum)} — must equal the total.`;
      } catch {
        valuesHint = 'Check the total amount.';
      }
    }
  } else if (method === 'PERCENTAGE') {
    values = rawValues.map((v) => (/^\d+$/.test(v) ? BigInt(v) : -1n));
    if (rawValues.length !== addrs.length) valuesHint = `Need one percentage per participant (${addrs.length}).`;
    else if (values.some((v) => v < 0n || v > 100n)) valuesHint = 'Percentages must be whole numbers 0–100.';
    else {
      const sum = values.reduce((a, b) => a + b, 0n);
      valuesHint = sum === 100n ? 'Sums to 100 — good.' : `Sums to ${sum} — must be 100.`;
    }
  }
  const valuesOk = method === 'EQUAL' || valuesHint.includes('matches') || valuesHint.includes('good');

  if (groupId === null)
    return <Empty text="Pick a group in the Groups tab first — expenses belong to a group." />;

  return (
    <div className="space-y-4">
      <Card>
        <Title>Balances — group #{groupId}</Title>
        {memberList.length === 0 ? (
          <Empty text="No members found." />
        ) : (
          <ul className="divide-y divide-zinc-800">
            {memberList.map((m) => (
              <BalanceRow key={m} groupId={id} user={m} />
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          Positive means the group owes them. The total is always 0 — any
          rounding leftover stays with whoever paid.
        </p>
      </Card>

      <Card>
        <Title>Add an expense — you pay</Title>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount (TRUST)">
              <input className={inputCls} inputMode="decimal" value={amount}
                placeholder="120" onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="What for?">
              <input className={inputCls} value={description} placeholder="Hotel"
                onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
          <div>
            <span className="mb-1 block text-sm text-zinc-300">Split</span>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-950 p-1">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-md px-2 py-1.5 text-sm capitalize transition ${
                    method === m ? 'bg-emerald-500 font-semibold text-emerald-950' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {m === 'EQUAL' ? 'Equal' : m === 'EXACT' ? 'Exact' : '%'}
                </button>
              ))}
            </div>
          </div>
          <Field
            label="Participants"
            hint="Wallet addresses, comma separated. Include yourself if you shared it."
          >
            <input className={inputCls} value={participants}
              placeholder="0x…, 0x…"
              onChange={(e) => setParticipants(e.target.value)} />
          </Field>
          {addrs.length > 0 && (
            <p className="text-xs text-zinc-500">
              Splitting between: {addrs.map((a) => name(a)).join(', ')}
            </p>
          )}
          {method !== 'EQUAL' && (
            <Field
              label={method === 'EXACT' ? 'Each share (TRUST, same order)' : 'Each share (%, same order)'}
              hint={valuesHint || undefined}
            >
              <input className={inputCls} value={splitValues}
                placeholder={method === 'EXACT' ? '40, 40, 40' : '34, 33, 33'}
                onChange={(e) => setSplitValues(e.target.value)} />
            </Field>
          )}
          <div>
            <button
              className={btnCls}
              disabled={isPending || !amount || addrs.length === 0 || !valuesOk}
              onClick={() => {
                try {
                  writeContract({
                    address: EM(), abi: expenseManagerAbi, functionName: 'addExpense',
                    args: [id, parseEther(amount || '0'), description, SplitMethod[method], addrs, values],
                  });
                } catch {
                  /* validation error surfaced by disabled state; unreachable */
                }
              }}
            >
              Add expense
            </button>
            <TxStatus hash={hash} error={error} />
          </div>
        </div>
      </Card>
    </div>
  );
}
