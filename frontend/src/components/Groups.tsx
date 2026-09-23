import { useState } from 'react';
import { useReadContract, useWriteContract } from 'wagmi';
import { ADDRESSES, groupManagerAbi } from '../contracts';
import { TxStatus, btnCls, inputCls } from './TxStatus';

const GM = () => ADDRESSES.groupManager!;

export function Groups() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [groupId, setGroupId] = useState('0');

  const id = BigInt(groupId || '0');
  const { data: group } = useReadContract({
    address: GM(),
    abi: groupManagerAbi,
    functionName: 'groups',
    args: [id],
    query: { enabled: ADDRESSES.groupManager !== undefined },
  });
  const { data: memberList } = useReadContract({
    address: GM(),
    abi: groupManagerAbi,
    functionName: 'getGroupMembers',
    args: [id],
    query: { enabled: ADDRESSES.groupManager !== undefined },
  });

  const splitAddrs = (s: string) =>
    s.split(/[\s,]+/).map((a) => a.trim()).filter(Boolean) as `0x${string}`[];

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-semibold">Create group</h2>
        <input className={inputCls} placeholder="Name (≤32 chars)" value={name}
          onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="Initial members, comma separated 0x…"
          value={members} onChange={(e) => setMembers(e.target.value)} />
        <button className={btnCls} disabled={isPending || !name}
          onClick={() => writeContract({
            address: GM(), abi: groupManagerAbi, functionName: 'createGroup',
            args: [name, splitAddrs(members)],
          })}>
          Create
        </button>
        <TxStatus hash={hash} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Inspect / join / leave</h2>
        <input className={inputCls} placeholder="Group id" value={groupId}
          onChange={(e) => setGroupId(e.target.value)} />
        {Array.isArray(group) && (
          <p className="text-sm">
            #{groupId} “{(group[0] as string) || '—'}” creator {group[1] as string}{' '}
            {(group[3] as boolean) ? '' : '(deleted)'}
          </p>
        )}
        <ul className="text-sm">
          {((memberList as string[]) ?? []).map((m) => <li key={m}>{m}</li>)}
        </ul>
        <div className="flex gap-2">
          <button className={btnCls} disabled={isPending}
            onClick={() => writeContract({
              address: GM(), abi: groupManagerAbi, functionName: 'joinGroup', args: [id],
            })}>Join</button>
          <button className={btnCls} disabled={isPending}
            onClick={() => writeContract({
              address: GM(), abi: groupManagerAbi, functionName: 'leaveGroup', args: [id],
            })}>Leave</button>
        </div>
      </section>
    </div>
  );
}
