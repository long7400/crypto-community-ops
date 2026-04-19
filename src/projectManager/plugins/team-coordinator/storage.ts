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
    config?: unknown;
    schedule?: unknown;
  };
};

export type CoordinatorRecord = Record<string, unknown>;

export type StoredCoordinatorTeamMember = {
  section?: string;
  tgName?: string;
  discordName?: string;
  format?: string;
  serverId?: string;
  serverName?: string;
  createdAt?: string;
  updatesFormat?: string[];
};

export type StoredCoordinatorSchedule = {
  type?: string;
  scheduleId: string;
  teamMemberName?: string | null;
  teamMemberUserName?: string;
  checkInType: string;
  channelId: string;
  frequency: string;
  checkInTime: string;
  createdAt: string;
  source?: string;
  serverId?: string;
  lastUpdated?: number;
};

export function isCoordinatorRecord(
  value: unknown,
): value is CoordinatorRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getCoordinatorConfig(
  memory: CoordinatorMemory | undefined,
): CoordinatorRecord | undefined {
  return isCoordinatorRecord(memory?.content?.config)
    ? memory.content.config
    : undefined;
}

export function getCoordinatorSchedule(
  memory: CoordinatorMemory | undefined,
): CoordinatorRecord | undefined {
  return isCoordinatorRecord(memory?.content?.schedule)
    ? memory.content.schedule
    : undefined;
}

export function getCoordinatorString(
  record: CoordinatorRecord | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

export function getCoordinatorArray(
  record: CoordinatorRecord | undefined,
  key: string,
): unknown[] | undefined {
  const value = record?.[key];
  return Array.isArray(value) ? value : undefined;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNullableString(
  value: unknown,
): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

export function isCoordinatorStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function isStoredCoordinatorTeamMember(
  value: unknown,
): value is StoredCoordinatorTeamMember {
  if (!isCoordinatorRecord(value)) {
    return false;
  }

  const hasKnownTeamMemberField = [
    "section",
    "tgName",
    "discordName",
    "format",
    "serverId",
    "serverName",
    "createdAt",
    "updatesFormat",
  ].some((key) => key in value);

  if (!hasKnownTeamMemberField) {
    return false;
  }

  return (
    isOptionalString(value.section) &&
    isOptionalString(value.tgName) &&
    isOptionalString(value.discordName) &&
    isOptionalString(value.format) &&
    isOptionalString(value.serverId) &&
    isOptionalString(value.serverName) &&
    isOptionalString(value.createdAt) &&
    (value.updatesFormat === undefined ||
      isCoordinatorStringArray(value.updatesFormat))
  );
}

export function isStoredCoordinatorSchedule(
  value: unknown,
): value is StoredCoordinatorSchedule {
  return (
    isCoordinatorRecord(value) &&
    typeof value.scheduleId === "string" &&
    typeof value.checkInType === "string" &&
    typeof value.channelId === "string" &&
    typeof value.frequency === "string" &&
    typeof value.checkInTime === "string" &&
    typeof value.createdAt === "string" &&
    isOptionalString(value.type) &&
    isOptionalNullableString(value.teamMemberName) &&
    isOptionalString(value.teamMemberUserName) &&
    isOptionalString(value.source) &&
    isOptionalString(value.serverId) &&
    (value.lastUpdated === undefined || typeof value.lastUpdated === "number")
  );
}

export function getCoordinatorMemoryId(
  memory: CoordinatorMemory | undefined,
): UUID | undefined {
  return typeof memory?.id === "string" ? (memory.id as UUID) : undefined;
}

export function getCoordinatorRoomId(
  memory: CoordinatorMemory | undefined,
): UUID | undefined {
  return typeof memory?.roomId === "string"
    ? (memory.roomId as UUID)
    : undefined;
}

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

  const matchingConfig = memories.find(
    (memory) =>
      memory.content?.type === "store-team-members-memory" &&
      getCoordinatorString(getCoordinatorConfig(memory), "serverId") ===
        serverId,
  );

  if (matchingConfig) {
    return matchingConfig;
  }

  return memories.find(
    (memory) =>
      memory.content?.type === "store-team-members-memory" &&
      !getCoordinatorString(getCoordinatorConfig(memory), "serverId"),
  );
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
  const matchingConfig = memories.find(
    (memory) =>
      memory.content?.type === "report-channel-config" &&
      getCoordinatorString(getCoordinatorConfig(memory), "serverId") ===
        serverId,
  );

  if (matchingConfig) {
    return matchingConfig;
  }

  return memories.find(
    (memory) =>
      memory.content?.type === "report-channel-config" &&
      !getCoordinatorString(getCoordinatorConfig(memory), "serverId"),
  );
}

export function filterCheckInScheduleMemories(
  memories: CoordinatorMemory[],
): CoordinatorMemory[] {
  return memories.filter(
    (memory) =>
      memory.content?.type === "team-member-checkin-schedule" &&
      !!getCoordinatorSchedule(memory),
  );
}
