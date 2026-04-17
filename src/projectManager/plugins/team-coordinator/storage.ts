import {
  ChannelType,
  createUniqueUuid,
  type IAgentRuntime,
  type UUID,
} from "@elizaos/core";

export type CoordinatorMemory = {
  id?: UUID | string;
  roomId?: UUID | string;
  content?: {
    type?: string;
    config?: Record<string, any>;
    schedule?: Record<string, any>;
  };
};

export function sanitizeServerId(serverId: string): string {
  return serverId.replace(/[^a-zA-Z0-9]/g, "");
}

export function getTeamMembersRoomId(
  runtime: IAgentRuntime,
  serverId: string,
): UUID {
  return createUniqueUuid(
    runtime,
    `store-team-members-${sanitizeServerId(serverId)}`,
  );
}

export function getReportChannelConfigRoomId(runtime: IAgentRuntime): UUID {
  return createUniqueUuid(runtime, "report-channel-config");
}

export function getCheckInSchedulesRoomId(runtime: IAgentRuntime): UUID {
  return createUniqueUuid(runtime, "check-in-schedules");
}

export async function ensureCoordinatorRoom(
  runtime: IAgentRuntime,
  roomId: UUID,
  name: string,
): Promise<void> {
  await runtime.ensureRoomExists({
    id: roomId,
    name,
    source: "team-coordinator",
    type: ChannelType.GROUP,
    worldId: runtime.agentId,
  });
}

export async function getTeamMembersConfigMemory(
  runtime: IAgentRuntime,
  serverId: string,
): Promise<CoordinatorMemory | undefined> {
  const memories = (await runtime.getMemories({
    roomId: getTeamMembersRoomId(runtime, serverId),
    tableName: "messages",
  })) as CoordinatorMemory[];

  return memories.find((memory) => {
    if (memory.content?.type !== "store-team-members-memory") return false;
    const configServerId = memory.content?.config?.serverId;
    return !configServerId || configServerId === serverId;
  });
}

export async function getReportChannelConfigMemory(
  runtime: IAgentRuntime,
  serverId: string,
): Promise<CoordinatorMemory | undefined> {
  const memories = (await runtime.getMemories({
    roomId: getReportChannelConfigRoomId(runtime),
    tableName: "messages",
  })) as CoordinatorMemory[];

  return findReportChannelConfigForServer(memories, serverId);
}

export async function getCheckInScheduleMemories(
  runtime: IAgentRuntime,
): Promise<CoordinatorMemory[]> {
  const memories = (await runtime.getMemories({
    roomId: getCheckInSchedulesRoomId(runtime),
    tableName: "messages",
  })) as CoordinatorMemory[];

  return filterCheckInScheduleMemories(memories);
}

export function findReportChannelConfigForServer(
  memories: CoordinatorMemory[],
  serverId: string,
): CoordinatorMemory | undefined {
  return memories.find(
    (memory) =>
      memory.content?.type === "report-channel-config" &&
      memory.content?.config?.serverId === serverId,
  );
}

export function filterCheckInScheduleMemories(
  memories: CoordinatorMemory[],
): CoordinatorMemory[] {
  return memories.filter(
    (memory) =>
      memory.content?.type === "team-member-checkin-schedule" &&
      !!memory.content?.schedule,
  );
}
