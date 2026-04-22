import { logger, type IAgentRuntime } from "@elizaos/core";
import type { CommunityModerationSettings, ModerationMessage } from "./types";

export async function isTelegramModerationAdmin(
  runtime: IAgentRuntime,
  message: Pick<ModerationMessage, "channelId" | "userId">,
  settings: CommunityModerationSettings,
): Promise<boolean> {
  if (settings.platforms.telegram.adminUserIds.includes(message.userId)) {
    return true;
  }

  const telegram = runtime.getService("telegram") as any;
  const getChatMember = telegram?.bot?.telegram?.getChatMember;
  if (!getChatMember) {
    logger.warn("Telegram getChatMember unavailable; admin command denied");
    return false;
  }

  try {
    const member = await getChatMember(message.channelId, message.userId);
    return member?.status === "creator" || member?.status === "administrator";
  } catch (error) {
    logger.warn(
      `Unable to verify Telegram admin command sender: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}
