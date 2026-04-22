import { ModelType, type IAgentRuntime } from "@elizaos/core";
import type {
  ModerationCategory,
  ModerationClassification,
  ModerationMessage,
  ModerationSeverity,
} from "./types";

const CATEGORIES = new Set(["spam", "toxic", "fud", "fomo", "safe"]);
const SEVERITIES = new Set(["low", "medium", "high"]);

export function parseLlmModerationClassification(
  raw: string,
): ModerationClassification {
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  const json = jsonMatch ? jsonMatch[1] : raw;

  try {
    const parsed = JSON.parse(json.trim());
    const category = CATEGORIES.has(parsed.category) ? parsed.category : "safe";
    const severity = SEVERITIES.has(parsed.severity) ? parsed.severity : "low";
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0;

    return {
      category: category as ModerationCategory | "safe",
      severity: severity as ModerationSeverity,
      confidence,
      reason:
        typeof parsed.reason === "string"
          ? parsed.reason
          : "Model did not provide a usable reason.",
      signals: Array.isArray(parsed.signals)
        ? parsed.signals.filter((signal: unknown) => typeof signal === "string")
        : [],
    };
  } catch {
    return {
      category: "safe",
      severity: "low",
      confidence: 0,
      reason: "Model output was not valid JSON.",
      signals: ["invalid_model_output"],
    };
  }
}

export async function classifyMessageWithLlm(
  runtime: IAgentRuntime,
  message: ModerationMessage,
): Promise<ModerationClassification> {
  const prompt = `Classify this Telegram community message.

Categories:
- spam: repeated junk, phishing, scam links, excessive promotion
- toxic: personal attacks, abuse, hateful language, harassment
- fud: unsubstantiated fear, panic, or damaging claims
- fomo: aggressive pump language, buy-now pressure, hype spam
- safe: normal community discussion

Return only JSON:
{"category":"spam|toxic|fud|fomo|safe","severity":"low|medium|high","confidence":0.0,"reason":"short reason","signals":["signal"]}

Message from ${message.displayName}:
${message.text}`;

  const response = await runtime.useModel(ModelType.TEXT_LARGE, { prompt });
  return parseLlmModerationClassification(String(response));
}
