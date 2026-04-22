export type ModerationMuteOptions = {
  durationSeconds?: number;
  permanent?: boolean;
};

export type ModerationEnforcementPort = {
  warn(channelId: string, text: string): Promise<void>;
  mute(
    channelId: string,
    userId: string,
    options: ModerationMuteOptions,
  ): Promise<void>;
};
