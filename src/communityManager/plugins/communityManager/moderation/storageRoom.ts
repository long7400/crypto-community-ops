import { ChannelType, type IAgentRuntime, type UUID } from "@elizaos/core";

type ModerationStorageRoomParams = {
  id: UUID;
  worldId: string;
  source: "telegram" | "discord";
  channelId: string;
  name: string;
};

export async function ensureModerationStorageRoom(
  runtime: IAgentRuntime,
  params: ModerationStorageRoomParams,
): Promise<void> {
  if (typeof runtime.ensureRoomExists !== "function") {
    return;
  }

  await runtime.ensureRoomExists({
    id: params.id,
    name: params.name,
    source: params.source,
    type: ChannelType.GROUP,
    channelId: params.channelId,
    worldId: params.worldId as UUID,
    metadata: { purpose: "community-moderation-storage" },
  } as any);
}
