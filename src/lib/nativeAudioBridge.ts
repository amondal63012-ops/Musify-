import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { isNativeAndroid } from './apiConfig';

export interface NativePlayTrackOptions {
  url: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  isHls?: boolean;
}

export interface NativePlaybackStateEvent {
  isPlaying: boolean;
  isBuffering: boolean;
  durationSec: number;
  positionSec: number;
}

export interface NativePlaybackProgressEvent {
  positionSec: number;
  durationSec: number;
}

export interface NativePlaybackErrorEvent {
  message: string;
}

export interface NativeHttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface NativeHttpResponse {
  status: number;
  body: string;
  finalUrl: string;
}

export interface AuraMedia3Plugin {
  playTrack(options: NativePlayTrackOptions): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seekTo(options: { positionSec: number }): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  stop(): Promise<void>;
  getPlaybackState(): Promise<NativePlaybackStateEvent>;
  httpRequest(options: NativeHttpRequestOptions): Promise<NativeHttpResponse>;
  addListener(
    eventName: 'playbackState',
    listenerFunc: (event: NativePlaybackStateEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackProgress',
    listenerFunc: (event: NativePlaybackProgressEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackEnded',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackNext',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackPrev',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackError',
    listenerFunc: (event: NativePlaybackErrorEvent) => void
  ): Promise<PluginListenerHandle>;
}

export const AuraMedia3 = registerPlugin<AuraMedia3Plugin>('AuraMedia3');

export function canUseNativeMedia3(streamUrl?: string | null): boolean {
  if (!isNativeAndroid() || !streamUrl) return false;
  return !streamUrl.startsWith('blob:') && !streamUrl.startsWith('data:');
}
