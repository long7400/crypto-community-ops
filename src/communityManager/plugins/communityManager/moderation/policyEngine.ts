import type {
  CommunityModerationSettings,
  ModerationClassification,
  ModerationDecision,
  ModerationSeverity,
  ViolationState,
} from "./types";

const SEVERITY_RANK: Record<ModerationSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function decideModerationAction(
  settings: CommunityModerationSettings,
  classification: ModerationClassification,
  violationState: ViolationState,
): ModerationDecision {
  const resetCutoff =
    Date.now() - settings.moderation.resetAfterDays * 24 * 60 * 60 * 1000;
  const activeCount =
    violationState.lastViolationAt > resetCutoff ? violationState.count : 0;

  if (!settings.moderation.enabled || classification.category === "safe") {
    return baseDecision(settings, classification, "skip", activeCount);
  }

  const categorySettings =
    settings.moderation.categories[classification.category];
  if (!categorySettings.enabled) {
    return baseDecision(settings, classification, "skip", activeCount);
  }

  if (classification.confidence < categorySettings.minConfidence) {
    return baseDecision(settings, classification, "skip", activeCount);
  }

  if (
    SEVERITY_RANK[classification.severity] <
    SEVERITY_RANK[categorySettings.minSeverity]
  ) {
    return baseDecision(settings, classification, "skip", activeCount);
  }

  const offenseCount = activeCount + 1;
  const ladderStep =
    settings.moderation.ladder.find((step) => step.offense === offenseCount) ??
    settings.moderation.ladder[settings.moderation.ladder.length - 1];

  return {
    ...baseDecision(settings, classification, ladderStep.action, offenseCount),
    durationSeconds: ladderStep.durationSeconds,
    permanent: ladderStep.permanent,
  };
}

function baseDecision(
  settings: CommunityModerationSettings,
  classification: ModerationClassification,
  action: ModerationDecision["action"],
  offenseCount: number,
): ModerationDecision {
  return {
    action,
    category: classification.category,
    severity: classification.severity,
    confidence: classification.confidence,
    reason: classification.reason,
    offenseCount,
    dryRun: settings.dryRun,
  };
}
