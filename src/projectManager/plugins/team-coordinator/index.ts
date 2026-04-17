// biome-ignore lint/style/useImportType: <explanation>
import type { IAgentRuntime, Plugin } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { recordCheckInAction } from "./actions/checkInCreate";
import { listCheckInSchedules } from "./actions/checkInList";
import { generateReport } from "./actions/reportGenerate";
import { addTeamMemberAction } from "./actions/teamMemberAdd";
import { listTeamMembersAction } from "./actions/teamMembersList";
import { teamMemberUpdatesAction } from "./actions/teamMemberUpdate";
import { updatesFormatAction } from "./actions/updateFormat";
import { bootstrapTeamCoordinator } from "./bootstrap";
import { toErrorMessage } from "./logging";
// import { checkInFormatAction } from './actions/checkInFormatAction';
import { CheckInService } from "./services/CheckInService";
import { TeamUpdateTrackerService } from "./services/updateTracker";

/**
 * Plugin for team coordination functionality
 * Handles team member management, availability tracking, and check-ins
 */
export const teamCoordinatorPlugin: Plugin = {
  name: "team-coordinator",
  description: "Team Coordinator plugin for managing team activities",
  providers: [],
  actions: [
    // checkInFormatAction,
    teamMemberUpdatesAction,
    listCheckInSchedules,
    generateReport,
    recordCheckInAction,
    addTeamMemberAction,
    listTeamMembersAction,
    updatesFormatAction,
  ],
  init: async (config: Record<string, string>, runtime: IAgentRuntime) => {
    try {
      logger.info("Initializing Team Coordinator plugin...");

      await bootstrapTeamCoordinator(runtime, {
        services: [TeamUpdateTrackerService],
      });

      logger.info("Team Coordinator plugin initialized successfully");
    } catch (error) {
      logger.error(
        `Failed to initialize Team Coordinator plugin: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  },
  // List services that should be registered by the runtime
  services: [TeamUpdateTrackerService, CheckInService],
};

export function initialize(runtime: IAgentRuntime) {
  // Initialize services
  new CheckInService(runtime);
  // new ScheduleService(runtime);

  // Return actions
  return {
    actions: [
      // checkInFormatAction,
      recordCheckInAction,
      teamMemberUpdatesAction,
      listCheckInSchedules,
      generateReport,
      addTeamMemberAction,
      listTeamMembersAction,
      updatesFormatAction,
    ],
  };
}

export default {
  initialize,
};
