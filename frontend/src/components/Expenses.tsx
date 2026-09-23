import { useState } from 'react';
import { formatEther, parseEther } from 'viem';
import { useReadContract, useWriteContract } from 'wagmi';
import { ADDRESSES, SplitMethod, expenseManagerAbi, groupManagerAbi } from '../contracts';
import { TxStatus, btnCls, inputCls } from './TxStatus';

const EM = () => ADDRESSES.expenseManager!;
const GM = () => ADDRESSES.groupManager!;

function Balance({ groupId, user }: { groupId: bigint; user: string }) {
  const { data } = useReadContract({
    address: EM(), abi: expenseManagerAbi, functionName: 'getNetBalance',
    args: [groupId, user as `0x${string}`],
    query: { enabled: ADDRESSES.expenseManager !== undefined },
  });
  const v = data as bigint | undefined;
  return <li>{user}: {v === undefined ? '…' : formatEther(v)} TRUST</li>;
}

export function Expenses() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const [groupId, setGroupId] = useState('0');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<keyof typeof SplitMethod>('EQUAL');
  const [participants, setParticipants] = useState('');
  const [splitValues, setSplitValues] = useState('');

  const id = BigInt(groupId || '0');
  const { data: members } = useReadContract({
    address: GM(), abi: groupManagerAbi, functionName: 'getGroupMembers',
    args: [id],
    query: { enabled: ADDRESSES.groupManager !== undefined },
  });
  const memberList = (members as string[] | undefined) ?? [];

  const addrs = participants.split(/[\s,]+/).map((a) => a.trim()).filter(Boolean) as `0x${string}`[];
  const values =
    method === 'EQUAL'
      ? []
      : method === 'EXACT'
        ? splitValues.split(/[\s,]+/).filter(Boolean).map((v) => parseEther(v.trim()))
        : splitValues.split(/[\s,]+/).filter(Boolean).map((v) => BigInt(v.trim()));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-semibold">Add expense (you pay)</h2>
        <input className={inputCls} placeholder="Group id" value={groupId}
          onChange={(e) => setGroupId(e.target.value)} />
        <input className={inputCls} placeholder="Amount in TRUST" value={amount}
          onChange={(e) => setAmount(e.target.value)} />
        <input className={inputCls} placeholder="Description" value={description}
          onChange={(e) => setDescription(e.target.value)} />
        <select className={inputCls} value={method}
          onChange={(e) => setMethod(e.target.value as keyof typeof SplitMethod)}>
          <option value="EQUAL">Equal</option>
          <option value="EXACT">Exact amounts</option>
          <option value="PERCENTAGE">Percentages</option>
        </select>
        <input className={inputCls} placeholder="Participants 0x…, 0x…"
          value={participants} onChange={(e) => setParticipants(e.target.value)} />
        {method !== 'EQUAL' && (
          <input className={inputCls}
            placeholder={method === 'EXACT' ? 'Amounts in TRUST, same order' : 'Percentages, sum 100'}
            value={splitValues} onChange={(e) => setSplitValues(e.target.value)} />
        )}
        <button className={btnCls} disabled={isPending || !amount}
          onClick={() => writeContract({
            address: EM(), abi: expenseManagerAbi, functionName: 'addExpense',
            args: [id, parseEther(amount || '0'), description, SplitMethod[method], addrs, values],
          })}>
          Add expense
        </button>
        <TxStatus hash={hash} />
        <p className="text-xs text-gray-500">
          Non-divisible remainder is absorbed by you (the payer).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Net balances</h2>
        <ul className="text-sm">
          {memberList.map((m) => <Balance key={m} groupId={id} user={m} />)}
        </ul>
      </section>
    </div>
  );
}
