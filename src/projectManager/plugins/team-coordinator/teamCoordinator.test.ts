import {
  createUniqueUuid,
  type IAgentRuntime,
  logger,
  type Memory,
  type State,
} from "@elizaos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordCheckInAction } from "./actions/checkInCreate";
import { fetchCheckInSchedules } from "./actions/checkInList";
import { bootstrapTeamCoordinator, registerTasksWithRetry } from "./bootstrap";
import { stringifyForLog, toErrorMessage } from "./logging";
import {
  getDiscordClient,
  getTelegramBot,
  requireDiscordClient,
  resolveRoomServerId,
} from "./platform";
import { CheckInService } from "./services/CheckInService";
import { TeamUpdateTrackerService } from "./services/updateTracker";
import {
  filterCheckInScheduleMemories,
  findReportChannelConfigForServer,
  getCheckInSchedulesRoomId,
  getReportChannelConfigRoomId,
  getTeamMembersConfigMemory,
  getTeamMembersRoomId,
} from "./storage";
import { registerTasks } from "./tasks";

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

  it("logs targeted readiness diagnostics and rejects when runtime.getTasks is unavailable", async () => {
    const debugSpy = vi
      .spyOn(logger, "debug")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: undefined,
    } as unknown as IAgentRuntime;
    const register = vi.fn().mockResolvedValue(undefined);

    const promise = registerTasksWithRetry(runtime, register, {
      retries: 2,
      delayMs: 100,
    });
    const rejection = expect(promise).rejects.toThrow(
      "runtime.getTasks never became available; team coordinator tasks were not registered",
    );

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    await rejection;

    expect(register).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      "runtime.getTasks not yet available (attempt 1/2), will retry",
    );
    expect(debugSpy).toHaveBeenCalledWith(
      "runtime.getTasks not yet available (attempt 2/2), will retry",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "TEAM_COORDINATOR_TASK_REGISTRATION_FAILED: runtime.getTasks never became available; team coordinator tasks were not registered",
    );
  });

  it("keeps terminal registration failure logging and rejects when task registration throws after readiness", async () => {
    const warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: vi.fn().mockResolvedValue([]),
    } as unknown as IAgentRuntime;
    const register = vi.fn().mockRejectedValue(new Error("boom"));

    const promise = registerTasksWithRetry(runtime, register, {
      retries: 2,
      delayMs: 100,
    });
    const rejection = expect(promise).rejects.toThrow(
      "TEAM_COORDINATOR_TASK_REGISTRATION_FAILED: Failed to register team coordinator tasks after all retries",
    );

    await vi.advanceTimersByTimeAsync(100);
    await rejection;

    expect(register).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to register team coordinator tasks (attempt 1/2): boom",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to register team coordinator tasks (attempt 2/2): boom",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "TEAM_COORDINATOR_TASK_REGISTRATION_FAILED: Failed to register team coordinator tasks after all retries",
    );
  });

  it("emits a searchable bootstrap error code when deferred registration exhausts retries", async () => {
    const warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: vi.fn().mockResolvedValue([]),
    } as unknown as IAgentRuntime;
    const register = vi.fn().mockRejectedValue(new Error("boom"));

    bootstrapTeamCoordinator(runtime, {
      registerTasks: register,
      retries: 2,
      delayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(register).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to register team coordinator tasks (attempt 1/2): boom",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to register team coordinator tasks (attempt 2/2): boom",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("TEAM_COORDINATOR_TASK_REGISTRATION_FAILED"),
    );
  });

  it("starts deferred task registration from bootstrap without re-registering services", async () => {
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: vi.fn().mockResolvedValue([]),
    } as unknown as IAgentRuntime;

    const register = vi.fn().mockResolvedValue(undefined);

    bootstrapTeamCoordinator(runtime, {
      registerTasks: register,
      retries: 1,
      delayMs: 1,
    });

    await Promise.resolve();

    expect(runtime.registerService).not.toHaveBeenCalled();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("starts bounded retry-based task registration from bootstrap", async () => {
    const runtime = {
      registerService: vi.fn().mockResolvedValue(undefined),
      getTasks: undefined,
    } as unknown as IAgentRuntime;

    const register = vi.fn().mockResolvedValue(undefined);

    bootstrapTeamCoordinator(runtime, {
      registerTasks: register,
      retries: 3,
      delayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);
    (runtime as IAgentRuntime & { getTasks: unknown }).getTasks = vi
      .fn()
      .mockResolvedValue([]);
    await vi.advanceTimersByTimeAsync(100);

    expect(register).toHaveBeenCalledTimes(1);
    expect(runtime.registerService).not.toHaveBeenCalled();
  });

  it("waits for runtime initialization before starting deferred task registration", async () => {
    let resolveInit: (() => void) | undefined;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    const runtime = {
      initPromise,
      getTasks: vi.fn().mockResolvedValue([]),
    } as unknown as IAgentRuntime;
    const register = vi.fn().mockResolvedValue(undefined);

    bootstrapTeamCoordinator(runtime, {
      registerTasks: register,
      retries: 1,
      delayMs: 1,
    });

    await Promise.resolve();
    expect(register).not.toHaveBeenCalled();

    resolveInit?.();
    await vi.runAllTicks();

    expect(register).toHaveBeenCalledTimes(1);
  });

  it("waits for the runtime-managed tracker service before wiring task execution", async () => {
    const fallbackCheckInJob = vi
      .spyOn(TeamUpdateTrackerService.prototype, "checkInServiceJob")
      .mockResolvedValue(undefined);
    const managedCheckInJob = vi.fn().mockResolvedValue(undefined);
    const managedService = {
      checkInServiceJob: managedCheckInJob,
    } as unknown as TeamUpdateTrackerService;
    const registerTaskWorker = vi.fn();
    const runtime = {
      agentId: "agent-id",
      getService: vi.fn().mockReturnValue(null),
      getServiceLoadPromise: vi.fn().mockResolvedValue(managedService),
      getTasks: vi.fn().mockResolvedValue([]),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      registerTaskWorker,
      createTask: vi.fn().mockResolvedValue(undefined),
    } as unknown as IAgentRuntime;

    await registerTasks(runtime);

    const taskWorker = registerTaskWorker.mock.calls[0]?.[0] as {
      execute: (
        runtime: IAgentRuntime,
        options: unknown,
        task: unknown,
      ) => Promise<void>;
    };
    await taskWorker.execute(runtime, {}, {});

    expect(runtime.getServiceLoadPromise).toHaveBeenCalledWith(
      TeamUpdateTrackerService.serviceType,
    );
    expect(managedCheckInJob).toHaveBeenCalledTimes(1);
    expect(fallbackCheckInJob).not.toHaveBeenCalled();
  });

  it("fails task registration when the tracker service load times out", async () => {
    const runtime = {
      agentId: "agent-id",
      getService: vi.fn().mockReturnValue(null),
      getServiceLoadPromise: vi.fn(() => new Promise(() => undefined)),
      getTasks: vi.fn().mockResolvedValue([]),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      registerTaskWorker: vi.fn(),
      createTask: vi.fn().mockResolvedValue(undefined),
    } as unknown as IAgentRuntime;

    const registerPromise = registerTasks(runtime);
    const rejection = expect(registerPromise).rejects.toThrow(
      "TeamUpdateTrackerService load timed out after 5000ms",
    );

    await vi.advanceTimersByTimeAsync(5000);

    await rejection;
    expect(runtime.getTasks).not.toHaveBeenCalled();
    expect(runtime.registerTaskWorker).not.toHaveBeenCalled();
  });
});

describe("team coordinator platform readiness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a validated discord client without exploratory probes", () => {
    const fetchSpy = vi.fn();
    const runtime = {
      getService: vi
        .fn()
        .mockReturnValue({ client: { users: { fetch: fetchSpy } } }),
    } as unknown as IAgentRuntime;

    const result = getDiscordClient(runtime);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected discord client");
    expect(result.client).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a consistent failure when telegram bot is unavailable", () => {
    const runtime = {
      getService: vi.fn().mockReturnValue(undefined),
    } as unknown as IAgentRuntime;

    const result = getTelegramBot(runtime);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected telegram failure");
    expect(result.error).toContain("Telegram");
  });

  it("throws the shared Discord availability error through the platform requirement helper", () => {
    const runtime = {
      getService: vi.fn().mockReturnValue(undefined),
    } as unknown as IAgentRuntime;

    expect(() => requireDiscordClient(runtime)).toThrow(
      "Discord service not found",
    );
  });

  it("resolves raw discord server ids from rooms that only expose UUID aliases", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ guildId: "discord-guild-1" });
    const runtime = {
      getService: vi
        .fn()
        .mockReturnValue({ client: { channels: { fetch: fetchSpy } } }),
    } as unknown as IAgentRuntime;

    await expect(
      resolveRoomServerId(runtime, {
        source: "discord",
        serverId: "550e8400-e29b-41d4-a716-446655440000",
        channelId: "channel-123",
      }),
    ).resolves.toBe("discord-guild-1");
  });

  it("checks tracker platform readiness without awaiting synchronous helper results", async () => {
    vi.resetModules();
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const discordResult = {
      ok: false as const,
      error: "Discord service not found",
    };
    const telegramResult = {
      ok: false as const,
      error: "Telegram service not found",
    };

    Object.defineProperty(discordResult, "then", {
      get() {
        throw new Error("discord readiness result was awaited");
      },
    });
    Object.defineProperty(telegramResult, "then", {
      get() {
        throw new Error("telegram readiness result was awaited");
      },
    });

    const getDiscordClientMock = vi.fn(() => discordResult);
    const getTelegramBotMock = vi.fn(() => telegramResult);

    vi.doMock("./platform", async () => {
      const actual =
        await vi.importActual<typeof import("./platform")>("./platform");
      return {
        ...actual,
        getDiscordClient: getDiscordClientMock,
        getTelegramBot: getTelegramBotMock,
      };
    });

    try {
      const { TeamUpdateTrackerService: FreshTeamUpdateTrackerService } =
        await import("./services/updateTracker");
      const runtime = {
        getService: vi.fn().mockReturnValue(undefined),
      } as unknown as IAgentRuntime;

      await expect(
        new FreshTeamUpdateTrackerService(runtime).checkInServiceJob(),
      ).resolves.toBeUndefined();

      expect(getDiscordClientMock).toHaveBeenCalledWith(runtime);
      expect(getTelegramBotMock).toHaveBeenCalledWith(runtime);
    } finally {
      vi.doUnmock("./platform");
      vi.resetModules();
    }
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

  it("ignores malformed team member config payloads when finding a server match", async () => {
    const runtime = {
      getMemories: vi.fn().mockResolvedValue([
        {
          id: "memory-bad",
          content: {
            type: "store-team-members-memory",
            config: "invalid-config",
          },
        },
        {
          id: "memory-good",
          content: {
            type: "store-team-members-memory",
            config: {
              serverId: "server-123",
              teamMembers: [{ discordName: "@alice" }],
            },
          },
        },
      ]),
    } as unknown as IAgentRuntime;

    const memory = await getTeamMembersConfigMemory(runtime, "server-123");

    expect(memory?.id).toBe("memory-good");
  });

  it("preserves legacy team member fallback when config payloads are unreadable", async () => {
    const runtime = {
      getMemories: vi.fn().mockResolvedValue([
        {
          id: "memory-legacy",
          content: {
            type: "store-team-members-memory",
            config: "invalid-config",
          },
        },
      ]),
    } as unknown as IAgentRuntime;

    const memory = await getTeamMembersConfigMemory(runtime, "server-123");

    expect(memory?.id).toBe("memory-legacy");
  });

  it("prefers readable legacy team member fallbacks over malformed records", async () => {
    const runtime = {
      getMemories: vi.fn().mockResolvedValue([
        {
          id: "memory-malformed",
          content: {
            type: "store-team-members-memory",
            config: "invalid-config",
          },
        },
        {
          id: "memory-legacy",
          content: {
            type: "store-team-members-memory",
            config: { teamMembers: [{ discordName: "@alice" }] },
          },
        },
      ]),
    } as unknown as IAgentRuntime;

    const memory = await getTeamMembersConfigMemory(runtime, "server-123");

    expect(memory?.id).toBe("memory-legacy");
  });

  it("filters malformed persisted team members before downstream consumers use string fields", async () => {
    const runtime = {
      agentId: "agent-id",
      getMemories: vi.fn().mockResolvedValue([
        {
          content: {
            type: "store-team-members-memory",
            config: {
              serverId: "server-123",
              teamMembers: [
                { discordName: {} },
                { discordName: "@alice", updatesFormat: ["Q1"] },
              ],
            },
          },
        },
      ]),
    } as unknown as IAgentRuntime;

    const service = new TeamUpdateTrackerService(runtime);

    await expect(
      service.getTeamMembers("server-123", "discord"),
    ).resolves.toEqual([
      {
        username: "@alice",
        section: "Unassigned",
        platform: "discord",
        updatesFormat: ["Q1"],
      },
    ]);
  });

  it("prefers Telegram usernames when formatting Telegram team members", async () => {
    const runtime = {
      agentId: "agent-id",
      getMemories: vi.fn().mockResolvedValue([
        {
          content: {
            type: "store-team-members-memory",
            config: {
              serverId: "server-123",
              teamMembers: [
                {
                  section: "DevRel",
                  tgName: "@alice_tg",
                  discordName: "@alice_discord",
                  updatesFormat: ["Q1"],
                },
              ],
            },
          },
        },
      ]),
    } as unknown as IAgentRuntime;

    const service = new TeamUpdateTrackerService(runtime);

    await expect(
      service.getTeamMembers("server-123", "telegram"),
    ).resolves.toEqual([
      {
        username: "@alice_tg",
        section: "DevRel",
        platform: "telegram",
        updatesFormat: ["Q1"],
      },
    ]);
  });

  it("ignores incomplete persisted schedules before returning check-in schedules", async () => {
    const runtime = {
      getMemories: vi.fn().mockResolvedValue([
        {
          id: "memory-invalid",
          content: {
            type: "team-member-checkin-schedule",
            schedule: { scheduleId: "schedule-1", serverId: "server-123" },
          },
        },
        {
          id: "memory-valid",
          content: {
            type: "team-member-checkin-schedule",
            schedule: {
              scheduleId: "schedule-2",
              checkInType: "STANDUP",
              channelId: "channel-1",
              frequency: "WEEKLY",
              checkInTime: "09:00",
              createdAt: "2026-04-19T00:00:00.000Z",
              serverId: "server-123",
            },
          },
        },
      ]),
    } as unknown as IAgentRuntime;

    await expect(fetchCheckInSchedules(runtime)).resolves.toEqual([
      {
        scheduleId: "schedule-2",
        checkInType: "STANDUP",
        channelId: "channel-1",
        frequency: "WEEKLY",
        checkInTime: "09:00",
        createdAt: "2026-04-19T00:00:00.000Z",
        serverId: "server-123",
      },
    ]);
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
          schedule: {
            scheduleId: "schedule-1",
            checkInType: "STANDUP",
            channelId: "channel-1",
            frequency: "WEEKLY",
            checkInTime: "09:00",
            createdAt: "2026-04-19T00:00:00.000Z",
            serverId: "server-123",
          },
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
      checkInType: "STANDUP",
      channelId: "channel-1",
      frequency: "WEEKLY",
      checkInTime: "09:00",
      createdAt: "2026-04-19T00:00:00.000Z",
      serverId: "server-123",
    });
  });

  it("ignores malformed schedule payloads when filtering check-in schedules", () => {
    const schedules = filterCheckInScheduleMemories([
      {
        content: {
          type: "team-member-checkin-schedule",
          schedule: "invalid-schedule",
        },
      },
      {
        content: {
          type: "team-member-checkin-schedule",
          schedule: {
            scheduleId: "schedule-1",
            checkInType: "STANDUP",
            channelId: "channel-1",
            frequency: "WEEKLY",
            checkInTime: "09:00",
            createdAt: "2026-04-19T00:00:00.000Z",
            serverId: "server-123",
          },
        },
      },
    ] as any);

    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.content?.schedule).toEqual({
      scheduleId: "schedule-1",
      checkInType: "STANDUP",
      channelId: "channel-1",
      frequency: "WEEKLY",
      checkInTime: "09:00",
      createdAt: "2026-04-19T00:00:00.000Z",
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

  it("prefers readable legacy report channel fallbacks over malformed records", () => {
    const reportConfig = findReportChannelConfigForServer(
      [
        {
          content: {
            type: "report-channel-config",
            config: "invalid-config",
          },
        },
        {
          content: {
            type: "report-channel-config",
            config: { channelId: "legacy-channel" },
          },
        },
      ] as any,
      "server-123",
    );

    expect(reportConfig?.content?.config).toEqual({
      channelId: "legacy-channel",
    });
  });
});

describe("team coordinator interaction responses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses interaction callback responses when reply methods are unavailable", async () => {
    const emitEvent = vi.fn().mockResolvedValue(undefined);
    const callback = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      agentId: "agent-id",
      emitEvent,
    } as unknown as IAgentRuntime;

    const service = new CheckInService(runtime);

    await (service as any).respondToInteraction(
      {
        customId: "submit_checkin_schedule",
        roomId: "room-123",
        callback,
      },
      "Ack",
      true,
    );

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ text: "Ack" });
    expect(emitEvent).not.toHaveBeenCalled();
  });
});

describe("team coordinator check-in creation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unresolved channel names before storing report or schedule records", async () => {
    const callback = vi.fn().mockResolvedValue(undefined);
    const runtime = {
      getRoom: vi.fn().mockResolvedValue({
        id: "room-1",
        serverId: "server-123",
        source: "discord",
      }),
      getService: vi.fn().mockReturnValue({
        client: {
          guilds: {
            cache: {
              get: vi.fn().mockReturnValue({
                name: "Guild",
                channels: {
                  fetch: vi.fn().mockResolvedValue(
                    new Map([
                      [
                        "channel-1",
                        {
                          id: "channel-1",
                          name: "general",
                          type: 0,
                          isTextBased: () => true,
                          isDMBased: () => false,
                        },
                      ],
                    ]),
                  ),
                },
              }),
            },
          },
        },
      }),
      useModel: vi
        .fn()
        .mockResolvedValueOnce("false")
        .mockResolvedValueOnce(
          JSON.stringify({
            channelForUpdates: "missing-updates",
            checkInType: "STANDUP",
            channelForCheckIns: "general",
            frequency: "WEEKLY",
            time: "09:00",
          }),
        ),
      getMemories: vi.fn().mockResolvedValue([]),
      createMemory: vi.fn().mockResolvedValue(undefined),
      ensureRoomExists: vi.fn().mockResolvedValue(undefined),
      agentId: "agent-id",
    } as unknown as IAgentRuntime;
    const state = {
      data: {
        room: { id: "room-1", serverId: "server-123", source: "discord" },
        serverId: "server-123",
        isAdmin: true,
      },
    } as unknown as State;
    const message = {
      roomId: "room-1",
      entityId: "user-1",
      content: { text: "Record Check-in details", source: "discord" },
    } as unknown as Memory;

    const result = await recordCheckInAction.handler(
      runtime,
      message,
      state,
      {},
      callback,
    );

    expect(result).toBeDefined();
    expect(result?.success).toBe(false);
    expect(result?.error).toContain("Unknown updates channel");
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          'couldn\'t find a Discord text channel matching "missing-updates"',
        ),
      }),
    );
    expect((runtime as any).createMemory).not.toHaveBeenCalled();
  });
});
