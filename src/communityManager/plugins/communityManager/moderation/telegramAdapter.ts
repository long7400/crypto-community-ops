import { logger, type IAgentRuntime } from "@elizaos/core";
import type {
	ModerationEnforcementPort,
	ModerationMuteOptions,
} from "./enforcementPort";
import { callTelegramApi } from "./telegramErrors";

export class TelegramModerationAdapter implements ModerationEnforcementPort {
	constructor(private readonly runtime: IAgentRuntime) {}

	async warn(chatId: string, text: string): Promise<void> {
		const telegram = this.runtime.getService("telegram") as any;
		if (!telegram?.messageManager?.sendMessage) {
			logger.warn("Telegram service unavailable; warning message skipped");
			return;
		}
		await callTelegramApi(
			() => telegram.messageManager.sendMessage(chatId, { text }),
			"send warning",
		);
	}

	async mute(
		chatId: string,
		userId: string,
		options: ModerationMuteOptions,
	): Promise<void> {
		const telegram = this.runtime.getService("telegram") as any;
		if (!telegram?.bot?.telegram?.restrictChatMember) {
			throw new Error("Telegram bot is unavailable for moderation mute");
		}

		await this.assertCanRestrictMembers(telegram, chatId);

		const untilDate = options.permanent
			? 0
			: Math.floor(Date.now() / 1000) + (options.durationSeconds ?? 3600);

		await callTelegramApi(
			() =>
				telegram.bot.telegram.restrictChatMember(chatId, userId, {
					permissions: {
						can_send_messages: false,
						can_send_media_messages: false,
						can_send_polls: false,
						can_send_other_messages: false,
						can_add_web_page_previews: false,
						can_change_info: false,
						can_invite_users: false,
						can_pin_messages: false,
					},
					until_date: untilDate,
				}),
			"restrict member",
		);
	}

	private async assertCanRestrictMembers(
		telegram: any,
		chatId: string,
	): Promise<void> {
		const botId =
			telegram.bot?.botInfo?.id ?? (await telegram.bot.telegram.getMe())?.id;
		const member = await callTelegramApi(
			() => telegram.bot.telegram.getChatMember(chatId, botId),
			"check bot admin",
		);
		const canModerate =
			member?.status === "creator" ||
			(member?.status === "administrator" &&
				member?.can_restrict_members === true);
		if (!canModerate) {
			throw new Error("Telegram bot cannot restrict members in this chat");
		}
	}
}
