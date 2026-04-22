import { addHeader } from "@elizaos/core";
import type { Provider } from "@elizaos/core";

/**
 * Provider that produces a prompt to help the agent decide if someone should be timed out.
 * It does not analyze history directly — another provider must supply the conversation context.
 * This provider simply provides a high-level prompt instructing the agent to take the TIMEOUT_USER action if needed.
 */
export const timeoutUserProvider: Provider = {
  name: "TIMEOUT_USER_CONTEXT",
  description:
    "Prompt to decide if someone in the conversation should be timed out.",
  get: async () => {
    const instruction = `Review the conversation carefully.

If any user is:
- Spreading FUD
- Being toxic or disrespectful
- Using violent, hateful, or abusive language
- Clearly violating community guidelines

Then consider the TIMEOUT_USER action only when an immediate manual moderation action is needed.

For Telegram group automation, prefer the Telegram moderation evaluator because it applies configured warnings, mute escalation, dry-run mode, and audit logging through the policy runner.
`;

    return {
      data: {},
      values: {
        moderation: addHeader("# Timeout Decision Instructions", instruction),
      },
      text: addHeader("# Timeout Decision Instructions", instruction),
    };
  },
};
