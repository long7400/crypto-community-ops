import type { Evaluator } from "@elizaos/core";
import { ModerationRunner } from "./moderationRunner";

export const telegramModerationEvaluator: Evaluator = {
	name: "COMMUNITY_MODERATION_EVALUATOR",
	description: "Runs Eli5 Telegram moderation on plugin-created Telegram memories.",
	alwaysRun: true,
	examples: [],
	validate: async (_runtime, message) =>
		message.content?.source === "telegram" ||
		message.metadata?.source === "telegram" ||
		message.metadata?.telegram != null,
	handler: async (runtime, message) => {
		await new ModerationRunner(runtime).handleMemory(message);
		return undefined;
	},
};
