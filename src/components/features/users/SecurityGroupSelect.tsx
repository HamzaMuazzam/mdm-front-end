import { useState } from 'react';
import { Shield, ShieldOff } from 'lucide-react';
import type { SecurityGroup } from '@/types/security-group.types';
import type { User } from '@/types/auth.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  user: User;
  groups: SecurityGroup[];
  /** Hide the control (read-only badge) when the viewer may not change groups. */
  canEdit: boolean;
  /** The logged-in user cannot change their own group. */
  isSelf: boolean;
  pending: boolean;
  onChange: (securityGroupId: number | null) => Promise<unknown> | void;
}

/**
 * Inline security-group picker for a user row. Shows a badge when read-only; a <select>
 * with a confirm step when editable. "— No group —" unassigns (confirmed separately, since
 * it leaves the user with an empty portal).
 */
export function SecurityGroupSelect({ user, groups, canEdit, isSelf, pending, onChange }: Props) {
  const [confirm, setConfirm] = useState<{ target: number | null } | null>(null);

  const current = user.securityGroupId ?? null;
  const currentName = user.securityGroupName ?? groups.find((g) => g.id === current)?.groupName ?? null;
  // The user's current group may be outside the viewer's list (e.g. a parent group) — still show it.
  const options = currentName && current !== null && !groups.some((g) => g.id === current)
    ? [{ id: current, groupName: currentName, description: '' } as SecurityGroup, ...groups]
    : groups;

  if (!canEdit || isSelf) {
    return currentName ? (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700" title={isSelf ? 'You cannot change your own security group' : undefined}>
        <Shield className="h-3 w-3" /> {currentName}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <ShieldOff className="h-3 w-3" /> No group
      </span>
    );
  }

  const targetName = (id: number | null) => (id === null ? 'no security group' : options.find((g) => g.id === id)?.groupName ?? `group #${id}`);

  return (
    <>
      <select
        aria-label={`Security group for ${user.email}`}
        className={`h-8 max-w-[220px] rounded-md border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring ${
          current === null ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-input bg-background'
        }`}
        value={current ?? ''}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value === '' ? null : Number(e.target.value);
          if (next !== current) setConfirm({ target: next });
        }}
      >
        <option value="">— No group —</option>
        {options.map((g) => (
          <option key={g.id} value={g.id}>{g.groupName}</option>
        ))}
      </select>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={() => setConfirm(null)}>
          <Card className="w-full rounded-b-none sm:max-w-md sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {confirm.target === null ? 'Remove security group?' : 'Change security group?'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{user.userName || user.email}</span> will move from{' '}
                <span className="font-medium text-foreground">{currentName ?? 'no group'}</span> to{' '}
                <span className="font-medium text-foreground">{targetName(confirm.target)}</span>.
                {confirm.target === null && (
                  <span className="mt-2 block rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
                    Without a security group this user can sign in but will see an empty portal until a group is assigned.
                  </span>
                )}
                {confirm.target !== null && (
                  <span className="mt-2 block">Their permissions change the next time the portal refreshes (within a minute).</span>
                )}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setConfirm(null)} className="w-full sm:w-auto">Cancel</Button>
                <Button
                  type="button"
                  variant={confirm.target === null ? 'destructive' : 'default'}
                  disabled={pending}
                  className="w-full sm:w-auto"
                  onClick={async () => {
                    await onChange(confirm.target);
                    setConfirm(null);
                  }}
                >
                  {pending ? 'Saving…' : confirm.target === null ? 'Remove group' : 'Move user'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
