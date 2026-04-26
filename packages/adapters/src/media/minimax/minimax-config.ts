export const DEFAULT_MINIMAX_MEDIA_BASE_URL = 'https://api.minimaxi.com/v1';
export const DEFAULT_MINIMAX_SPEECH_MODEL = 'speech-02-hd';
export const DEFAULT_MINIMAX_IMAGE_MODEL = 'image-01';
export const DEFAULT_MINIMAX_VIDEO_MODEL = 'video-01';

export interface MiniMaxMediaConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly speechModel?: string;
  readonly imageModel?: string;
  readonly videoModel?: string;
  readonly musicModel?: string;
}

export function resolveMiniMaxSpeechModel(config: MiniMaxMediaConfig): string {
  return config.speechModel ?? DEFAULT_MINIMAX_SPEECH_MODEL;
}

export function resolveMiniMaxImageModel(config: MiniMaxMediaConfig): string {
  return config.imageModel ?? DEFAULT_MINIMAX_IMAGE_MODEL;
}

export function resolveMiniMaxVideoModel(config: MiniMaxMediaConfig): string {
  return config.videoModel ?? DEFAULT_MINIMAX_VIDEO_MODEL;
}

export function resolveMiniMaxMusicModel(config: MiniMaxMediaConfig): string | undefined {
  return config.musicModel;
}
