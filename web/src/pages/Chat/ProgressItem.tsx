import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Brain, Terminal, FileText, FileSearch, Search, Globe, Wrench,
  CheckCircle2, XCircle, ChevronRight, Copy, Check,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';

export interface ProgressData {
  kind?: string;
  content: string;
  toolName?: string;
  toolInput?: string;
  toolIndex?: number;
  status?: string;
  exitCode?: number;
  success?: boolean;
}

interface Parsed {
  kind: 'thinking' | 'tool' | 'tool_result';
  content: string;
  toolName?: string;
  toolInput?: string;
  toolIndex?: number;
  status?: string;
  exitCode?: number;
  success?: boolean;
}

function stripCodeFence(text: string): string {
  const m = text.trim().match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  return m ? m[1] : text.trim();
}

// parseLegacy understands progress entries written before structured fields
// existed, so old sessions stay readable.
function parseLegacy(content: string): Partial<Parsed> {
  const tool = content.match(/^🔧\s*\*\*[^*#]*#(\d+):\s*([^*]+)\*\*\s*\n-{3,}\n([\s\S]*)$/);
  if (tool) {
    return {
      kind: 'tool',
      toolIndex: Number(tool[1]),
      toolName: tool[2].trim(),
      toolInput: stripCodeFence(tool[3]),
    };
  }
  const result = content.match(/^📤\s*\*\*([^*]+)\*\*\s*\n-{3,}\n([\s\S]*)$/);
  if (result) {
    return { kind: 'tool_result', toolName: result[1].trim(), content: result[2].trim() };
  }
  if (content.startsWith('💭')) {
    return { kind: 'thinking', content: content.replace(/^💭\s*/, '') };
  }
  return {};
}

function parseInput(raw?: string): { summary: string; pretty: string } {
  if (!raw) return { summary: '', pretty: '' };
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const obj = JSON.parse(trimmed);
      const pretty = JSON.stringify(obj, null, 2);
      const candidate = obj.command ?? obj.file_path ?? obj.path ?? obj.pattern ??
        obj.url ?? obj.query ?? obj.description ?? '';
      const summary = typeof candidate === 'string' ? candidate.split('\n')[0] : '';
      return { summary, pretty };
    } catch {
      // not JSON; fall through
    }
  }
  return { summary: trimmed.split('\n')[0].slice(0, 120), pretty: trimmed };
}

function toolIcon(name?: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('bash') || n.includes('shell') || n.includes('exec') || n.includes('terminal')) return Terminal;
  if (n.includes('read') || n.includes('view')) return FileSearch;
  if (n.includes('edit') || n.includes('write') || n.includes('patch')) return FileText;
  if (n.includes('grep') || n.includes('glob') || n.includes('search')) return Search;
  if (n.includes('web') || n.includes('fetch') || n.includes('http')) return Globe;
  return Wrench;
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 rounded text-gray-400 hover:text-accent transition-colors"
      title={t('common.copy', 'Copy')}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function normalize(data: ProgressData): Parsed {
  const legacy = parseLegacy(data.content || '');
  const rawKind = data.kind || legacy.kind || 'thinking';
  const kind: Parsed['kind'] = rawKind === 'tool_result' ? 'tool_result' : rawKind === 'tool' ? 'tool' : 'thinking';
  return {
    kind,
    content: legacy.content ?? data.content ?? '',
    toolName: data.toolName || legacy.toolName,
    toolInput: data.toolInput || legacy.toolInput,
    toolIndex: data.toolIndex || legacy.toolIndex,
    status: data.status,
    exitCode: data.exitCode,
    success: data.success,
  };
}

export default function ProgressItem({ data }: { data: ProgressData }) {
  const parsed = useMemo(() => normalize(data), [data]);
  if (parsed.kind === 'tool') return <ToolItem p={parsed} />;
  if (parsed.kind === 'tool_result') return <ResultItem p={parsed} />;
  return <ThinkingItem p={parsed} />;
}

const SUMMARY_CLASS =
  'flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden';

function ThinkingItem({ p }: { p: Parsed }) {
  const { t } = useTranslation();
  const preview = p.content.replace(/[#*`>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return (
    <details className="group rounded-lg border border-gray-200/70 dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.02]">
      <summary className={SUMMARY_CLASS}>
        <Brain size={14} className="text-gray-400 shrink-0" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 shrink-0">
          {t('chat.thinking', 'Thinking')}
        </span>
        <span className="text-xs text-gray-400 truncate flex-1">{preview}</span>
        <ChevronRight size={13} className="text-gray-400 group-open:rotate-90 transition-transform shrink-0" />
      </summary>
      <div className="border-t border-gray-200/60 dark:border-white/[0.06] px-3 py-2">
        <div className="prose prose-sm max-w-none dark:prose-invert text-[13px] text-gray-600 dark:text-gray-300">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{p.content}</Markdown>
        </div>
      </div>
    </details>
  );
}

function ToolItem({ p }: { p: Parsed }) {
  const { t } = useTranslation();
  const Icon = toolIcon(p.toolName);
  const input = parseInput(p.toolInput);
  return (
    <details className="group rounded-lg border border-gray-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] overflow-hidden">
      <summary className={SUMMARY_CLASS}>
        <span className="w-5 h-5 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
          <Icon size={12} className="text-accent" />
        </span>
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 shrink-0">
          {p.toolName || t('chat.tool', 'Tool')}
        </span>
        {p.toolIndex ? <span className="text-[10px] text-gray-400 shrink-0">#{p.toolIndex}</span> : null}
        {input.summary ? (
          <code className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex-1 font-mono">
            {input.summary}
          </code>
        ) : (
          <span className="flex-1" />
        )}
        <ChevronRight size={13} className="text-gray-400 group-open:rotate-90 transition-transform shrink-0" />
      </summary>
      <div className="border-t border-gray-200/60 dark:border-white/[0.06] px-3 py-2">
        {input.pretty ? (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">
                {t('chat.arguments', 'Arguments')}
              </span>
              <CopyButton text={input.pretty} />
            </div>
            <pre className="max-h-72 overflow-auto rounded-md bg-gray-50 dark:bg-black/30 border border-gray-200/60 dark:border-white/[0.06] p-2 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words">
              {input.pretty}
            </pre>
          </>
        ) : (
          <p className="text-xs text-gray-400">{t('chat.noArguments', 'No arguments')}</p>
        )}
      </div>
    </details>
  );
}

function ResultItem({ p }: { p: Parsed }) {
  const { t } = useTranslation();
  const failed = p.success === false || (p.exitCode !== undefined && p.exitCode !== 0);
  const Icon = failed ? XCircle : CheckCircle2;
  return (
    <details
      className={cn(
        'group ml-6 rounded-lg border-l-2 bg-gray-50/50 dark:bg-white/[0.02]',
        failed ? 'border-l-red-400/70' : 'border-l-emerald-400/70',
        'border-y border-r border-gray-200/60 dark:border-white/[0.06]',
      )}
    >
      <summary className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <Icon size={13} className={cn(failed ? 'text-red-500' : 'text-emerald-500', 'shrink-0')} />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {p.toolName ? `${p.toolName} · ` : ''}{t('chat.result', 'Result')}
        </span>
        {p.exitCode !== undefined && <span className="text-[10px] text-gray-400">exit {p.exitCode}</span>}
        {p.status && <span className="text-[10px] text-gray-400 truncate">{p.status}</span>}
        <ChevronRight size={12} className="text-gray-400 group-open:rotate-90 transition-transform ml-auto shrink-0" />
      </summary>
      <div className="border-t border-gray-200/60 dark:border-white/[0.06] px-3 py-2">
        {p.content ? (
          <>
            <div className="flex justify-end mb-1"><CopyButton text={p.content} /></div>
            <pre className="max-h-72 overflow-auto rounded-md bg-gray-50 dark:bg-black/30 border border-gray-200/60 dark:border-white/[0.06] p-2 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words">
              {p.content}
            </pre>
          </>
        ) : (
          <p className="text-xs text-gray-400">{t('chat.emptyResult', 'No output')}</p>
        )}
      </div>
    </details>
  );
}
