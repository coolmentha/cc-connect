import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Send, User, Bot, Circle, WifiOff,
  Copy, Check, FileText, Image as ImageIcon, Loader2,
  Slash, ChevronDown, ChevronRight, Paperclip, X, Download, Music, Video,
  Activity, XCircle, Clock,
} from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { listSessions, getSession, deleteSession, renameSession, type Session, type SessionDetail } from '@/api/sessions';
import {
  useBridgeSocket, fetchBridgeConfig,
  type BridgeConfigResult, type BridgeIncoming, type BridgeStatus, type OutgoingAttachment,
} from '@/hooks/useBridgeSocket';
import { webSessionKey as makeWebSessionKey, webUserId, webUserName, webPlatformName } from '@/lib/webIdentity';
import { notify } from '@/lib/notify';
import CommandPalette, { type SlashCommand, slashCommands } from './CommandPalette';
import SessionDrawer from './SessionDrawer';
import ProgressItem, { type ProgressData, formatDuration, TurnStatsBar } from './ProgressItem';
import CommandResultPanel, { type CommandResult } from './CommandResultPanel';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';

// ── Markdown renderers ───────────────────────────────────────

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-200/80 dark:bg-gray-700/80 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function PreBlock({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const codeEl = (children as any)?.props;
  const lang = codeEl?.className?.replace(/^language-/, '') || '';
  const code = typeof codeEl?.children === 'string' ? codeEl.children.replace(/\n$/, '') : '';
  return (
    <div className="not-prose relative group my-4">
      {lang && (
        <div className="absolute top-0 left-0 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-tl-lg rounded-br-lg border-b border-r border-gray-200 dark:border-gray-700 font-mono">
          {lang}
        </div>
      )}
      <CopyButton code={code} />
      <pre className="overflow-x-auto rounded-lg bg-[#fafafa] dark:bg-[#0d1117] border border-gray-200 dark:border-gray-700/60 p-4 pt-8 text-[13px] leading-[1.6] font-mono" {...props}>
        {children}
      </pre>
    </div>
  );
}

function InlineCode({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  if (className) return <code className={className} {...props}>{children}</code>;
  return (
    <code className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 text-[0.875em] font-mono border border-gray-200/60 dark:border-gray-700/40" {...props}>
      {children}
    </code>
  );
}

function RenderMarkdown({ content }: { content: string }) {
  return (
    <div className={cn(
      'prose max-w-none dark:prose-invert',
      'prose-headings:font-semibold prose-headings:tracking-tight',
      'prose-h1:text-xl prose-h1:mt-5 prose-h1:mb-3 prose-h1:pb-1.5 prose-h1:border-b prose-h1:border-gray-200 dark:prose-h1:border-gray-700',
      'prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2',
      'prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2',
      'prose-p:my-2.5 prose-p:leading-relaxed',
      'prose-li:my-0.5', 'prose-ul:my-2 prose-ol:my-2',
      'prose-a:text-accent prose-a:no-underline hover:prose-a:underline',
      'prose-strong:text-gray-900 dark:prose-strong:text-white prose-strong:font-semibold',
      'prose-blockquote:border-l-[3px] prose-blockquote:border-accent/40 prose-blockquote:bg-accent/[0.03] prose-blockquote:rounded-r-lg prose-blockquote:py-0.5 prose-blockquote:px-4 prose-blockquote:my-3 prose-blockquote:not-italic prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-300',
      'prose-hr:my-5 prose-hr:border-gray-200 dark:prose-hr:border-gray-700',
      'prose-table:text-sm prose-th:bg-gray-50 dark:prose-th:bg-gray-800 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2',
      'prose-img:rounded-lg prose-img:shadow-sm',
    )}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ pre: PreBlock as any, code: InlineCode as any }}>
        {content}
      </Markdown>
    </div>
  );
}

// ── Chat message types ───────────────────────────────────────

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  format?: 'text' | 'markdown' | 'card' | 'buttons' | 'image' | 'file' | 'audio' | 'video';
  card?: any;
  buttons?: { text: string; data: string }[][];
  imageUrl?: string;
  fileName?: string;
  fileSize?: number;
  streaming?: boolean;
  timestamp?: string;
  // 'progress' = intermediate thinking/tool output, rendered in a dimmed block
  // and never overwritten by the final reply.
  kind?: 'message' | 'progress' | 'media';
  mediaKind?: 'image' | 'file' | 'audio' | 'video';
  mediaUrl?: string;
  mimeType?: string;
  previewHandle?: string;
  attachments?: { name: string; kind: 'image' | 'file' }[];
  progress?: ProgressData;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// ProgressGroup collapses a whole run of thinking/tool steps into one block.
// It is closed by default; opening it reveals every step at once.
function ProgressGroup({ items }: { items: ChatMsg[] }) {
  const { t } = useTranslation();
  const stats = items.find((m) => m.progress?.kind === 'turn_stats')?.progress;
  const steps = items.filter((m) => m.progress?.kind !== 'turn_stats');
  const toolCount = steps.filter((m) => m.progress?.kind === 'tool').length;
  const failed = steps.some((m) => m.progress?.result?.success === false ||
    (m.progress?.result?.exitCode !== undefined && m.progress.result.exitCode !== 0));
  const toolMs = stats?.toolMs ?? steps.reduce((sum, m) =>
    sum + (m.progress?.result?.durationMs ?? m.progress?.durationMs ?? 0), 0);

  if (steps.length === 0 && stats) {
    return (
      <div className="flex gap-3 justify-start">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-1">
          <Bot size={16} className="text-accent" />
        </div>
        <div className="w-full max-w-[85%]">
          <TurnStatsBar data={stats} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-1">
        <Bot size={16} className="text-accent" />
      </div>
      <details className="group w-full max-w-[85%] rounded-xl border border-gray-200/80 dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.02]">
        <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
          <Activity size={14} className="text-gray-400 shrink-0" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {t('chat.execution', 'Execution')}
          </span>
          <span className="text-[11px] text-gray-400">{t('chat.steps', { count: steps.length })}</span>
          {toolCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
              {t('chat.toolCount', { count: toolCount })}
            </span>
          )}
          {failed && <XCircle size={12} className="text-red-500 shrink-0" />}
          {stats ? (
            <span className="flex items-center gap-2 text-[10px] text-gray-400 shrink-0">
              <span className="flex items-center gap-0.5"><Clock size={10} />{formatDuration(stats.durationMs) || '-'}</span>
              <span>{t('chat.modelTime', 'Model')} {formatDuration(stats.modelMs) || '-'}{stats.modelCalls ? ` (${stats.modelCalls})` : ''}</span>
              <span>{t('chat.toolTime', 'Tools')} {formatDuration(toolMs) || '-'}</span>
            </span>
          ) : formatDuration(toolMs) ? (
            <span className="text-[10px] text-gray-400 shrink-0 flex items-center gap-0.5">
              <Clock size={10} />{formatDuration(toolMs)}
            </span>
          ) : null}
          <ChevronRight size={13} className="ml-auto text-gray-400 group-open:rotate-90 transition-transform shrink-0" />
        </summary>
        <div className="border-t border-gray-200/60 dark:border-white/[0.06] p-2 space-y-2">
          {stats && <TurnStatsBar data={stats} />}
          {steps.map((m) => (
            <ProgressItem key={m.id} data={m.progress || { content: m.content }} />
          ))}
        </div>
      </details>
    </div>
  );
}

// findReplyTarget locates the streaming answer message. Progress messages are
// deliberately excluded so a final reply can never overwrite reasoning output.
function findReplyTarget(list: ChatMsg[], handle?: string): number {
  if (handle) {
    const byHandle = list.findIndex((m) => m.previewHandle === handle);
    if (byHandle >= 0) return byHandle;
  }
  return list.findIndex((m) => m.streaming && m.kind !== 'progress');
}

// findToolForResult locates the tool card that a tool_result belongs to, so the
// result can be nested inside it (Codex-style) instead of becoming a separate
// misaligned message.
function findToolForResult(list: ChatMsg[], toolIndex?: number): number {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.kind !== 'progress' || m.progress?.kind !== 'tool') continue;
    if (m.progress.result) continue;
    if (toolIndex && m.progress.toolIndex && toolIndex !== m.progress.toolIndex) continue;
    return i;
  }
  return -1;
}

function mergeProgress(list: ChatMsg[], data: ProgressData, id: string, timestamp?: string): ChatMsg[] {
  if (data.kind === 'tool_result') {
    const idx = findToolForResult(list, data.toolIndex);
    if (idx >= 0) {
      const updated = [...list];
      const target = updated[idx];
      updated[idx] = {
        ...target,
        progress: {
          ...(target.progress || { content: '' }),
          result: {
            content: data.content,
            status: data.status,
            exitCode: data.exitCode,
            success: data.success,
            durationMs: data.durationMs,
          },
        },
      };
      return updated;
    }
  }
  return [...list, {
    id,
    role: 'assistant',
    kind: 'progress',
    content: data.content,
    format: 'markdown',
    timestamp,
    progress: data,
  }];
}

// detailToMessages merges persisted conversation turns with persisted
// thinking/tool progress, ordered by timestamp.
function detailToMessages(detail: SessionDetail): ChatMsg[] {
  let out: ChatMsg[] = [];
  (detail.history || []).forEach((h, i) => {
    out.push({
      id: `hist-${i}`,
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content,
      format: 'markdown',
      timestamp: h.timestamp,
      kind: 'message',
    });
  });
  (detail.progress || []).forEach((p, i) => {
    const data: ProgressData = {
      kind: p.kind,
      content: p.content,
      toolName: p.tool_name,
      toolInput: p.tool_input,
      toolIndex: p.tool_index,
      status: p.status,
      exitCode: p.exit_code,
      success: p.success,
      durationMs: p.duration_ms,
      modelMs: p.model_ms,
      toolMs: p.tool_ms,
      thinkMs: p.think_ms,
      otherMs: p.other_ms,
      modelCalls: p.model_calls,
      inputTokens: p.input_tokens,
      outputTokens: p.output_tokens,
    };
    out = mergeProgress(out, data, `progress-hist-${i}`, p.timestamp);
  });
  out.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  return out;
}

// ── Helpers ──────────────────────────────────────────────────

function parseListItemText(text: string): { cmd: string; desc: string } {
  const m = text.match(/^\*\*(.+?)\*\*\s*(.*)/);
  if (m) return { cmd: m[1], desc: m[2] };
  const sp = text.indexOf(' ');
  if (sp > 0) return { cmd: text.slice(0, sp), desc: text.slice(sp + 1) };
  return { cmd: text, desc: '' };
}

function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="font-semibold text-gray-900 dark:text-white">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

// ── Card renderer (flat, clean style for in-stream cards) ────

function CardBlock({ card, onAction }: { card: any; onAction: (v: string) => void }) {
  if (!card) return null;
  return (
    <div className="space-y-3">
      {card.header?.title && (
        <div className="text-sm font-semibold text-gray-900 dark:text-white">{card.header.title}</div>
      )}
      {card.elements?.map((el: any, i: number) => (
        <CardElement key={i} el={el} onAction={onAction} />
      ))}
    </div>
  );
}

function CardElement({ el, onAction }: { el: any; onAction: (v: string) => void }) {
  if (el.type === 'markdown') return <RenderMarkdown content={el.content} />;
  if (el.type === 'divider') return <div className="border-t border-gray-200/60 dark:border-gray-700/40" />;
  if (el.type === 'note') return <p className="text-[11px] text-gray-400 dark:text-gray-500">{el.text}</p>;
  if (el.type === 'actions') {
    return (
      <div className="flex flex-wrap gap-2">
        {el.buttons?.map((btn: any, j: number) => (
          <button key={j} onClick={() => onAction(btn.value)} className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
            btn.btn_type === 'primary' ? 'bg-accent text-black hover:bg-accent-dim shadow-sm' :
            btn.btn_type === 'danger' ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20' :
            'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700',
          )}>
            {btn.text}
          </button>
        ))}
      </div>
    );
  }
  if (el.type === 'list_item') {
    const parsed = parseListItemText(el.text);
    const isCommand = parsed.cmd.startsWith('/');
    return (
      <button
        onClick={() => onAction(el.btn_value)}
        className="w-full flex items-center gap-3 py-2 text-left group"
      >
        {isCommand ? (
          <>
            <code className="shrink-0 w-20 text-xs font-mono font-medium text-accent">{parsed.cmd}</code>
            <span className="flex-1 text-sm text-gray-500 dark:text-gray-400 truncate">{parsed.desc}</span>
          </>
        ) : (
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate min-w-0">
            <InlineMd text={el.text} />
          </span>
        )}
        <span className={cn(
          'shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all',
          el.btn_type === 'primary'
            ? 'bg-accent/15 text-accent group-hover:bg-accent/25'
            : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 group-hover:bg-accent/15 group-hover:text-accent',
        )}>
          {el.btn_text}
        </span>
      </button>
    );
  }
  if (el.type === 'select') {
    return (
      <select
        defaultValue={el.init_value}
        onChange={(e) => onAction(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {el.options?.map((opt: any, j: number) => (
          <option key={j} value={opt.value}>{opt.text}</option>
        ))}
      </select>
    );
  }
  return null;
}

function ButtonsBlock({ content, buttons, onAction }: { content: string; buttons: { text: string; data: string }[][]; onAction: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <RenderMarkdown content={content} />
      {buttons.map((row, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          {row.map((btn, j) => (
            <button key={j} onClick={() => onAction(btn.data)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-black hover:bg-accent-dim transition-colors">
              {btn.text}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatBytes(size?: number) {
  if (size === undefined || size < 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function FileBlock({ name, size, url }: { name: string; size?: number; url?: string }) {
  const body = (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-w-0">
      <FileText size={16} className="text-gray-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</div>
        {size !== undefined && <div className="text-xs text-gray-400">{formatBytes(size)}</div>}
      </div>
      {url && <Download size={14} className="text-gray-400 shrink-0" />}
    </div>
  );
  if (!url) return body;
  return (
    <a href={url} download={name} className="inline-block max-w-full hover:opacity-80 transition-opacity">
      {body}
    </a>
  );
}

function ImageBlock({ url }: { url: string }) {
  return <img src={url} alt="" className="max-w-sm rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm" />;
}

function AudioBlock({ url }: { url: string }) {
  return <audio controls src={url} className="w-full max-w-sm" />;
}

function VideoBlock({ url }: { url: string }) {
  return <video controls src={url} className="max-w-sm rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm" />;
}

function MediaBlock({ msg }: { msg: ChatMsg }) {
  if (!msg.mediaUrl) return null;
  if (msg.mediaKind === 'image') return <ImageBlock url={msg.mediaUrl} />;
  if (msg.mediaKind === 'audio') return <AudioBlock url={msg.mediaUrl} />;
  if (msg.mediaKind === 'video') return <VideoBlock url={msg.mediaUrl} />;
  return <FileBlock name={msg.fileName || 'file'} size={msg.fileSize} url={msg.mediaUrl} />;
}

function StatusBadge({ status }: { status: BridgeStatus }) {
  const { t } = useTranslation();
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full">
        <Circle size={5} className="fill-current" /> {t('sessions.bridgeConnected')}
      </span>
    );
  }
  if (status === 'connecting' || status === 'registering') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded-full">
        <Loader2 size={9} className="animate-spin" /> {t('sessions.bridgeConnecting')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
      <WifiOff size={9} /> {t('sessions.bridgeDisconnected')}
    </span>
  );
}

function MsgCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute -bottom-3 right-2 p-1 rounded-md bg-gray-100/90 dark:bg-gray-700/90 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover/msg:opacity-100 transition-opacity shadow-sm"
      title="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────

export default function ChatView() {
  const { t } = useTranslation();
  const { name: projectName } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const targetSessionId = searchParams.get('session') || '';

  // Session state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [bridgeAvailability, setBridgeAvailability] = useState<BridgeConfigResult>({ config: null, unavailable: 'disabled' });
  const bridgeCfg = bridgeAvailability.config;
  // Whether the user explicitly picked a session from the drawer
  const [userPickedSession, setUserPickedSession] = useState(false);

  // UI state
  const [cmdOpen, setCmdOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cmdResult, setCmdResult] = useState<CommandResult | null>(null);

  const messagesEnd = useRef<HTMLDivElement>(null);
  const previewHandleCounter = useRef(0);
  const cmdBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Refs let the session poller see current state without re-creating the timer.
  const messagesRef = useRef<ChatMsg[]>([]);
  const typingRef = useRef(false);
  const [pendingAttachments, setPendingAttachments] = useState<OutgoingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const sessionKeyRef = useRef('');
  // Track pending slash command so the next reply can be routed to the panel
  const pendingCmdRef = useRef<string | null>(null);
  // Mirrors cmdResult.command so card-action callbacks can route follow-ups back to the panel
  const cmdPanelRef = useRef<string | null>(null);

  // Web platform uses its own per-browser session key by default, so two
  // viewers do not share one agent session. Only use the original session's
  // key when the user explicitly switches via the drawer.
  const webSessionKey = projectName ? makeWebSessionKey(projectName) : '';
  const sessionKey = userPickedSession && currentSession?.session_key
    ? currentSession.session_key
    : webSessionKey;
  sessionKeyRef.current = sessionKey;

  // Load project sessions and auto-select latest
  const fetchData = useCallback(async () => {
    if (!projectName) return;
    setLoading(true);
    try {
      const [{ sessions: allSessions }, cfg] = await Promise.all([
        listSessions(projectName),
        fetchBridgeConfig(),
      ]);
      setBridgeAvailability(cfg);
      const sorted = (allSessions || []).sort(
        (a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''),
      );
      setSessions(sorted);

      if (sorted.length > 0) {
        const target = targetSessionId ? sorted.find((s) => s.id === targetSessionId) : undefined;
        const chosen = target || sorted[0];
        setUserPickedSession(!!target);
        const detail = await getSession(projectName, chosen.id, 200);
        setCurrentSession(detail);
        setMessages(detailToMessages(detail));
      } else {
        setCurrentSession(null);
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  }, [projectName, targetSessionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keep ref in sync with cmdResult so callbacks avoid stale closures
  useEffect(() => {
    cmdPanelRef.current = cmdResult?.command ?? null;
  }, [cmdResult]);

  // Switch to a different session (user explicitly chose from drawer)
  const switchToSession = useCallback(async (s: Session) => {
    if (!projectName) return;
    setDrawerOpen(false);
    setLoading(true);
    setUserPickedSession(true);
    try {
      const detail = await getSession(projectName, s.id, 200);
      setCurrentSession(detail);
      setMessages(detailToMessages(detail));
    } finally {
      setLoading(false);
    }
  }, [projectName]);

  // Handle bridge incoming messages — only process messages for the current session
  const handleBridgeMessage = useCallback((msg: BridgeIncoming) => {
    const msgKey = (msg as any).session_key;
    if (msgKey && sessionKeyRef.current && msgKey !== sessionKeyRef.current) {
      return;
    }

    // If a slash command is pending, route the first reply/card to the panel
    const pending = pendingCmdRef.current;
    if (pending && (msg.type === 'reply' || msg.type === 'card' || msg.type === 'buttons')) {
      pendingCmdRef.current = null;
      if (msg.type === 'card') {
        const card = msg as Extract<BridgeIncoming, { type: 'card' }>;
        setCmdResult({ command: pending, content: '', format: 'card', card: card.card });
      } else if (msg.type === 'buttons') {
        const btns = msg as Extract<BridgeIncoming, { type: 'buttons' }>;
        setCmdResult({ command: pending, content: btns.content, format: 'buttons', buttons: btns.buttons });
      } else {
        const reply = msg as Extract<BridgeIncoming, { type: 'reply' }>;
        setCmdResult({ command: pending, content: reply.content, format: 'markdown' });
      }
      setTyping(false);
      return;
    }

    if (msg.type === 'reply') {
      const reply = msg as Extract<BridgeIncoming, { type: 'reply' }>;
      setMessages(prev => {
        const streamIdx = findReplyTarget(prev);
        const format = reply.format === 'markdown' ? 'markdown' : 'text';
        if (streamIdx >= 0) {
          const updated = [...prev];
          updated[streamIdx] = { ...updated[streamIdx], content: reply.content, format, streaming: false };
          return updated;
        }
        return [...prev, { id: `reply-${Date.now()}`, role: 'assistant', kind: 'message', content: reply.content, format }];
      });
      setTyping(false);
      notify(projectName || 'cc-connect', reply.content.slice(0, 160));
    } else if (msg.type === 'reply_stream') {
      const stream = msg as Extract<BridgeIncoming, { type: 'reply_stream' }>;
      if (stream.done) {
        setMessages(prev => {
          const idx = findReplyTarget(prev, stream.preview_handle);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], content: stream.full_text, streaming: false };
            return updated;
          }
          return [...prev, { id: `stream-done-${Date.now()}`, role: 'assistant', kind: 'message', content: stream.full_text, format: 'markdown' }];
        });
        setTyping(false);
      } else {
        setMessages(prev => {
          const idx = findReplyTarget(prev, stream.preview_handle);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], content: stream.full_text };
            return updated;
          }
          return [...prev, { id: `stream-${Date.now()}`, role: 'assistant', kind: 'message', content: stream.full_text, format: 'markdown', streaming: true }];
        });
      }
    } else if (msg.type === 'progress') {
      const progress = msg as Extract<BridgeIncoming, { type: 'progress' }>;
      if (progress.content) {
        const data: ProgressData = {
          kind: progress.kind,
          content: progress.content,
          toolName: progress.tool_name,
          toolInput: progress.tool_input,
          toolIndex: progress.tool_index,
          status: progress.status,
          exitCode: progress.exit_code,
          success: progress.success,
          durationMs: progress.duration_ms,
          modelMs: progress.model_ms,
          toolMs: progress.tool_ms,
          thinkMs: progress.think_ms,
          otherMs: progress.other_ms,
          modelCalls: progress.model_calls,
          inputTokens: progress.input_tokens,
          outputTokens: progress.output_tokens,
        };
        setMessages(prev => mergeProgress(prev, data, `progress-${Date.now()}-${prev.length}`));
      }
      setTyping(false);
    } else if (msg.type === 'image' || msg.type === 'file' || msg.type === 'audio' || msg.type === 'video') {
      const media = msg as any;
      if (!media.data) {
        setTyping(false);
        return;
      }
      const mime = media.mime_type || (
        msg.type === 'image' ? 'image/png' :
        msg.type === 'video' ? 'video/mp4' :
        msg.type === 'audio' ? 'audio/mpeg' : 'application/octet-stream'
      );
      const fileName = media.file_name || (
        msg.type === 'image' ? 'image' :
        msg.type === 'video' ? 'video' :
        msg.type === 'audio' ? 'audio' : 'file'
      );
      setMessages(prev => [...prev, {
        id: `${msg.type}-${Date.now()}-${prev.length}`,
        role: 'assistant',
        kind: 'media',
        mediaKind: msg.type as 'image' | 'file' | 'audio' | 'video',
        mediaUrl: `data:${mime};base64,${media.data}`,
        mimeType: mime,
        fileName,
        format: msg.type as ChatMsg['format'],
        content: '',
      }]);
      setTyping(false);
    } else if (msg.type === 'card') {
      const card = msg as Extract<BridgeIncoming, { type: 'card' }>;
      setMessages(prev => [...prev, { id: `card-${Date.now()}`, role: 'assistant', content: '', format: 'card', card: card.card }]);
      setTyping(false);
      notify(projectName || 'cc-connect', card.card?.header?.title || t('chat.agentFinished', 'Agent finished'));
    } else if (msg.type === 'buttons') {
      const btns = msg as Extract<BridgeIncoming, { type: 'buttons' }>;
      setMessages(prev => [...prev, { id: `btn-${Date.now()}`, role: 'assistant', content: btns.content, format: 'buttons', buttons: btns.buttons }]);
      setTyping(false);
    } else if (msg.type === 'typing_start') {
      setTyping(true);
    } else if (msg.type === 'typing_stop') {
      setTyping(false);
    } else if (msg.type === 'preview_start') {
      const ps = msg as Extract<BridgeIncoming, { type: 'preview_start' }>;
      const handle = `web-preview-${++previewHandleCounter.current}`;
      sendPreviewAck(ps.ref_id, handle);
      setMessages(prev => [...prev, { id: `stream-${handle}`, role: 'assistant', kind: 'message', content: ps.content, format: 'markdown', streaming: true, previewHandle: handle }]);
    } else if (msg.type === 'update_message') {
      const um = msg as Extract<BridgeIncoming, { type: 'update_message' }>;
      setMessages(prev => {
        const idx = findReplyTarget(prev, um.preview_handle);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], content: um.content };
          return updated;
        }
        return prev;
      });
    } else if (msg.type === 'delete_message') {
      const dm = msg as Extract<BridgeIncoming, { type: 'delete_message' }>;
      setMessages(prev => {
        const idx = findReplyTarget(prev, dm.preview_handle);
        if (idx >= 0) return prev.filter((_, i) => i !== idx);
        return prev;
      });
    }
  }, [projectName, t]);

  // Keep refs in sync for the poller below.
  messagesRef.current = messages;
  typingRef.current = typing;

  // Poll the open session so turns started from another platform (e.g. WeCom)
  // still surface their progress and final timing summary in the web UI.
  useEffect(() => {
    if (!projectName || !currentSession?.id) return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      if (typingRef.current || messagesRef.current.some((m) => m.streaming)) return;
      try {
        const detail = await getSession(projectName, currentSession.id, 200);
        const built = detailToMessages(detail);
        setMessages((prev) => {
          const prevLast = prev[prev.length - 1];
          const nextLast = built[built.length - 1];
          if (prev.length === built.length && prevLast?.content === nextLast?.content) return prev;
          return built;
        });
        setCurrentSession(detail);
      } catch {
        // ignore transient polling errors
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [projectName, currentSession?.id]);

  const { status: bridgeStatus, sendMessage: bridgeSend, sendCardAction, sendPreviewAck } = useBridgeSocket({
    bridgeCfg,
    platformName: webPlatformName(),
    sessionKey,
    projectName: projectName || '',
    userId: webUserId(),
    userName: webUserName(),
    onMessage: handleBridgeMessage,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // Send message
  const handleSend = useCallback(() => {
    const content = input.trim();
    const attachments = pendingAttachments;
    if ((!content && attachments.length === 0) || bridgeStatus !== 'connected') return;
    setInput('');
    setPendingAttachments([]);
    setSending(true);

    const cmdToken = content.split(' ')[0];
    const isKnownCmd = content.startsWith('/') && knownCommands.has(cmdToken);
    if (isKnownCmd && !chatCommands.has(cmdToken)) {
      pendingCmdRef.current = cmdToken;
    } else {
      setMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content || attachments.map((a) => a.fileName).join(', '),
        attachments: attachments.map((a) => ({ name: a.fileName, kind: a.kind })),
      }]);
    }
    bridgeSend(content, attachments);
    setTimeout(() => setSending(false), 300);
  }, [input, pendingAttachments, bridgeStatus, bridgeSend]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentError('');
    const selected = Array.from(files);
    const tooLarge = selected.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooLarge) {
      setAttachmentError(t('chat.attachmentTooLarge', { name: tooLarge.name }));
      return;
    }
    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        if (comma < 0) return;
        const data = result.slice(comma + 1);
        const mimeType = file.type || 'application/octet-stream';
        const kind: 'image' | 'file' = mimeType.startsWith('image/') ? 'image' : 'file';
        setPendingAttachments(prev => [...prev, { kind, mimeType, fileName: file.name, data }]);
      };
      reader.onerror = () => setAttachmentError(t('chat.attachmentReadFailed', { name: file.name }));
      reader.readAsDataURL(file);
    });
  }, [t]);

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === '/' && !input) {
      e.preventDefault();
      setCmdOpen(true);
    }
  };

  // Commands whose result should go to the message stream (they change state)
  const chatCommands = new Set(['/new', '/stop', '/switch', '/delete-mode', '/upgrade']);
  const knownCommands = new Set(slashCommands.map(c => c.cmd));

  const handleCmdSelect = useCallback((cmd: SlashCommand) => {
    setCmdOpen(false);
    if (bridgeStatus !== 'connected') return;

    if (chatCommands.has(cmd.cmd)) {
      setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: cmd.cmd }]);
    } else {
      pendingCmdRef.current = cmd.cmd;
    }
    bridgeSend(cmd.cmd);
  }, [bridgeStatus, bridgeSend]);

  const handleCardAction = useCallback((value: string) => {
    if (bridgeStatus !== 'connected') return;
    // If the command panel is showing, route the follow-up response back to it
    if (cmdPanelRef.current) {
      pendingCmdRef.current = cmdPanelRef.current;
    }
    sendCardAction(value);
  }, [bridgeStatus, sendCardAction]);

  const handleNewSession = useCallback(() => {
    if (bridgeStatus !== 'connected') return;
    setUserPickedSession(false);
    setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: '/new' }]);
    bridgeSend('/new');
    setDrawerOpen(false);
  }, [bridgeStatus, bridgeSend]);

  const handleRenameSession = useCallback(async (session: Session) => {
    if (!projectName) return;
    const next = window.prompt(t('common.rename'), session.name || '');
    if (next === null) return;
    const name = next.trim();
    if (!name) return;
    try {
      await renameSession(projectName, session.id, name);
      await fetchData();
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }, [projectName, t, fetchData]);

  const handleDeleteSession = useCallback(async (session: Session) => {
    if (!projectName) return;
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await deleteSession(projectName, session.id);
      setDrawerOpen(false);
      await fetchData();
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }, [projectName, t, fetchData]);

  const canSend = bridgeStatus === 'connected';

  if (loading && !currentSession && sessions.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/chat" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={18} className="text-gray-400" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{projectName}</h2>
              <StatusBadge status={bridgeStatus} />
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-accent transition-colors mt-0.5"
            >
              <span>{userPickedSession && currentSession
                ? (currentSession.name || currentSession.id.slice(0, 8))
                : t('chat.defaultSession')}</span>
              <ChevronDown size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <Bot size={32} className="text-accent" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('chat.emptyHint')}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t('chat.slashHint')}</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          if (msg.kind === 'progress') {
            if (idx > 0 && messages[idx - 1].kind === 'progress') return null;
            const items: ChatMsg[] = [];
            for (let i = idx; i < messages.length && messages[i].kind === 'progress'; i++) {
              items.push(messages[i]);
            }
            return <ProgressGroup key={`pg-${msg.id}`} items={items} />;
          }
          const isUser = msg.role === 'user';
          const isEmpty = !msg.content && !msg.card && !msg.buttons && !msg.imageUrl && !msg.fileName && !msg.mediaUrl && !(msg.attachments?.length);
          return (
            <div key={msg.id} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={16} className="text-accent" />
                </div>
              )}
              <div className={cn(
                'group/msg relative rounded-2xl text-sm',
                'px-5 py-3.5',
                isUser
                  ? 'max-w-[70%] bg-accent text-black rounded-br-md'
                  : 'max-w-[85%] bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-sm',
                msg.streaming && 'animate-pulse-subtle',
              )}>
                {isEmpty ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">{t('chat.unsupportedMessage', '[Unsupported message]')}</p>
                ) : msg.kind === 'media' ? (
                  <MediaBlock msg={msg} />
                ) : msg.format === 'card' ? (
                  <CardBlock card={msg.card} onAction={handleCardAction} />
                ) : msg.format === 'buttons' && msg.buttons ? (
                  <ButtonsBlock content={msg.content} buttons={msg.buttons} onAction={handleCardAction} />
                ) : msg.format === 'image' && msg.imageUrl ? (
                  <ImageBlock url={msg.imageUrl} />
                ) : msg.format === 'file' && msg.fileName ? (
                  <FileBlock name={msg.fileName} size={msg.fileSize} url={msg.mediaUrl} />
                ) : isUser ? (
                  <div className="space-y-2">
                    {msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}
                    {msg.attachments?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.attachments.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-black/10 px-2 py-0.5 text-[11px]">
                            {a.kind === 'image' ? <ImageIcon size={11} /> : <FileText size={11} />}
                            {a.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <RenderMarkdown content={msg.content} />
                )}
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-4 bg-accent/60 rounded-sm ml-0.5 animate-pulse" />
                )}
                {!isUser && !msg.streaming && msg.content && (
                  <MsgCopyButton text={msg.content} />
                )}
              </div>
              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                  <User size={16} className="text-gray-500" />
                </div>
              )}
            </div>
          );
        })}
        {typing && !messages.some(m => m.streaming) && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-1">
              <Bot size={16} className="text-accent" />
            </div>
            <div className="rounded-2xl px-5 py-3.5 text-sm bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 rounded-bl-md shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-800 pt-3 shrink-0">
        {canSend ? (
          <div className="space-y-2">
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {pendingAttachments.map((a, i) => (
                  <span key={`${a.fileName}-${i}`} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300">
                    {a.kind === 'image' ? <ImageIcon size={12} /> : <FileText size={12} />}
                    <span className="max-w-[180px] truncate">{a.fileName}</span>
                    <button type="button" onClick={() => removeAttachment(i)} className="text-gray-400 hover:text-red-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {attachmentError && <div className="px-1 text-xs text-red-500">{attachmentError}</div>}
            <div className="relative flex items-end gap-2">
            {/* Command palette trigger */}
            <div className="relative">
              <button
                ref={cmdBtnRef}
                type="button"
                onClick={() => setCmdOpen(!cmdOpen)}
                className={cn(
                  'p-3 rounded-xl transition-all duration-200',
                  cmdOpen
                    ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06]',
                )}
                title={t('chat.commands')}
              >
                <Slash size={18} />
              </button>
              <CommandPalette
                open={cmdOpen}
                onClose={() => setCmdOpen(false)}
                onSelect={handleCmdSelect}
                anchorRef={cmdBtnRef}
              />
            </div>

            {/* Attachment picker */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
              title={t('chat.attach')}
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFileSelect(e.target.files);
                e.target.value = '';
              }}
            />

            {/* Text input */}
            <div className="flex-1 relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.inputPlaceholder')}
                className="w-full px-4 py-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors placeholder:text-gray-400"
                disabled={sending}
              />
            </div>

            {/* Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || (!input.trim() && pendingAttachments.length === 0)}
              className="p-3 rounded-xl bg-accent text-black hover:bg-accent-dim transition-colors disabled:opacity-50 flex items-center"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
            </div>
          </div>
        ) : !bridgeCfg ? (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <WifiOff size={14} />
            <span>{bridgeAvailability.unavailable === 'management-error'
              ? t('sessions.managementUnavailable')
              : bridgeAvailability.unavailable === 'start-failed'
                ? t('sessions.bridgeStartFailed', { detail: bridgeAvailability.detail ? `: ${bridgeAvailability.detail}` : '' })
                : t('sessions.bridgeNotAvailable')}</span>
          </div>
        ) : bridgeStatus === 'disconnected' || bridgeStatus === 'error' ? (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <WifiOff size={14} />
            <span>{t('sessions.bridgeDisconnected')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <Loader2 size={14} className="animate-spin" />
            <span>{t('sessions.bridgeConnecting')}</span>
          </div>
        )}
      </div>

      {/* Session drawer */}
      <SessionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessions={sessions}
        currentSessionId={currentSession?.id || ''}
        onSelect={switchToSession}
        onNewSession={handleNewSession}
        onRename={handleRenameSession}
        onDelete={handleDeleteSession}
      />

      {/* Command result panel */}
      <CommandResultPanel
        result={cmdResult}
        onClose={() => setCmdResult(null)}
        onCardAction={handleCardAction}
      />
    </div>
  );
}
