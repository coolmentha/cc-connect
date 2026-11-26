import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer as TimerIcon, Plus, Trash2, Terminal, MessageSquare } from 'lucide-react';
import { Button, Badge, Modal, Input, Textarea, EmptyState } from '@/components/ui';
import { listTimers, createTimer, deleteTimer, type TimerJob } from '@/api/timer';
import { listProjects, type ProjectSummary } from '@/api/projects';
import { formatTime } from '@/lib/utils';

interface TimerForm {
  project: string;
  session_key: string;
  delay: string;
  prompt: string;
  exec: string;
  description: string;
  mute: boolean;
  timeout_mins: string;
  _type: 'prompt' | 'exec';
}

const emptyForm: TimerForm = {
  project: '', session_key: '', delay: '', prompt: '', exec: '',
  description: '', mute: false, timeout_mins: '', _type: 'prompt',
};

export default function TimerList() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<TimerJob[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TimerForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [timerData, projData] = await Promise.all([listTimers(), listProjects()]);
      setJobs(timerData.jobs || []);
      setProjects(projData.projects || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const handler = () => fetchData();
    window.addEventListener('cc:refresh', handler);
    return () => window.removeEventListener('cc:refresh', handler);
  }, [fetchData]);

  const handleCreate = async () => {
    setError('');
    const activePrompt = form._type === 'prompt' ? form.prompt : '';
    const activeExec = form._type === 'exec' ? form.exec : '';
    if (!form.project || !form.session_key || !form.delay.trim() || (!activePrompt && !activeExec)) {
      setError(t('timer.required', 'Project, session key, delay and a prompt or command are required'));
      return;
    }
    setSaving(true);
    try {
      await createTimer({
        project: form.project,
        session_key: form.session_key,
        delay: form.delay.trim(),
        prompt: activePrompt,
        exec: activeExec,
        description: form.description,
        mute: form.mute,
        timeout_mins: form.timeout_mins ? parseInt(form.timeout_mins, 10) : null,
      });
      setShowForm(false);
      setForm({ ...emptyForm });
      await fetchData();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (job: TimerJob) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await deleteTimer(job.id);
      await fetchData();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <TimerIcon size={18} className="text-gray-400" /> {t('timer.title', 'Timers')}
        </h2>
        <Button onClick={() => { setForm({ ...emptyForm }); setShowForm(true); }}>
          <Plus size={16} /> {t('timer.add', 'Add timer')}
        </Button>
      </div>

      {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>}

      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse">Loading...</div>
      ) : jobs.length === 0 ? (
        <EmptyState message={t('timer.noJobs', 'No pending timers')} icon={TimerIcon} />
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge>{job.project}</Badge>
                    {job.exec ? <Badge variant="info"><Terminal size={10} className="mr-1" />exec</Badge> : <Badge variant="info"><MessageSquare size={10} className="mr-1" />prompt</Badge>}
                    {job.mute && <Badge>{t('timer.mute', 'Mute')}</Badge>}
                    <span className="text-xs text-gray-400">{formatTime(job.scheduled_at)}</span>
                  </div>
                  {job.description && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{job.description}</p>}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {job.exec || job.prompt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(job)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                  title={t('common.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t('timer.add', 'Add timer')}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('timer.project', 'Project')}</label>
            <select
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="">{t('timer.selectProject', 'Select project')}</option>
              {projects.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <Input
            label={t('timer.sessionKey', 'Session key')}
            value={form.session_key}
            onChange={(e) => setForm({ ...form, session_key: e.target.value })}
            placeholder="bridge:web-...:project"
          />
          <Input
            label={t('timer.delay', 'Delay')}
            value={form.delay}
            onChange={(e) => setForm({ ...form, delay: e.target.value })}
            placeholder="2h, 30m, or 2026-01-01T09:00:00Z"
          />
          <Input
            label={t('timer.description', 'Description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, _type: 'prompt' })}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${form._type === 'prompt' ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
            >
              <MessageSquare size={14} /> {t('timer.promptType', 'Prompt')}
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, _type: 'exec' })}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${form._type === 'exec' ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
            >
              <Terminal size={14} /> {t('timer.execType', 'Command')}
            </button>
          </div>
          {form._type === 'prompt' ? (
            <Textarea
              label={t('timer.prompt', 'Prompt')}
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              rows={3}
            />
          ) : (
            <Input
              label={t('timer.exec', 'Command')}
              value={form.exec}
              onChange={(e) => setForm({ ...form, exec: e.target.value })}
              placeholder="npm run report"
            />
          )}
          <Input
            label={t('timer.timeoutMins', 'Timeout (minutes)')}
            type="number"
            value={form.timeout_mins}
            onChange={(e) => setForm({ ...form, timeout_mins: e.target.value })}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.mute}
              onChange={(e) => setForm({ ...form, mute: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('timer.mute', 'Mute')}</span>
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
            <Button variant="secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button loading={saving} onClick={handleCreate}>{t('timer.add', 'Add timer')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
