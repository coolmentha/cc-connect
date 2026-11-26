import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Save } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { updateUsers, type UsersSnapshot } from '@/api/users';

interface EditableRole {
  userIDs: string;
  disabledCommands: string;
  maxMessages: string;
  windowSecs: string;
}

function toEditable(snapshot: UsersSnapshot | null): Record<string, EditableRole> {
  if (snapshot?.roles && Object.keys(snapshot.roles).length > 0) {
    const out: Record<string, EditableRole> = {};
    for (const [name, r] of Object.entries(snapshot.roles)) {
      out[name] = {
        userIDs: (r.user_ids || []).join(', '),
        disabledCommands: (r.disabled_commands || []).join(', '),
        maxMessages: r.rate_limit?.max_messages ? String(r.rate_limit.max_messages) : '',
        windowSecs: r.rate_limit?.window_secs ? String(r.rate_limit.window_secs) : '',
      };
    }
    return out;
  }
  // Match the implicit "everyone is a member" behavior when no config exists.
  return { member: { userIDs: '*', disabledCommands: '', maxMessages: '', windowSecs: '' } };
}

function splitList(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function ProjectUsers({ project, snapshot }: { project: string; snapshot: UsersSnapshot | null }) {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Record<string, EditableRole>>(() => toEditable(snapshot));
  const [defaultRole, setDefaultRole] = useState(snapshot?.default_role || 'member');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const roleNames = useMemo(() => Object.keys(roles).sort(), [roles]);

  const updateRole = (name: string, patch: Partial<EditableRole>) => {
    setRoles((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  };

  const addRole = () => {
    const name = window.prompt(t('users.roleName', 'Role name'));
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    if (roles[trimmed]) {
      setError(t('users.roleExists', 'Role already exists'));
      return;
    }
    setRoles((prev) => ({
      ...prev,
      [trimmed]: { userIDs: '', disabledCommands: '', maxMessages: '', windowSecs: '' },
    }));
  };

  const removeRole = (name: string) => {
    if (roleNames.length <= 1) {
      setError(t('users.lastRole', 'At least one role is required'));
      return;
    }
    setRoles((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (defaultRole === name) {
      const remaining = roleNames.filter((r) => r !== name);
      setDefaultRole(remaining[0] || '');
    }
  };

  const handleSave = async () => {
    setError('');
    setMessage('');
    if (!defaultRole || !roles[defaultRole]) {
      setError(t('users.defaultRoleMissing', 'Default role must reference an existing role'));
      return;
    }
    const body: Record<string, { user_ids: string[]; disabled_commands: string[]; rate_limit?: { max_messages: number; window_secs: number } }> = {};
    for (const [name, role] of Object.entries(roles)) {
      const userIDs = splitList(role.userIDs);
      if (userIDs.length === 0) {
        setError(t('users.emptyRole', { name }));
        return;
      }
      const max = parseInt(role.maxMessages, 10);
      const win = parseInt(role.windowSecs, 10);
      body[name] = {
        user_ids: userIDs,
        disabled_commands: splitList(role.disabledCommands),
        ...(max > 0 && win > 0 ? { rate_limit: { max_messages: max, window_secs: win } } : {}),
      };
    }
    setSaving(true);
    try {
      await updateUsers(project, { default_role: defaultRole, roles: body });
      setMessage(t('common.success'));
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t('users.title', 'Users & roles')}</h3>
        <p className="text-[11px] text-gray-400 mb-4">
          {t('users.hint', 'Map platform user IDs to roles. Use * to match every user.')}
        </p>
        <div className="max-w-lg space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('users.defaultRole', 'Default role')}
            </label>
            <select
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {roleNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {roleNames.map((name) => {
        const role = roles[name];
        return (
          <Card key={name}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{name}</h4>
              <button
                type="button"
                onClick={() => removeRole(name)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title={t('common.delete')}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="space-y-3 max-w-lg">
              <Input
                label={t('users.userIds', 'User IDs (comma separated)')}
                value={role.userIDs}
                onChange={(e) => updateRole(name, { userIDs: e.target.value })}
                placeholder="*, ou_xxx, 12345"
              />
              <Input
                label={t('users.disabledCommands', 'Disabled commands (comma separated)')}
                value={role.disabledCommands}
                onChange={(e) => updateRole(name, { disabledCommands: e.target.value })}
                placeholder="shell, upgrade"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('users.maxMessages', 'Rate limit (messages)')}
                  type="number"
                  value={role.maxMessages}
                  onChange={(e) => updateRole(name, { maxMessages: e.target.value })}
                  placeholder="20"
                />
                <Input
                  label={t('users.windowSecs', 'Window (seconds)')}
                  type="number"
                  value={role.windowSecs}
                  onChange={(e) => updateRole(name, { windowSecs: e.target.value })}
                  placeholder="60"
                />
              </div>
            </div>
          </Card>
        );
      })}

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={addRole}><Plus size={14} /> {t('users.addRole', 'Add role')}</Button>
        <Button loading={saving} onClick={handleSave}><Save size={14} /> {t('common.save')}</Button>
        {message && <span className="text-sm text-accent">{message}</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}
