import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode, RefreshCw, RotateCcw, Settings2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';
import { restartSystem, reloadConfig, getStatus, type SystemStatus } from '@/api/status';
import api from '@/api/client';
import GlobalSettings from './GlobalSettings';
import LogsPanel from './LogsPanel';
import { notificationsEnabled, setNotificationsEnabled, requestNotificationPermission } from '@/lib/notify';
import { getWebClientId, getWebDisplayName, setWebDisplayName } from '@/lib/webIdentity';

export default function SystemConfig() {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [format, setFormat] = useState<'toml' | 'json'>('toml');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const version = status?.version || '';
  const [notifEnabled, setNotifEnabledState] = useState(() => notificationsEnabled());
  const [displayName, setDisplayName] = useState(() => getWebDisplayName());

  const toggleNotifications = async (next: boolean) => {
    if (next) {
      const ok = await requestNotificationPermission();
      if (!ok) {
        setActionMsg(t('system.notificationsDenied', 'Notification permission was denied by the browser.'));
        return;
      }
    }
    setNotificationsEnabled(next);
    setNotifEnabledState(next);
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const text = await api.raw('/config');
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const obj = JSON.parse(trimmed);
          setContent(JSON.stringify(obj, null, 2));
          setFormat('json');
        } catch {
          setContent(text);
          setFormat('toml');
        }
      } else {
        setContent(text);
        setFormat('toml');
      }
    } catch {
      setContent('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    getStatus().then((s) => setStatus(s)).catch(() => {});
    const handler = () => fetchConfig();
    window.addEventListener('cc:refresh', handler);
    return () => window.removeEventListener('cc:refresh', handler);
  }, [fetchConfig]);

  const handleRestart = async () => {
    if (!confirm(t('system.restartConfirm'))) return;
    try {
      await restartSystem();
      setActionMsg(t('common.success'));
    } catch (e: any) {
      setActionMsg(e.message);
    }
  };

  const handleReload = async () => {
    if (!confirm(t('system.reloadConfirm'))) return;
    try {
      await reloadConfig();
      setActionMsg(t('common.success'));
      fetchConfig();
    } catch (e: any) {
      setActionMsg(e.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in ">
      {/* Version & upgrade */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('system.version', 'Version')}</h3>
            <p className="text-sm font-mono text-gray-700 dark:text-gray-300 mt-1">{version || '-'}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              {t('system.upgradeHint', 'To upgrade, run "cc-connect upgrade" or send /upgrade in chat.')}
            </p>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('system.notifications', 'Desktop notifications')}</h3>
            <p className="text-[11px] text-gray-400 mt-1">
              {t('system.notificationsHint', 'Show a browser notification when an agent reply arrives while this tab is in the background.')}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={notifEnabled}
              onChange={(e) => toggleNotifications(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('common.enable', 'Enable')}</span>
          </label>
        </div>
      </Card>

      {/* Web identity */}
      <Card>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('system.webIdentity', 'Web identity')}</h3>
          <p className="text-[11px] text-gray-400 mt-1">{t('system.webIdentityHint', 'Each browser gets its own agent session.')}</p>
          <p className="text-[10px] font-mono text-gray-400 mt-1">ID: {getWebClientId()}</p>
        </div>
        <div className="mt-3 max-w-sm space-y-2">
          <Input
            label={t('system.webDisplayName', 'Display name')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              setWebDisplayName(displayName);
              setActionMsg(t('system.webIdentitySaved', 'Saved. Reload the page to apply the display name.'));
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      </Card>

      {/* Bridge status */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('system.bridgeStatus', 'Bridge')}</h3>
        <p className="text-[11px] text-gray-400 mt-1">
          {t('system.bridgeStatusHint', 'The web chat and external adapters connect through the Bridge WebSocket server.')}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
          <div>{t('system.bridgeEnabled', 'Enabled')}: <span className="font-mono">{(status as any)?.bridge?.enabled ? 'yes' : 'no'}</span></div>
          <div>{t('system.bridgePort', 'Port')}: <span className="font-mono">{(status as any)?.bridge?.port ?? '-'}</span></div>
          <div>{t('system.bridgePath', 'Path')}: <span className="font-mono">{(status as any)?.bridge?.path ?? '-'}</span></div>
          <div>{t('system.bridgeToken', 'Token set')}: <span className="font-mono">{(status as any)?.bridge?.token_set ? 'yes' : 'no'}</span></div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={handleReload}><RefreshCw size={16} /> {t('system.reload')}</Button>
        <Button variant="danger" onClick={handleRestart}><RotateCcw size={16} /> {t('system.restart')}</Button>
      </div>

      {actionMsg && (
        <div className="text-sm text-accent bg-accent/10 border border-accent/20 rounded-lg px-4 py-2">{actionMsg}</div>
      )}

      {/* Global Settings */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings2 size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.title', 'Global Settings')}</h2>
        </div>
        <GlobalSettings />
      </div>

      {/* Raw Config (collapsible) */}
      <Card>
        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="flex items-center gap-2 w-full text-left"
        >
          {showRaw ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          <FileCode size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('system.rawConfig', 'Raw Config')}</h3>
          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded uppercase">
            {format}
          </span>
        </button>
        {showRaw && (
          <div className="mt-3">
            {loading ? (
              <div className="text-gray-400 animate-pulse text-sm">Loading...</div>
            ) : (
              <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 overflow-auto max-h-[65vh] font-mono leading-relaxed whitespace-pre">
                {content || t('common.noData')}
              </pre>
            )}
          </div>
        )}
      </Card>

      {/* Logs */}
      <LogsPanel />
    </div>
  );
}
