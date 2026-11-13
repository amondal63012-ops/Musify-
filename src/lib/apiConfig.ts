import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
}

export function isNativeAndroid(): boolean {
  return isNativeApp() && Capacitor.getPlatform() === 'android';
}

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined') {
    const saved = (localStorage.getItem('aura_api_base_url') || '').trim().replace(/\/+$/, '');
    if (saved) return saved;
  }
  return '';
}

export function resolveApiUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (
    pathOrUrl.startsWith('http://') ||
    pathOrUrl.startsWith('https://') ||
    pathOrUrl.startsWith('blob:') ||
    pathOrUrl.startsWith('data:')
  ) {
    return pathOrUrl;
  }
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export async function tryFetchBackendJson<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T | null> {
  const baseUrl = getApiBaseUrl();
  if (isNativeAndroid() && !baseUrl) {
    return null;
  }
  try {
    const res = await fetch(resolveApiUrl(path), {
      ...init,
      signal: init?.signal || AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
