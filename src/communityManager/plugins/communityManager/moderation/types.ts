export type ModerationCategory = "spam" | "toxic" | "fud" | "fomo";
export type ModerationActionType = "allow" | "warn" | "mute" | "skip";

export type ModerationSeverity = "low" | "medium" | "high";

export type ModerationCategorySettings = {
  enabled: boolean;
  minConfidence: number;
  minSeverity: ModerationSeverity;
};

export type ModerationLadderStep = {
  offense: number;
  action: "warn" | "mute";
  durationSeconds?: number;
  permanent?: boolean;
};

export type ModerationPlatform = "telegram" | "discord";

export type TelegramModerationPlatformSettings = {
  enabled: boolean;
  allowedChatIds: string[];
  adminUserIds: string[];
  exemptUserIds: string[];
  greeting: {
    enabled: boolean;
    template: string;
  };
};

export type DiscordModerationPlatformSettings = {
  enabled: boolean;
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  adminUserIds: string[];
  exemptUserIds: string[];
  greeting: {
    enabled: boolean;
    template: string;
  };
};

export type CommunityModerationSettings = {
  version: 1;
  dryRun: boolean;
  platforms: {
    telegram: TelegramModerationPlatformSettings;
    discord: DiscordModerationPlatformSettings;
  };
  moderation: {
    enabled: boolean;
    resetAfterDays: number;
    warningTemplate: string;
    categories: Record<ModerationCategory, ModerationCategorySettings>;
    spamRules: {
      maxMessagesPerMinute: number;
      maxRepeatedMessages: number;
      maxLinksPerMessage: number;
      maxMentionsPerMessage: number;
    };
    ladder: ModerationLadderStep[];
  };
};

export type PartialCommunityModerationSettings = {
  dryRun?: boolean;
  platforms?: {
    telegram?: Partial<TelegramModerationPlatformSettings> & {
      greeting?: Partial<TelegramModerationPlatformSettings["greeting"]>;
    };
    discord?: Partial<DiscordModerationPlatformSettings> & {
      greeting?: Partial<DiscordModerationPlatformSettings["greeting"]>;
    };
  };
  moderation?: Partial<
    Omit<
      CommunityModerationSettings["moderation"],
      "categories" | "spamRules" | "ladder"
    >
  > & {
    categories?: Partial<
      Record<ModerationCategory, Partial<ModerationCategorySettings>>
    >;
    spamRules?: Partial<CommunityModerationSettings["moderation"]["spamRules"]>;
    ladder?: ModerationLadderStep[];
  };
};

export type ModerationMessage = {
  platform: ModerationPlatform;
  communityId: string;
  channelId: string;
  channelType?: "private" | "group" | "supergroup" | "channel";
  threadId?: string;
  roomId: string;
  worldId: string;
  messageId: string;
  userId: string;
  username?: string;
  displayName: string;
  text: string;
  createdAt: number;
  raw?: unknown;
};

export type ModerationClassification = {
  category: ModerationCategory | "safe";
  severity: ModerationSeverity;
  confidence: number;
  reason: string;
  signals: string[];
};

export type ViolationState = {
  platform: ModerationPlatform;
  communityId: string;
  channelId: string;
  threadId?: string;
  userId: string;
  category: ModerationCategory;
  count: number;
  lastViolationAt: number;
};

export type ModerationDecision = {
  action: ModerationActionType;
  category: ModerationCategory | "safe";
  severity: ModerationSeverity;
  confidence: number;
  reason: string;
  offenseCount: number;
  durationSeconds?: number;
  permanent?: boolean;
  dryRun: boolean;
};

export type ModerationAuditRecord = {
  id: string;
  platform: ModerationPlatform;
  communityId: string;
  channelId: string;
  threadId?: string;
  userId: string;
  messageId: string;
  category: ModerationCategory | "safe";
  severity: ModerationSeverity;
  confidence: number;
  action: ModerationActionType;
  durationSeconds?: number;
  permanent?: boolean;
  dryRun: boolean;
  reason: string;
  createdAt: number;
};
