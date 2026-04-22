import type {
	CommunityModerationSettings,
	ModerationClassification,
	ModerationMessage,
} from "./types";

const URL_PATTERN = /https?:\/\/\S+|t\.me\/\S+|www\.\S+/gi;
const MENTION_PATTERN = /@\w+/g;

export function classifyMessageWithRules(
	message: ModerationMessage,
	settings: CommunityModerationSettings,
	recentMessagesFromUser: ModerationMessage[],
): ModerationClassification {
	const text = message.text.trim().toLowerCase();
	const urls = message.text.match(URL_PATTERN) ?? [];
	const mentions = message.text.match(MENTION_PATTERN) ?? [];
	const repeatedCount = recentMessagesFromUser.filter(
		(recent) => recent.text.trim().toLowerCase() === text,
	).length;
	const oneMinuteAgo = message.createdAt - 60_000;
	const messagesInLastMinute = recentMessagesFromUser.filter(
		(recent) => recent.createdAt >= oneMinuteAgo,
	).length;

	if (
		messagesInLastMinute >= settings.moderation.spamRules.maxMessagesPerMinute
	) {
		return {
			category: "spam",
			severity: "medium",
			confidence: 0.88,
			reason: "User sent too many messages in a short time window.",
			signals: ["message_flood"],
		};
	}

	if (urls.length > settings.moderation.spamRules.maxLinksPerMessage) {
		return {
			category: "spam",
			severity: "medium",
			confidence: 0.9,
			reason: "Message contains too many links.",
			signals: ["too_many_links"],
		};
	}

	if (mentions.length > settings.moderation.spamRules.maxMentionsPerMessage) {
		return {
			category: "spam",
			severity: "medium",
			confidence: 0.85,
			reason: "Message mentions too many users.",
			signals: ["too_many_mentions"],
		};
	}

	if (
		repeatedCount >= settings.moderation.spamRules.maxRepeatedMessages - 1
	) {
		return {
			category: "spam",
			severity: "low",
			confidence: 0.8,
			reason: "User repeated the same message too many times.",
			signals: ["repeated_message"],
		};
	}

	return {
		category: "safe",
		severity: "low",
		confidence: 1,
		reason: "No deterministic moderation rule matched.",
		signals: [],
	};
}
