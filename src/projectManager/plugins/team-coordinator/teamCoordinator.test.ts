import { createUniqueUuid, type IAgentRuntime } from "@elizaos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapTeamCoordinator, registerTasksWithRetry } from "./bootstrap";
import { stringifyForLog, toErrorMessage } from "./logging";
import {
  getDiscordClient,
  getTelegramBot,
  requireDiscordClient,
} from "./platform";
import { CheckInService } from "./services/CheckInService";
import {
  filterCheckInScheduleMemories,
  findReportChannelConfigForServer,
  getCheckInSchedulesRoomId,
  getReportChannelConfigRoomId,
  getTeamMembersConfigMemory,
  getTeamMembersRoomId,
} from "./storage";

describe("team coordinator bootstrap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries task registration until runtime is ready", async () => {
    const registerService = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      registerService,
      getTasks: undefined,
    } as unknown as IAgentRuntime;

    const register = vi
      .fn<(...args: any[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const promise = registerTasksWithRetry(runtime, register, {
      retries: 3,
      delayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    (runtime as IAgentRuntime & { getTasks: any }).getTasks = vi
      .fn()
      .mockResolvedValue([]);
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(register).toHaveBeenCalledTimes(1);
  });

  it("registers services and starts deferred task registration from bootstrap", async () => {
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: vi.fn().mockResolvedValue([]),
    } as unknown as IAgentRuntime;

    const register = vi.fn().mockResolvedValue(undefined);
    const services = [{ serviceType: "A" }, { serviceType: "B" }] as any[];

    await bootstrapTeamCoordinator(runtime, {
      services,
      registerTasks: register,
      retries: 1,
      delayMs: 1,
    });

    expect(runtime.registerService).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenCalledTimes(1);
  });
});

describe("team coordinator platform readiness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a validated discord client without exploratory probes", async () => {
    const fetchSpy = vi.fn();
    const runtime = {
      getService: vi
        .fn()
        .mockReturnValue({ client: { users: { fetch: fetchSpy } } }),
    } as unknown as IAgentRuntime;

    const result = await getDiscordClient(runtime);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected discord client");
    expect(result.client).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a consistent failure when telegram bot is unavailable", async () => {
    const runtime = {
      getService: vi.fn().mockReturnValue(undefined),
    } as unknown as IAgentRuntime;

    const result = await getTelegramBot(runtime);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected telegram failure");
    expect(result.error).toContain("Telegram");
  });

  it("throws the shared Discord availability error through the platform requirement helper", async () => {
    const runtime = {
      getService: vi.fn().mockReturnValue(undefined),
    } as unknown as IAgentRuntime;

    await expect(requireDiscordClient(runtime)).rejects.toThrow(
      "Discord service not found",
    );
  });
});

describe("team coordinator logging helpers", () => {
  it("preserves error messages and stringifies circular values safely", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(toErrorMessage(new Error("boom"))).toBe("boom");
    expect(toErrorMessage({ reason: "fallback" })).toBe("[object Object]");
    expect(stringifyForLog("plain-text")).toBe("plain-text");
    expect(stringifyForLog(circular)).toBe("[object Object]");
  });
});

describe("team coordinator shared storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses shared room identity for team members", () => {
    const runtime = { agentId: "agent-id" } as unknown as IAgentRuntime;

    expect(getTeamMembersRoomId(runtime, "server-123")).toBe(
      createUniqueUuid(runtime, "store-team-members-server123"),
    );
    expect(getReportChannelConfigRoomId(runtime)).toBe(
      createUniqueUuid(runtime, "report-channel-config"),
    );
    expect(getCheckInSchedulesRoomId(runtime)).toBe(
      createUniqueUuid(runtime, "check-in-schedules"),
    );
  });

  it("keeps existing team member config shapes readable", async () => {
    const runtime = {
      getMemories: vi.fn().mockResolvedValue([
        {
          id: "memory-1",
          content: {
            type: "store-team-members-memory",
            config: {
              serverId: "server-123",
              teamMembers: [
                {
                  section: "DevRel",
                  discordName: "@alice",
                  updatesFormat: ["Q1"],
                },
              ],
            },
          },
        },
      ]),
    } as unknown as IAgentRuntime;

    const memory = await getTeamMembersConfigMemory(runtime, "server-123");

    expect(memory).toBeDefined();
    if (!memory?.content) throw new Error("expected team member content");

    expect(memory.content.config).toEqual({
      serverId: "server-123",
      teamMembers: [
        { section: "DevRel", discordName: "@alice", updatesFormat: ["Q1"] },
      ],
    });
  });

  it("filters report channel configs and schedules by expected record type", () => {
    const reportConfig = findReportChannelConfigForServer(
      [
        { content: { type: "other" } },
        {
          content: {
            type: "report-channel-config",
            config: { serverId: "server-123", channelId: "channel-1" },
          },
        },
      ] as any,
      "server-123",
    );

    const schedules = filterCheckInScheduleMemories([
      { content: { type: "other" } },
      {
        content: {
          type: "team-member-checkin-schedule",
          schedule: { scheduleId: "schedule-1", serverId: "server-123" },
        },
      },
    ] as any);

    expect(reportConfig).toBeDefined();
    if (!reportConfig?.content) throw new Error("expected report config");
    expect(reportConfig.content.config).toEqual({
      serverId: "server-123",
      channelId: "channel-1",
    });
    expect(schedules).toHaveLength(1);
    if (!schedules[0]?.content) throw new Error("expected schedule content");
    expect(schedules[0].content.schedule).toEqual({
      scheduleId: "schedule-1",
      serverId: "server-123",
    });
  });

  it("keeps existing report channel configs readable when serverId is missing", () => {
    const reportConfig = findReportChannelConfigForServer(
      [
        { content: { type: "other" } },
        {
          content: {
            type: "report-channel-config",
            config: { channelId: "legacy-channel" },
          },
        },
      ] as any,
      "server-123",
    );

    expect(reportConfig).toBeDefined();
    if (!reportConfig?.content) throw new Error("expected report config");
    expect(reportConfig.content.config).toEqual({
      channelId: "legacy-channel",
    });
  });
});

describe("team coordinator interaction responses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to a runtime memory response when reply methods are unavailable", async () => {
    const createMemory = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      agentId: "agent-id",
      createMemory,
    } as unknown as IAgentRuntime;

    const service = new CheckInService(runtime);

    await (service as any).respondToInteraction(
      { customId: "submit_checkin_schedule", roomId: "room-123" },
      "Ack",
      true,
    );

    expect(createMemory).toHaveBeenCalledTimes(1);
    expect(createMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-123",
        content: expect.objectContaining({
          type: "discord-response",
          text: "Ack",
          ephemeral: true,
          source: "team-coordinator",
        }),
      }),
      "messages",
    );
  });
});
