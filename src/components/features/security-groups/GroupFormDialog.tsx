import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SecurityGroup } from '@/types/security-group.types';

interface Props {
  /** Existing group → edit mode; null → create mode. */
  group: SecurityGroup | null;
  pending: boolean;
  onSubmit: (data: { groupName: string; description: string }) => Promise<unknown>;
  onClose: () => void;
}

/** Create / edit dialog for a security group's name and description. */
export function GroupFormDialog({ group, pending, onSubmit, onClose }: Props) {
  const [name, setName] = useState(group?.groupName ?? '');
  const [desc, setDesc] = useState(group?.description ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(group?.groupName ?? '');
    setDesc(group?.description ?? '');
    setError('');
  }, [group]);

  const unchanged = !!group && name.trim() === group.groupName && desc.trim() === (group.description ?? '');

  const submit = async () => {
    if (!name.trim()) { setError('Group name is required.'); return; }
    setError('');
    try {
      await onSubmit({ groupName: name.trim(), description: desc.trim() });
    } catch { /* toast handled by mutation */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={() => !pending && onClose()}>
      <Card className="w-full rounded-b-none sm:max-w-md sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">{group ? 'Edit security group' : 'New security group'}</CardTitle>
          <button type="button" onClick={onClose} className="rounded-md p-1 opacity-70 hover:bg-muted hover:opacity-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="sg-name">Group name</Label>
              <Input id="sg-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BRANCH_SUPERVISORS" />
              {!group && <p className="text-xs text-muted-foreground">The new group is created under your own group and starts with no permissions.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sg-desc">Description</Label>
              <Input id="sg-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this group is for (optional)" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="w-full sm:w-auto">Cancel</Button>
              <Button type="submit" disabled={pending || unchanged} className="w-full sm:w-auto">
                {pending ? 'Saving…' : group ? 'Save changes' : 'Create group'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
