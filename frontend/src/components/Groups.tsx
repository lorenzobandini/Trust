import { useState } from 'react';
import { useReadContract, useWriteContract } from 'wagmi';
import { Plus } from '@phosphor-icons/react';
import { ADDRESSES, groupManagerAbi } from '../contracts';
import { parseAddrList } from '../lib/format';
import { Card, Empty, Field, Title, TxStatus, btnCls, ghostCls, inputCls } from './ui';

const GM = () => ADDRESSES.groupManager!;

function GroupRow({
  index,
  account,
  active,
  onSelect,
}: {
  index: number;
  account: `0x${string}`;
  active: boolean;
  onSelect: (id: number) => void;
}) {
  const id = BigInt(index);
  const { data: group } = useReadContract({
    address: GM(), abi: groupManagerAbi, functionName: 'groups', args: [id],
    query: { enabled: ADDRESSES.groupManager !== undefined },
  });
  const { data: member } = useReadContract({
    address: GM(), abi: groupManagerAbi, functionName: 'isGroupMember',
    args: [id, account],
    query: { enabled: ADDRESSES.groupManager !== undefined },
  });
  const { data: members } = useReadContract({
    address: GM(), abi: groupManagerAbi, functionName: 'getGroupMembers',
    args: [id],
    query: { enabled: ADDRESSES.groupManager !== undefined && member === true },
  });
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  if (member !== true) return null;
  const g = group as unknown as [string, string, unknown, boolean] | undefined;
  if (!g || g[3] !== true) return null;
  const [name, creator] = [g[0] as string, g[1] as string];
  const isCreator = creator.toLowerCase() === account.toLowerCase();
  const count = ((members as string[] | undefined) ?? []).length;

  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
        active ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800'
      }`}
    >
      <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(index)}>
        <span className="block truncate font-medium">
          {name || `Group #${index}`} {isCreator && <span className="text-xs text-zinc-500">(yours)</span>}
        </span>
        <span className="block font-mono text-xs text-zinc-500">
          #{index} · {count} member{count === 1 ? '' : 's'}
        </span>
      </button>
      {active ? (
        <div className="flex gap-1">
          <button
            className={ghostCls} disabled={isPending}
            title={isCreator ? 'Delete only with no open debts' : 'Leave only with no open debts — settle first'}
            onClick={() =>
              writeContract({
                address: GM(), abi: groupManagerAbi,
                functionName: isCreator ? 'deleteGroup' : 'leaveGroup',
                args: [id],
              })
            }
          >
            {isCreator ? 'Delete' : 'Leave'}
          </button>
        </div>
      ) : (
        <button className={ghostCls} onClick={() => onSelect(index)}>
          Open
        </button>
      )}
      <TxStatus hash={hash} error={error} />
    </li>
  );
}

export function Groups({
  account,
  activeId,
  onSelect,
}: {
  account: `0x${string}` | undefined;
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [joinId, setJoinId] = useState('');

  const { data: count } = useReadContract({
    address: GM(), abi: groupManagerAbi, functionName: 'getGroupCount',
    query: { enabled: ADDRESSES.groupManager !== undefined },
  });
  const n = Number((count as bigint | undefined) ?? 0n);
  const addrs = parseAddrList(members);
  const typed = members.split(/[\s,]+/).map((a) => a.trim()).filter(Boolean);
  const invalid = typed.length - addrs.length;

  return (
    <div className="space-y-4">
      <Card>
        <Title>Your groups</Title>
        {!account ? (
          <Empty text="Connect your wallet to see your groups." />
        ) : n === 0 ? (
          <Empty text="No groups yet — create one below." />
        ) : (
          <ul className="space-y-2">
            {Array.from({ length: n }, (_, i) => (
              <GroupRow key={i} index={i} account={account} active={activeId === i} onSelect={onSelect} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          Tip: click the pencil next to any address to give it a nickname — saved in this browser.
        </p>
      </Card>

      <Card>
        <Title>Create a group</Title>
        <div className="space-y-3">
          <Field label="Name (max 32 characters)">
            <input className={inputCls} value={name} maxLength={32}
              placeholder="Weekend in Lisbon"
              onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field
            label="Initial members"
            hint={invalid > 0 ? `${invalid} address${invalid === 1 ? '' : 'es'} ignored (must be 0x + 40 hex chars). You are added automatically.` : 'Paste wallet addresses, comma separated. You are added automatically.'}
          >
            <input className={inputCls} value={members}
              placeholder="0x…, 0x…"
              onChange={(e) => setMembers(e.target.value)} />
          </Field>
          <div>
            <button
              className={btnCls} disabled={isPending || !name.trim()}
              onClick={() =>
                writeContract({
                  address: GM(), abi: groupManagerAbi, functionName: 'createGroup',
                  args: [name.trim(), addrs],
                })
              }
            >
              <span className="inline-flex items-center gap-1">
                <Plus size={16} weight="bold" /> Create group
              </span>
            </button>
            <TxStatus hash={hash} error={error} />
          </div>
        </div>
      </Card>

      <Card>
        <Title>Join with an id</Title>
        <div className="flex gap-2">
          <input className={inputCls} value={joinId} placeholder="Group id, e.g. 0"
            onChange={(e) => setJoinId(e.target.value)} />
          <button
            className={ghostCls} disabled={isPending || joinId.trim() === ''}
            onClick={() =>
              writeContract({
                address: GM(), abi: groupManagerAbi, functionName: 'joinGroup',
                args: [BigInt(joinId || '0')],
              })
            }
          >
            Join
          </button>
        </div>
      </Card>
    </div>
  );
}
