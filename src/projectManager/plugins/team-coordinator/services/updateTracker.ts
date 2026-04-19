import {
  createUniqueUuid,
  EventType,
  type IAgentRuntime,
  logger,
  type Memory,
  type MemoryMetadata,
  ModelType,
  Service,
  type UUID,
} from "@elizaos/core";
import type {
  Channel,
  Client,
  GuildChannel,
  TextChannel,
  VoiceChannel,
} from "discord.js";
import type { CheckInSchedule } from "../../../types";
import { fetchCheckInSchedules } from "../actions/checkInList";
import { toErrorMessage } from "../logging";
import { getDiscordClient, getTelegramBot } from "../platform";
import {
  type CoordinatorMemory,
  type CoordinatorRecord,
  filterCheckInScheduleMemories,
  getCheckInSchedulesRoomId,
  getCoordinatorArray,
  getCoordinatorConfig,
  getCoordinatorMemoryId,
  getCoordinatorRoomId,
  getCoordinatorSchedule,
  getCoordinatorString,
  getTeamMembersConfigMemory,
  isStoredCoordinatorTeamMember,
  type StoredCoordinatorTeamMember,
} from "../storage";

// Define interfaces for custom services
interface IDiscordService extends Service {
  client?: Client;
}

interface ITelegramService extends Service {
  bot?: any; // Using any for now as we don't have the full Telegram bot type
}

// Extended CheckInSchedule with lastUpdated property
interface ExtendedCheckInSchedule extends CheckInSchedule {
  lastUpdated?: number;
}

function getStoredTeamMembers(
  config: CoordinatorRecord | undefined,
): StoredCoordinatorTeamMember[] {
  const teamMembers = getCoordinatorArray(config, "teamMembers");
  return teamMembers?.filter(isStoredCoordinatorTeamMember) ?? [];
}

export class TeamUpdateTrackerService extends Service {
  private client: Client | null = null;

  private telegramBot: any = null;
  private isJobRunning: boolean = false;
  static serviceType = "team-update-tracker-service";
  capabilityDescription =
    "Manages team member updates, check-ins, and coordinates communication through Discord channels";
  // Store available Discord channels
  private textChannels: Array<{ id: string; name: string; type: string }> = [];
  private usersToMessage: Array<{
    id: string;
    username: string;
    displayName: string;
    channelName: string;
    updatesFormat?: string[];
  }> = [];

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  async start(): Promise<void> {
    logger.info("Starting Discord Channel Service");
    try {
      const discordResult = getDiscordClient(this.runtime);
      const telegramResult = getTelegramBot(this.runtime);

      if (discordResult.ok) {
        logger.info("Discord service found, client available");
        this.client = discordResult.client as Client;
      } else {
        logger.warn(
          "Discord service not found or client not available - will try to connect later",
        );
        this.setupDiscordRetry();
      }

      if (telegramResult.ok) {
        logger.info("Telegram service found, client available");
        this.telegramBot = telegramResult.client;
      } else {
        logger.warn(
          "Telegram service not found or client not available - will try to connect later",
        );
        this.setupTelegramRetry();
      }
    } catch (error) {
      logger.error(
        `Error initializing Discord Channel Service: ${toErrorMessage(error)}`,
      );
    }
  }

  private setupDiscordRetry() {
    logger.info("Setting up retry for Discord service connection");
    const intervalId = setInterval(() => {
      try {
        const discordResult = getDiscordClient(this.runtime);
        if (discordResult.ok) {
          logger.info("Discord service now available, connecting client");
          this.client = discordResult.client as Client;

          clearInterval(intervalId);
        } else {
          logger.debug("Discord service still not available, will retry");
        }
      } catch (error) {
        logger.debug(
          `Error checking for Discord service: ${toErrorMessage(error)}`,
        );
      }
    }, 15000);
  }

  private setupTelegramRetry() {
    logger.info("Setting up retry for Telegram service connection");
    const intervalId = setInterval(() => {
      try {
        const telegramResult = getTelegramBot(this.runtime);
        if (telegramResult.ok) {
          logger.info("Telegram service now available, connecting bot");
          this.telegramBot = telegramResult.client;

          clearInterval(intervalId);
        } else {
          logger.debug("Telegram service still not available, will retry");
        }
      } catch (error) {
        logger.debug(
          `Error checking for Telegram service: ${toErrorMessage(error)}`,
        );
      }
    }, 15000);
  }

  /**
   * Fetches all users in a Discord channel who have permission to view it
   * @param channelId - The Discord channel ID to fetch users from
   * @returns Array of users with access to the channel
   */
  public async fetchUsersInChannel(channelId: string): Promise<
    Array<{
      id: string;
      username: string;
      displayName: string;
      channelName: string;
    }>
  > {
    logger.info(`Fetching users for channel ID: ${channelId}`);

    if (!this.client) {
      logger.error("Discord client is not available");
      return [];
    }

    try {
      const users: Array<{
        id: string;
        username: string;
        displayName: string;
        channelName: string;
      }> = [];

      // Fetch the channel from Discord
      const discordChannel = await this.client.channels.fetch(channelId);

      if (!discordChannel) {
        logger.warn(`Channel with ID ${channelId} not found`);
        return [];
      }

      logger.info(`Successfully fetched channel: ${discordChannel.id}`);

      // Check if it's a text channel in a guild
      if (
        discordChannel.isTextBased() &&
        !discordChannel.isDMBased() &&
        "guild" in discordChannel &&
        discordChannel.guild
      ) {
        const channelName =
          "name" in discordChannel ? discordChannel.name : "unknown-channel";
        logger.info(`Processing guild text channel: ${channelName}`);

        // Get all members who can view the channel
        const members = discordChannel.guild.members.cache;

        for (const [memberId, member] of members.entries()) {
          if (discordChannel.permissionsFor(member)?.has("ViewChannel")) {
            const user = {
              id: member.id,
              username: member.user.username,
              displayName: member.displayName,
              channelName: channelName,
            };

            users.push(user);
            logger.debug(
              `Added user to channel list: ${user.displayName} (${user.id})`,
            );
          }
        }

        logger.info(
          `Found ${users.length} users with access to channel ${channelName} (${channelId})`,
        );
      } else {
        logger.warn(`Channel ${channelId} is not a guild text channel`);
      }

      return users;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(
        `Error fetching users for channel ${channelId}: ${toErrorMessage(error)}`,
      );
      logger.error(`Error stack: ${err.stack}`);
      return [];
    }
  }

  /**
   * Sends a direct message to all users in the provided list
   * @param users Array of user objects containing id, username, displayName, and channelName
   * @param message The message content to send to each user
   * @returns Promise resolving to an array of user IDs that were successfully messaged
   */
  public async messageAllUsers(
    users: Array<{
      id: string;
      username: string;
      displayName: string;
      channelName: string;
      updatesFormat?: string[];
    }>,
    schedule: CheckInSchedule,
    serverName?: string,
  ): Promise<string[]> {
    logger.info(`Attempting to message ${users.length} users`);
    const successfullyMessaged: string[] = [];

    if (!this.client) {
      logger.error("Discord client not available, cannot send messages");
      return successfullyMessaged;
    }

    for (const user of users) {
      try {
        logger.info(
          `Attempting to fetch Discord user: ${user.displayName} (${user.id})`,
        );
        const discordUser = await this.client.users.fetch(user.id);

        if (discordUser && !discordUser.bot) {
          logger.info(
            `Sending message to non-bot user ${user.displayName} (${user.id})`,
          );

          // Create the message format based on user's updatesFormat if available
          let updateFormatMessage = "";

          if (user.updatesFormat && user.updatesFormat.length > 0) {
            // Use custom format from user's updatesFormat
            updateFormatMessage = user.updatesFormat
              .map((field) => `- **${field}**\n    - Text`)
              .join("\n");
          } else {
            // Use default format
            updateFormatMessage =
              `- **Main Priority for next week**\n` +
              `    - Text\n` +
              `- **What did you get done this week?**\n` +
              `    - Text\n` +
              `- **Blockers**\n` +
              `    - Text`;
          }

          await discordUser.send(
            `Hi ${user.displayName}! It's ${new Date().toLocaleString("en-US", { weekday: "long" })}. Please share your latest updates for the ${user.channelName} channel.\n\n` +
              `Please use the following format for your update:\n` +
              `**Server-name**: ${serverName}\n\n` +
              `**Check-in Type**: ${schedule.checkInType}\n\n` +
              `${updateFormatMessage}\n\n` +
              `Important: End your message with "sending my personal updates" so it can be properly tracked.`,
          );

          logger.info(
            `Successfully sent update request to user ${user.displayName} (${user.id}) for channel ${user.channelName}`,
          );
          successfullyMessaged.push(user.id);
        } else if (discordUser?.bot) {
          logger.info(`Skipping bot user ${user.displayName} (${user.id})`);
        } else {
          logger.warn(`Could not find Discord user with ID ${user.id}`);
        }
      } catch (error: unknown) {
        const err = error as Error;
        logger.error(
          `Failed to send DM to user ${user.displayName} (${user.id}): ${toErrorMessage(error)}`,
        );
        logger.error(`Error stack: ${err.stack}`);
      }
    }

    logger.info(
      `Successfully messaged ${successfullyMessaged.length}/${users.length} users`,
    );
    return successfullyMessaged;
  }

  /**
   * Fetches team members for a specific server from memory
   * @param serverId The ID of the server to fetch team members for
   * @param platform Optional platform filter ('discord' or 'telegram')
   * @returns An array of team members with their details
   */
  public async getTeamMembers(
    serverId: string,
    platform?: "discord" | "telegram",
  ): Promise<
    Array<{
      username: string;
      section: string;
      platform: string;
      updatesFormat?: string[];
    }>
  > {
    try {
      logger.info(
        `Fetching team members for server ${serverId}${platform ? ` on ${platform}` : ""}`,
      );

      // Create the consistent room ID for storing team members
      const teamMembersConfig = await getTeamMembersConfigMemory(
        this.runtime,
        serverId,
      );

      interface TeamMembersConfig {
        teamMembers?: Array<{
          section: string;
          tgName?: string;
          discordName?: string;
          updatesFormat?: string[];
          serverId: string;
        }>;
      }

      const config = getCoordinatorConfig(teamMembersConfig);

      if (!teamMembersConfig) {
        logger.info("No team members found for this server");
        return [];
      }

      // Extract team members
      const teamMembers = getStoredTeamMembers(config);

      logger.info(
        `Found ${teamMembers.length} team members for server ${serverId}`,
      );

      // Filter by platform if specified
      const filteredMembers = platform
        ? teamMembers.filter(
            (member) =>
              (platform === "discord" && member.discordName) ||
              (platform === "telegram" && member.tgName),
          )
        : teamMembers;

      // Format the response
      return filteredMembers.map((member) => ({
        username: member.discordName || member.tgName || "Unknown",
        section: member.section || "Unassigned",
        platform: member.discordName
          ? "discord"
          : member.tgName
            ? "telegram"
            : "unknown",
        updatesFormat: member.updatesFormat || [],
      }));
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(
        `Error fetching team members for server ${serverId}: ${toErrorMessage(error)}`,
      );
      logger.error(`Error stack: ${err.stack}`);
      return [];
    }
  }

  // biome-ignore lint/complexity/noUselessLoneBlockStatements: <explanation>
  public async checkInServiceJob(): Promise<void> {
    if (this.isJobRunning) {
      logger.info(
        "Check-in service job already running, skipping this execution",
      );
      return;
    }

    this.isJobRunning = true;
    try {
      logger.info("Running check-in service job");
      const discordResult = getDiscordClient(this.runtime);
      const telegramResult = getTelegramBot(this.runtime);

      if (discordResult.ok) {
        logger.info("Discord service now available, connecting client");
        this.client = discordResult.client as Client;
      }

      if (telegramResult.ok) {
        logger.info("Telegram service found, client available");
        this.telegramBot = telegramResult.client;
      }

      // Dummy function for check-in service
      if (this.client) {
        logger.info("Discord client is available for check-in service");
        // Fetch all check-in schedules
        logger.info("Fetching all check-in schedules...");
        try {
          const checkInSchedules = await fetchCheckInSchedules(this.runtime);
          logger.info(
            `Successfully fetched ${checkInSchedules.length} check-in schedules`,
          );

          // Get current time in UTC
          const now = new Date();
          const currentHour = now.getUTCHours();
          const currentMinute = now.getUTCMinutes();
          const currentDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
          logger.info(
            `Current UTC time: ${currentHour}:${currentMinute}, day: ${currentDay}`,
          );

          // Filter schedules that match the current time and haven't been updated in the last day
          const matchingSchedules = checkInSchedules.filter((scheduleBase) => {
            // Cast to extended type with lastUpdated
            const schedule = scheduleBase as ExtendedCheckInSchedule;

            // Check if the schedule has a lastUpdated date and if it's at least one day old
            const lastUpdated = schedule.lastUpdated
              ? new Date(schedule.lastUpdated)
              : null;
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const shouldRunBasedOnLastUpdate =
              !lastUpdated || lastUpdated <= oneDayAgo;

            logger.debug(
              `Schedule ${schedule.scheduleId} last updated: ${lastUpdated ? lastUpdated.toISOString() : "never"}, should run: ${shouldRunBasedOnLastUpdate}`,
            );

            if (!shouldRunBasedOnLastUpdate) {
              logger.info(
                `Skipping schedule ${schedule.scheduleId} as it was updated less than a day ago`,
              );
              return false;
            }

            // Parse the checkInTime (format: "HH:MM")
            const [scheduleHour, scheduleMinute] = schedule.checkInTime
              .split(":")
              .map(Number);
            logger.debug(
              `Schedule time: ${scheduleHour}:${scheduleMinute} for schedule ID: ${schedule.scheduleId}`,
            );

            // Check if current time matches schedule time (with 30 minute tolerance)
            const scheduleTimeInMinutes = scheduleHour * 60 + scheduleMinute;
            const currentTimeInMinutes = currentHour * 60 + currentMinute;
            const timeDifferenceInMinutes = Math.abs(
              currentTimeInMinutes - scheduleTimeInMinutes,
            );

            // Check if within 30 minutes (accounting for day boundaries)
            const timeMatches =
              timeDifferenceInMinutes <= 30 ||
              timeDifferenceInMinutes >= 24 * 60 - 30;

            logger.info(
              `Time comparison for schedule ${schedule.scheduleId}: Current=${currentTimeInMinutes} min, Schedule=${scheduleTimeInMinutes} min, Diff=${timeDifferenceInMinutes} min, Matches=${timeMatches}`,
            );

            // Check frequency
            let frequencyMatches = false;
            switch (schedule.frequency) {
              case "DAILY":
                frequencyMatches = true;
                break;
              case "WEEKDAYS":
                // Check if current day is Monday-Friday (1-5)
                frequencyMatches = currentDay >= 1 && currentDay <= 5;
                break;
              case "WEEKLY":
                // For simplicity, assume weekly is on Monday
                frequencyMatches = currentDay === 1;
                break;
              case "BIWEEKLY": {
                // For simplicity, assume biweekly is on every other Monday
                // We can use the week number of the year to determine if it's an odd or even week
                const weekNumber = Math.floor(
                  (now.getTime() -
                    new Date(now.getUTCFullYear(), 0, 1).getTime()) /
                    (7 * 24 * 60 * 60 * 1000),
                );
                frequencyMatches = currentDay === 1 && weekNumber % 2 === 0;
                break;
              }
              case "MONTHLY":
                // For simplicity, assume monthly is on the 1st of the month
                frequencyMatches = now.getUTCDate() === 1;
                break;
              default:
                frequencyMatches = true; // Default to true for unknown frequencies
            }

            logger.info(
              `Frequency check for schedule ${schedule.scheduleId}: Type=${schedule.frequency}, Matches=${frequencyMatches}`,
            );

            return (
              timeMatches && frequencyMatches && shouldRunBasedOnLastUpdate
            );
          });

          logger.info(
            `Found ${matchingSchedules.length} schedules matching current time, frequency, and update criteria`,
          );
          if (matchingSchedules.length > 0) {
            logger.info(
              `Matching schedules: ${JSON.stringify(matchingSchedules, null, 2)}`,
            );

            // Process each matching schedule to fetch users and send check-in requests
            for (const schedule of matchingSchedules) {
              try {
                logger.info(
                  `Processing check-in schedule: ${schedule.scheduleId} for channel: ${schedule.channelId}`,
                );

                logger.info(`Schedule source: ${schedule.source}`);

                let serverName;

                if (this.client) {
                  logger.info("Discord service client is available");

                  for (const [, guild] of this.client.guilds.cache) {
                    const channels = await guild.channels.fetch();
                    const channel = channels.find((ch) => {
                      return (
                        ch &&
                        typeof ch === "object" &&
                        "id" in ch &&
                        ch.id === schedule.channelId
                      );
                    });

                    if (channel) {
                      serverName = guild.name;
                      logger.info(`Found channel in server: ${serverName}`);
                      break;
                    }
                  }
                } else {
                  logger.info("Discord service or client not available");
                }

                // Check if source is Telegram
                if (schedule?.source === "telegram") {
                  logger.info(
                    `Telegram source detected for schedule ${schedule.scheduleId}`,
                  );

                  if (!this.telegramBot?.telegram) {
                    continue;
                  }

                  const serverId = schedule.serverId || "";
                  if (!serverId) {
                    logger.warn(
                      `Schedule ${schedule.scheduleId} has no serverId, skipping`,
                    );
                    continue;
                  }

                  logger.info(
                    `Preparing to send update request to Telegram group ${serverId}`,
                  );

                  // Get team members for this server
                  const teamMembers = await this.getTeamMembers(
                    serverId,
                    "telegram",
                  );
                  logger.info(
                    `Found ${teamMembers.length} team members for Telegram server ${serverId}`,
                  );

                  // Create mentions for team members
                  let mentions = "";
                  if (teamMembers.length > 0) {
                    mentions = "Tagging team members: ";
                    for (const member of teamMembers) {
                      if (member.username) {
                        mentions += `${member.username} `;
                      }
                    }
                    mentions += "\n\n";
                  }
                  const updateRequestMessage =
                    `📢 *Team Update Request*\n\n${mentions}Hello team! I need your updates for this check-in.\n\n` +
                    `*Check-in Type*: ${schedule.checkInType}\n\n` +
                    `Please send me a direct message with your updates. To get started, message me with "Can you share the format for updates?" and I will provide you with the template.\n\n`;

                  await this.telegramBot.telegram.sendMessage(
                    serverId,
                    updateRequestMessage,
                    {
                      parse_mode: "Markdown",
                    },
                  );
                  logger.info(
                    `Sent formatted update request to Telegram group ${serverId} with ${teamMembers.length} tagged members`,
                  );

                  logger.info(
                    `Successfully sent group check-in message to Telegram channel ${schedule.channelId}`,
                  );
                } else {
                  // For Discord or other sources, continue with the original flow
                  // Get team members for this server from memory instead of all channel users
                  const serverId = schedule.serverId || "";
                  if (!serverId) {
                    logger.warn(
                      `Schedule ${schedule.scheduleId} has no serverId, skipping`,
                    );
                    continue;
                  }

                  const teamMembers = await this.getTeamMembers(
                    serverId,
                    "discord",
                  );

                  logger.info(
                    `Found ${teamMembers.length} team members for Discord server ${serverId}`,
                  );

                  if (teamMembers.length === 0) {
                    logger.warn(
                      `No team members found for server ${serverId} (${serverName}) for schedule ${schedule.scheduleId}`,
                    );
                    continue;
                  }

                  // Fetch users in the channel
                  const channelUsers = await this.fetchUsersInChannel(
                    schedule.channelId,
                  );
                  logger.info(
                    `Fetched ${channelUsers.length} users from channel ${schedule.channelId}`,
                  );

                  // Match channel users with team members
                  this.usersToMessage = [];
                  for (const teamMember of teamMembers) {
                    // Extract username from discordName (after @)
                    const discordUsername = teamMember.username?.startsWith("@")
                      ? teamMember.username.substring(1)
                      : teamMember.username;

                    if (!discordUsername) {
                      logger.warn(
                        `Team member in section ${teamMember.section} has no Discord username`,
                      );
                      continue;
                    }

                    // Find matching user in channel
                    const matchingUser = channelUsers.find(
                      (user) =>
                        user.username === discordUsername ||
                        user.displayName === discordUsername,
                    );

                    if (matchingUser) {
                      // Log the custom update format if available
                      if (
                        teamMember.updatesFormat &&
                        teamMember.updatesFormat.length > 0
                      ) {
                        logger.info(
                          `Team member ${discordUsername} has custom update format: ${JSON.stringify(
                            teamMember.updatesFormat,
                          )}`,
                        );
                      } else {
                        logger.debug(
                          `Team member ${discordUsername} using default update format`,
                        );
                      }

                      this.usersToMessage.push({
                        ...matchingUser,
                        updatesFormat: teamMember.updatesFormat,
                      });

                      logger.info(
                        `Matched team member ${discordUsername} with channel user ${matchingUser.displayName}`,
                      );
                    } else {
                      logger.warn(
                        `Could not find channel user matching team member ${discordUsername}`,
                      );
                    }
                  }

                  logger.info(
                    `Sending messages to ${this.usersToMessage.length} matched users`,
                  );

                  // Send messages to matched users
                  if (this.usersToMessage.length > 0) {
                    const successfullyMessaged = await this.messageAllUsers(
                      this.usersToMessage,
                      schedule,
                      serverName,
                    );

                    logger.info(
                      `Successfully sent messages to ${successfullyMessaged.length} users`,
                    );
                  } else {
                    logger.warn(
                      `No matching users found to message for server ${serverId}`,
                    );
                  }
                }

                // Update the last updated date for the schedule
                try {
                  // Create a unique room ID for check-in schedules
                  const checkInSchedulesRoomId = getCheckInSchedulesRoomId(
                    this.runtime,
                  );
                  logger.info(
                    `Updating last updated date for schedule ${schedule.scheduleId}`,
                  );

                  // Get memories from the check-in schedules room
                  const memories = await this.runtime.getMemories({
                    roomId: checkInSchedulesRoomId,
                    tableName: "messages",
                  });

                  // Find the memory containing this schedule
                  const scheduleMemory = filterCheckInScheduleMemories(
                    memories as CoordinatorMemory[],
                  ).find((memory) => {
                    const memSchedule = getCoordinatorSchedule(memory);
                    return (
                      getCoordinatorString(memSchedule, "scheduleId") ===
                      schedule.scheduleId
                    );
                  });

                  const scheduleMemoryId =
                    getCoordinatorMemoryId(scheduleMemory);
                  const scheduleMemoryRoomId =
                    getCoordinatorRoomId(scheduleMemory);

                  if (
                    scheduleMemory &&
                    scheduleMemoryId &&
                    scheduleMemoryRoomId
                  ) {
                    // Update the last updated date
                    const scheduleContent =
                      getCoordinatorSchedule(scheduleMemory) || {};
                    const updatedSchedule = {
                      ...scheduleContent,
                      lastUpdated: Date.now(),
                    };

                    // Update the memory with the new schedule
                    const updatedMemory: Partial<Memory> & { id: UUID } = {
                      ...(scheduleMemory as Partial<Memory>),
                      id: scheduleMemoryId,
                      roomId: scheduleMemoryRoomId,
                      content: {
                        ...(scheduleMemory.content ?? {}),
                        schedule: updatedSchedule,
                      },
                    };

                    await this.runtime.updateMemory(updatedMemory);
                    logger.info(
                      `Successfully updated last updated date for schedule ${schedule.scheduleId}`,
                    );
                  } else {
                    logger.warn(
                      `Could not find memory for schedule ${schedule.scheduleId} to update last updated date`,
                    );
                  }
                } catch (updateError: unknown) {
                  logger.error(
                    `Error updating last updated date for schedule ${schedule.scheduleId}: ${toErrorMessage(updateError)}`,
                  );
                }
              } catch (error: unknown) {
                logger.error(
                  `Error processing schedule ${schedule.scheduleId}: ${toErrorMessage(error)}`,
                );
              }
            }
          }
        } catch (error: unknown) {
          const err = error as Error;
          logger.error(
            `Failed to fetch or process check-in schedules: ${toErrorMessage(error)}`,
          );
          logger.error(`Error stack: ${err.stack}`);
        }
      } else {
        logger.warn("Discord client not available for check-in service");
      }
    } finally {
      this.isJobRunning = false;
    }
  }

  async stop(): Promise<void> {
    logger.info("Stopping Discord Channel Service");
  }
}

// Static start method required for service registration
TeamUpdateTrackerService.start = async (
  runtime: IAgentRuntime,
): Promise<Service> => {
  const service = new TeamUpdateTrackerService(runtime);
  await service.start();
  return service;
};
