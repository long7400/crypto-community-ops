import {
  logger,
  type IAgentRuntime,
  type UUID,
  type World,
} from "@elizaos/core";
import { mergeCommunityModerationSettings } from "./defaults";
import type {
  CommunityModerationSettings,
  PartialCommunityModerationSettings,
} from "./types";

export const COMMUNITY_MODERATION_SETTING_KEY = "COMMUNITY_MODERATION";

function mergeStoredSettings(
  current: CommunityModerationSettings,
  patch: PartialCommunityModerationSettings,
): CommunityModerationSettings {
  return mergeCommunityModerationSettings({
    ...current,
    ...patch,
    platforms: {
      telegram: {
        ...current.platforms.telegram,
        ...(patch.platforms?.telegram ?? {}),
        greeting: {
          ...current.platforms.telegram.greeting,
          ...(patch.platforms?.telegram?.greeting ?? {}),
        },
      },
      discord: {
        ...current.platforms.discord,
        ...(patch.platforms?.discord ?? {}),
        greeting: {
          ...current.platforms.discord.greeting,
          ...(patch.platforms?.discord?.greeting ?? {}),
        },
      },
    },
    moderation: {
      ...current.moderation,
      ...(patch.moderation ?? {}),
      categories: {
        spam: {
          ...current.moderation.categories.spam,
          ...(patch.moderation?.categories?.spam ?? {}),
        },
        toxic: {
          ...current.moderation.categories.toxic,
          ...(patch.moderation?.categories?.toxic ?? {}),
        },
        fud: {
          ...current.moderation.categories.fud,
          ...(patch.moderation?.categories?.fud ?? {}),
        },
        fomo: {
          ...current.moderation.categories.fomo,
          ...(patch.moderation?.categories?.fomo ?? {}),
        },
      },
      spamRules: {
        ...current.moderation.spamRules,
        ...(patch.moderation?.spamRules ?? {}),
      },
      ladder: patch.moderation?.ladder ?? current.moderation.ladder,
    },
  });
}

export class CommunityModerationSettingsRepository {
  constructor(private readonly runtime: IAgentRuntime) {}

  async getForWorld(worldId: UUID): Promise<CommunityModerationSettings> {
    const world = await this.runtime.getWorld(worldId);
    const raw =
      world?.metadata?.settings?.[COMMUNITY_MODERATION_SETTING_KEY]?.value;
    return mergeCommunityModerationSettings(raw);
  }

  async saveForWorld(
    worldId: UUID,
    patch: PartialCommunityModerationSettings,
  ): Promise<CommunityModerationSettings> {
    const world = await this.runtime.getWorld(worldId);
    if (!world) {
      throw new Error(
        `Cannot save community moderation settings: world ${worldId} not found`,
      );
    }

    const current = await this.getForWorld(worldId);
    const next = mergeStoredSettings(current, patch);

    const updatedWorld: World = {
      ...world,
      metadata: {
        ...(world.metadata ?? {}),
        settings: {
          ...(world.metadata?.settings ?? {}),
          [COMMUNITY_MODERATION_SETTING_KEY]: {
            value: next,
          },
        },
      },
    };

    await this.runtime.updateWorld(updatedWorld);
    logger.info(`Saved community moderation settings for world ${worldId}`);
    return next;
  }
}
