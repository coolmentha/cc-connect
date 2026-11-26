import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, RefreshCw } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { getLogs, type LogLine } from '@/api/logs';
import { cn } from '@/lib/utils';

const LEVEL_CLASS: Record<string, string> = {
  DEBUG: 'text-gray-400',
  INFO: 'text-emerald-600 dark:text-emerald-400',
  WARN: 'text-amber-600 dark:text-amber-400',
  ERROR: 'text-red-600 dark:text-red-400',
};

function formatLine(line: LogLine): string {
  const ts = new Date(line.time);
  const time = Number.isNaN(ts.getTime()) ? line.time : ts.toLocaleTimeString();
  return `${time} ${line.level.padEnd(5)} ${line.message}${line.attrs ? ' ' + line.attrs : ''}`;
}

export default function LogsPanel() {
  const { t } = useTranslation();
  const [lines, setLines] = useState<LogLine[]>([]);
  const [total, setTotal] = useState(0);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getLogs(300);
      setLines(res.lines || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [live, load]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('system.logs', 'Logs')}</h3>
          <span className="text-[10px] text-gray-400">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load} loading={loading}>
            <RefreshCw size={12} /> {t('common.refresh')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLive(!live)}>
            {live ? <><Pause size={12} /> {t('system.pause', 'Pause')}</> : <><Play size={12} /> {t('system.resume', 'Resume')}</>}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <div className="max-h-[60vh] overflow-auto rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 p-3">
        {lines.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">{t('system.noLogs', 'No log lines yet')}</p>
        ) : (
          <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words">
            {lines.map((line, i) => (
              <div key={i} className={cn(LEVEL_CLASS[line.level] || 'text-gray-600 dark:text-gray-300')}>
                {formatLine(line)}
              </div>
            ))}
          </pre>
        )}
      </div>
    </Card>
  );
}
