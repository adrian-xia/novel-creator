export const fakePlatformAdapter = {
  validateConfig(config: { targetPlatform: string }) {
    return Boolean(config.targetPlatform);
  },
  async publishChapter(input: {
    targetPlatform: string;
    chapterNumber: number;
    payload: Record<string, unknown>;
  }) {
    return {
      status: 'published' as const,
      remoteId: `${input.targetPlatform}-chapter-${input.chapterNumber}`,
      payload: input.payload
    };
  },
  async getPublishStatus(input: { remoteId: string }) {
    return {
      remoteId: input.remoteId,
      status: 'published' as const
    };
  }
};
