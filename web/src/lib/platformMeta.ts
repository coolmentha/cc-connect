export interface FieldDef {
  key: string;
  labelKey: string;
  required?: boolean;
  type?: 'text' | 'password' | 'number' | 'boolean' | 'select';
  placeholder?: string;
  hintKey?: string;
  group?: 'basic' | 'advanced';
  options?: string[];
  showWhen?: Record<string, string[]>;
}

export interface PlatformMeta {
  label: string;
  fields: FieldDef[];
}

export const platformMeta: Record<string, PlatformMeta> = {
  telegram: {
    label: 'Telegram',
    fields: [
      { key: 'token', labelKey: 'fields.botToken', required: true, type: 'password', placeholder: '123456:ABC-DEF...' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced', hintKey: 'fields.allowFromHintTelegram' },
      { key: 'group_reply_all', labelKey: 'fields.groupReplyAll', type: 'boolean', group: 'advanced' },
      { key: 'share_session_in_channel', labelKey: 'fields.sharedGroupSession', type: 'boolean', group: 'advanced' },
    ],
  },
  discord: {
    label: 'Discord',
    fields: [
      { key: 'token', labelKey: 'fields.botToken', required: true, type: 'password' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
      { key: 'guild_id', labelKey: 'fields.guildId', placeholder: '', group: 'advanced', hintKey: 'fields.guildIdHint' },
      { key: 'group_reply_all', labelKey: 'fields.groupReplyAll', type: 'boolean', group: 'advanced' },
      { key: 'share_session_in_channel', labelKey: 'fields.sharedChannelSession', type: 'boolean', group: 'advanced' },
      { key: 'thread_isolation', labelKey: 'fields.threadIsolation', type: 'boolean', group: 'advanced' },
    ],
  },
  slack: {
    label: 'Slack',
    fields: [
      { key: 'bot_token', labelKey: 'fields.botToken', required: true, type: 'password', placeholder: 'xoxb-...' },
      { key: 'app_token', labelKey: 'fields.appToken', required: true, type: 'password', placeholder: 'xapp-...' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
      { key: 'share_session_in_channel', labelKey: 'fields.sharedChannelSession', type: 'boolean', group: 'advanced' },
    ],
  },
  dingtalk: {
    label: 'DingTalk',
    fields: [
      { key: 'client_id', labelKey: 'fields.clientId', required: true },
      { key: 'client_secret', labelKey: 'fields.clientSecret', required: true, type: 'password' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
      { key: 'share_session_in_channel', labelKey: 'fields.sharedGroupSession', type: 'boolean', group: 'advanced' },
    ],
  },
  wecom: {
    label: 'WeChat Work',
    fields: [
      { key: 'corp_id', labelKey: 'fields.corpId', required: true },
      { key: 'corp_secret', labelKey: 'fields.corpSecret', required: true, type: 'password' },
      { key: 'agent_id', labelKey: 'fields.agentId', required: true, placeholder: '1000002' },
      { key: 'callback_token', labelKey: 'fields.callbackToken', required: true },
      { key: 'callback_aes_key', labelKey: 'fields.callbackAesKey', required: true, hintKey: 'fields.callbackAesKeyHint' },
      { key: 'port', labelKey: 'fields.port', required: true, placeholder: '8081' },
      { key: 'callback_path', labelKey: 'fields.callbackPath', placeholder: '/wecom/callback', group: 'advanced' },
      { key: 'api_base_url', labelKey: 'fields.apiBaseUrl', placeholder: 'https://qyapi.weixin.qq.com', group: 'advanced' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
    ],
  },
  qq: {
    label: 'QQ (OneBot v11)',
    fields: [
      { key: 'ws_url', labelKey: 'fields.wsUrl', required: true, placeholder: 'ws://127.0.0.1:3001' },
      { key: 'token', labelKey: 'fields.accessToken', type: 'password', group: 'advanced' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
      { key: 'share_session_in_channel', labelKey: 'fields.sharedGroupSession', type: 'boolean', group: 'advanced' },
    ],
  },
  qqbot: {
    label: 'QQ Bot (Official)',
    fields: [
      { key: 'app_id', labelKey: 'fields.appId', required: true },
      { key: 'app_secret', labelKey: 'fields.appSecret', required: true, type: 'password' },
      { key: 'sandbox', labelKey: 'fields.sandboxMode', type: 'boolean', group: 'advanced' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
      { key: 'share_session_in_channel', labelKey: 'fields.sharedGroupSession', type: 'boolean', group: 'advanced' },
    ],
  },
  yuanbao: {
    label: 'Yuanbao (腾讯元宝)',
    fields: [
      { key: 'bot_token', labelKey: 'fields.botToken', required: true, type: 'password', placeholder: 'app_key:app_secret' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
    ],
  },
  line: {
    label: 'LINE',
    fields: [
      { key: 'channel_secret', labelKey: 'fields.channelSecret', required: true, type: 'password' },
      { key: 'channel_token', labelKey: 'fields.channelToken', required: true, type: 'password' },
      { key: 'port', labelKey: 'fields.port', required: true, placeholder: '8080' },
      { key: 'callback_path', labelKey: 'fields.callbackPath', placeholder: '/callback', group: 'advanced' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
    ],
  },
  weibo: {
    label: 'Weibo (微博)',
    fields: [
      { key: 'app_id', labelKey: 'fields.appId', required: true, placeholder: '1234567890' },
      { key: 'app_secret', labelKey: 'fields.appSecret', required: true, type: 'password' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
    ],
  },
  tuitui: {
    label: 'TuiTui (推推)',
    fields: [
      { key: 'app_id', labelKey: 'fields.appId', required: true },
      { key: 'app_secret', labelKey: 'fields.appSecret', required: true, type: 'password' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
      { key: 'group_allow_from', labelKey: 'fields.groupAllowFrom', group: 'advanced' },
      { key: 'group_policy', labelKey: 'fields.groupPolicy', type: 'select', options: ['allowlist', 'open', 'disabled'], group: 'advanced' },
      { key: 'require_mention', labelKey: 'fields.requireMention', type: 'boolean', group: 'advanced' },
      { key: 'history_limit', labelKey: 'fields.historyLimit', type: 'number', placeholder: '50', group: 'advanced' },
      { key: 'share_session_in_channel', labelKey: 'fields.sharedGroupSession', type: 'boolean', group: 'advanced' },
      { key: 'api_base', labelKey: 'fields.apiBaseUrl', placeholder: 'https://im.live.360.cn:8282', group: 'advanced' },
      { key: 'ws_base', labelKey: 'fields.wsUrl', placeholder: 'wss://im.live.360.cn:8282', group: 'advanced' },
    ],
  },
  cloud_web: {
    label: 'Cloud Web (Self-hosted IM)',
    fields: [
      {
        key: 'transport',
        labelKey: 'fields.transport',
        required: true,
        type: 'select',
        options: ['websocket', 'long_poll', 'gateway'],
      },
      { key: 'token', labelKey: 'fields.accessToken', required: true, type: 'password' },
      {
        key: 'base_url',
        labelKey: 'fields.apiBaseUrl',
        placeholder: 'https://gateway.example.com',
        showWhen: { transport: ['websocket', 'long_poll', 'gateway'] },
        hintKey: 'fields.cloudWebBaseUrlHint',
      },
      {
        key: 'ws_url',
        labelKey: 'fields.wsUrl',
        placeholder: 'wss://gateway.example.com/cloud-web/ws',
        group: 'advanced',
        showWhen: { transport: ['websocket'] },
        hintKey: 'fields.cloudWebWsHint',
      },
      {
        key: 'long_poll_timeout_ms',
        labelKey: 'fields.longPollTimeout',
        type: 'number',
        placeholder: '30000',
        group: 'advanced',
        showWhen: { transport: ['long_poll'] },
      },
      {
        key: 'events_path',
        labelKey: 'fields.eventsPath',
        placeholder: '/cloud-web/v1/events',
        group: 'advanced',
        showWhen: { transport: ['long_poll'] },
      },
      {
        key: 'send_path',
        labelKey: 'fields.sendPath',
        placeholder: '/cloud-web/v1/send',
        group: 'advanced',
        showWhen: { transport: ['long_poll', 'gateway'] },
      },
      {
        key: 'listen',
        labelKey: 'fields.listen',
        placeholder: ':8099',
        showWhen: { transport: ['gateway'] },
      },
      {
        key: 'webhook_path',
        labelKey: 'fields.callbackPath',
        placeholder: '/cloud-web/webhook',
        group: 'advanced',
        showWhen: { transport: ['gateway'] },
      },
      {
        key: 'public_url',
        labelKey: 'fields.publicUrl',
        group: 'advanced',
        showWhen: { transport: ['gateway'] },
        hintKey: 'fields.publicUrlHint',
      },
      {
        key: 'register_url',
        labelKey: 'fields.registerUrl',
        group: 'advanced',
        showWhen: { transport: ['gateway'] },
        hintKey: 'fields.registerUrlHint',
      },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
      { key: 'share_session_in_channel', labelKey: 'fields.sharedGroupSession', type: 'boolean', group: 'advanced' },
      { key: 'group_reply_all', labelKey: 'fields.groupReplyAll', type: 'boolean', group: 'advanced' },
    ],
  },
  googlechat: {
    label: 'Google Chat',
    fields: [
      { key: 'subscription', labelKey: 'fields.subscription', required: true, placeholder: 'projects/my-project/subscriptions/my-sub' },
      { key: 'credentials_file', labelKey: 'fields.credentialsFile', placeholder: '/path/to/service-account.json', hintKey: 'fields.credentialsFileHint' },
      { key: 'session_scope', labelKey: 'fields.sessionScope', type: 'select', options: ['space', 'thread', 'user'], group: 'advanced' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
    ],
  },
  matrix: {
    label: 'Matrix',
    fields: [
      { key: 'homeserver', labelKey: 'fields.homeserver', required: true, placeholder: 'https://matrix.org' },
      { key: 'access_token', labelKey: 'fields.accessToken', required: true, type: 'password' },
      { key: 'user_id', labelKey: 'fields.userId', placeholder: '@bot:matrix.org' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
      { key: 'auto_join', labelKey: 'fields.autoJoin', type: 'boolean', group: 'advanced' },
      { key: 'auto_verify', labelKey: 'fields.autoVerify', type: 'boolean', group: 'advanced' },
      { key: 'cross_signing_password', labelKey: 'fields.crossSigningPassword', type: 'password', group: 'advanced' },
      { key: 'proxy', labelKey: 'fields.proxy', group: 'advanced' },
      { key: 'share_session_in_channel', labelKey: 'fields.sharedGroupSession', type: 'boolean', group: 'advanced' },
      { key: 'group_reply_all', labelKey: 'fields.groupReplyAll', type: 'boolean', group: 'advanced' },
    ],
  },
  max: {
    label: 'MAX',
    fields: [
      { key: 'token', labelKey: 'fields.botToken', required: true, type: 'password' },
      { key: 'webhook_url', labelKey: 'fields.publicUrl', placeholder: 'https://example.com/max/webhook' },
      { key: 'webhook_listen', labelKey: 'fields.listen', placeholder: ':8090', group: 'advanced' },
      { key: 'webhook_path', labelKey: 'fields.webhookPath', placeholder: '/max/webhook', group: 'advanced' },
      { key: 'webhook_secret', labelKey: 'fields.webhookSecret', type: 'password', group: 'advanced' },
      { key: 'api_base', labelKey: 'fields.apiBaseUrl', group: 'advanced' },
      { key: 'max_attachment_size_mb', labelKey: 'fields.maxAttachmentMb', type: 'number', group: 'advanced' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
    ],
  },
  webex: {
    label: 'Webex',
    fields: [
      { key: 'token', labelKey: 'fields.botToken', required: true, type: 'password' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
    ],
  },
  'wps-agentspace': {
    label: 'WPS Agent Space',
    fields: [
      { key: 'app_id', labelKey: 'fields.appId', required: true },
      { key: 'wps_sid', labelKey: 'fields.wpsSid', required: true, type: 'password' },
      { key: 'base_url', labelKey: 'fields.apiBaseUrl', group: 'advanced' },
      { key: 'device_name', labelKey: 'fields.deviceName', group: 'advanced' },
      { key: 'device_uuid', labelKey: 'fields.deviceUuid', group: 'advanced' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
    ],
  },
  'wps-xiezuo': {
    label: 'WPS 协作',
    fields: [
      { key: 'app_id', labelKey: 'fields.appId', required: true },
      { key: 'app_secret', labelKey: 'fields.appSecret', required: true, type: 'password' },
      { key: 'base_url', labelKey: 'fields.apiBaseUrl', group: 'advanced' },
      { key: 'clean_reply', labelKey: 'fields.cleanReply', type: 'boolean', group: 'advanced' },
      { key: 'max_attachment_bytes', labelKey: 'fields.maxAttachmentBytes', type: 'number', group: 'advanced' },
      { key: 'allow_from', labelKey: 'fields.allowFrom', placeholder: '* (all)', group: 'advanced' },
    ],
  },
};
