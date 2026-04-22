import type { Plugin } from "@elizaos/core";
import { CommunityManagerService } from "./communityService";
import { telegramModerationEvaluator } from "./moderation/telegramModerationEvaluator";
import { timeoutUserProvider } from "./providers/timeout";
import timeoutUser from "./actions/timeout";

export const communityManagerPlugin: Plugin = {
  name: "community-manager",
  description: "Community Manager Plugin for Eliza",
  evaluators: [telegramModerationEvaluator],
  providers: [timeoutUserProvider],
  actions: [timeoutUser],
  services: [CommunityManagerService],
};

export default communityManagerPlugin;
