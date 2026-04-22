import type {
	CommunityModerationSettings,
	PartialCommunityModerationSettings,
} from "./types";

export const DEFAULT_COMMUNITY_MODERATION_SETTINGS: CommunityModerationSettings = {
	version: 1,
	dryRun: true,
	platforms: {
		telegram: {
			enabled: true,
			allowedChatIds: [],
			adminUserIds: [],
			exemptUserIds: [],
			greeting: {
				enabled: true,
				template:
					"Welcome {displayName}! I'm Eli5, the community manager. Feel free to introduce yourself.",
			},
		},
		discord: {
			enabled: false,
			allowedGuildIds: [],
			allowedChannelIds: [],
			adminUserIds: [],
			exemptUserIds: [],
			greeting: {
				enabled: true,
				template:
					"Welcome {displayName}! I'm Eli5, the community manager. Feel free to introduce yourself.",
			},
		},
	},
	moderation: {
		enabled: true,
		resetAfterDays: 30,
		warningTemplate:
			"{displayName}, please keep the chat useful and respectful. This is warning {offenseCount}.",
		categories: {
			spam: { enabled: true, minConfidence: 0.7, minSeverity: "low" },
			toxic: { enabled: true, minConfidence: 0.75, minSeverity: "medium" },
			fud: { enabled: true, minConfidence: 0.75, minSeverity: "medium" },
			fomo: { enabled: true, minConfidence: 0.75, minSeverity: "medium" },
		},
		spamRules: {
			maxMessagesPerMinute: 8,
			maxRepeatedMessages: 3,
			maxLinksPerMessage: 2,
			maxMentionsPerMessage: 6,
		},
		ladder: [
			{ offense: 1, action: "warn" },
			{ offense: 2, action: "mute", durationSeconds: 3600 },
			{ offense: 3, action: "mute", durationSeconds: 14400 },
			{ offense: 4, action: "mute", permanent: true },
		],
	},
};

export function mergeCommunityModerationSettings(
	partial?: PartialCommunityModerationSettings,
): CommunityModerationSettings {
	const defaults = DEFAULT_COMMUNITY_MODERATION_SETTINGS;
	return {
		...defaults,
		...partial,
		version: 1,
		platforms: {
			telegram: {
				...defaults.platforms.telegram,
				...(partial?.platforms?.telegram ?? {}),
				greeting: {
					...defaults.platforms.telegram.greeting,
					...(partial?.platforms?.telegram?.greeting ?? {}),
				},
			},
			discord: {
				...defaults.platforms.discord,
				...(partial?.platforms?.discord ?? {}),
				greeting: {
					...defaults.platforms.discord.greeting,
					...(partial?.platforms?.discord?.greeting ?? {}),
				},
			},
		},
		moderation: {
			...defaults.moderation,
			...(partial?.moderation ?? {}),
			categories: {
				spam: {
					...defaults.moderation.categories.spam,
					...(partial?.moderation?.categories?.spam ?? {}),
				},
				toxic: {
					...defaults.moderation.categories.toxic,
					...(partial?.moderation?.categories?.toxic ?? {}),
				},
				fud: {
					...defaults.moderation.categories.fud,
					...(partial?.moderation?.categories?.fud ?? {}),
				},
				fomo: {
					...defaults.moderation.categories.fomo,
					...(partial?.moderation?.categories?.fomo ?? {}),
				},
			},
			spamRules: {
				...defaults.moderation.spamRules,
				...(partial?.moderation?.spamRules ?? {}),
			},
			ladder: partial?.moderation?.ladder ?? defaults.moderation.ladder,
		},
	};
}
