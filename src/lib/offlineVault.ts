import { Track } from '../types';
import { resolveApiUrl } from './apiConfig';

const DB_NAME = 'aura_offline_vault';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

interface StoredVaultRecord {
  id: string;
  track: Track;
  blob: Blob;
  savedAt: number;
  mimeType: string;
}

const activeObjectUrlCache = new Map<string, string>();

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open offline vault'));
  });
}

export function canSaveTrackOffline(track: Track | null | undefined): boolean {
  if (!track?.streamUrl) return false;
  if (track.source === 'local') return true;
  const url = track.streamUrl;
  // Direct progressive MP3 / M4A / AAC streams can be stored in IndexedDB directly.
  // HLS (.m3u8) playlists contain segmented chunks and cannot be cached via single Blob fetch.
  if (url.includes('.m3u8') || url.includes('proto=hls')) return false;
  return true;
}

export async function getOfflineTracks(): Promise<Track[]> {
  try {
    const db = await openVaultDB();
    return await new Promise<Track[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []) as StoredVaultRecord[];
        records.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        resolve(
          records.map((r) => ({
            ...r.track,
            isOfflineSaved: true,
            addedAt: r.savedAt,
          }))
        );
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load offline tracks:', err);
    return [];
  }
}

export async function resolveOfflineAudioUrl(trackId: string): Promise<string | null> {
  if (!trackId) return null;
  const cached = activeObjectUrlCache.get(trackId);
  if (cached) return cached;

  try {
    const db = await openVaultDB();
    const record = await new Promise<StoredVaultRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackId);
      req.onsuccess = () => resolve(req.result as StoredVaultRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!record?.blob) return null;
    const objectUrl = URL.createObjectURL(record.blob);
    activeObjectUrlCache.set(trackId, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

export async function saveTrackForOffline(track: Track): Promise<Track> {
  if (!track.streamUrl) {
    throw new Error('Track has no downloadable audio stream');
  }
  if (!canSaveTrackOffline(track)) {
    throw new Error('Segmented HLS streams cannot be saved offline; choose a 320k direct MP3/MP4 track');
  }

  const res = await fetch(resolveApiUrl(track.streamUrl));
  if (!res.ok) {
    throw new Error(`Failed to download audio (${res.status})`);
  }
  const blob = await res.blob();
  if (!blob || blob.size < 16384) {
    throw new Error('Downloaded audio stream was empty or incomplete');
  }

  const savedAt = Date.now();
  const savedTrack: Track = {
    ...track,
    isOfflineSaved: true,
    addedAt: savedAt,
  };

  const db = await openVaultDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({
      id: savedTrack.id,
      track: savedTrack,
      blob,
      savedAt,
      mimeType: blob.type || 'audio/mpeg',
    } satisfies StoredVaultRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const existingUrl = activeObjectUrlCache.get(savedTrack.id);
  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
  }
  activeObjectUrlCache.set(savedTrack.id, URL.createObjectURL(blob));

  return savedTrack;
}

function readAudioDurationMs(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const tempUrl = URL.createObjectURL(file);
      const audio = new Audio();
      const cleanup = (ms: number) => {
        URL.revokeObjectURL(tempUrl);
        resolve(ms);
      };
      const timer = setTimeout(() => cleanup(0), 2500);
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        const dur = Number(audio.duration);
        cleanup(dur && isFinite(dur) ? Math.round(dur * 1000) : 0);
      };
      audio.onerror = () => {
        clearTimeout(timer);
        cleanup(0);
      };
      audio.src = tempUrl;
    } catch {
      resolve(0);
    }
  });
}

function parseFilenameMetadata(filename: string): { title: string; artist: string } {
  const withoutExt = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();
  const dashSplit = withoutExt.split(/\s+[-–]\s+/);
  if (dashSplit.length >= 2) {
    return {
      artist: dashSplit[0].trim() || 'Local Library',
      title: dashSplit.slice(1).join(' - ').trim() || withoutExt,
    };
  }
  return {
    artist: 'Local Audio File',
    title: withoutExt || 'Untitled Audio',
  };
}

export async function importLocalAudioFiles(files: FileList | File[]): Promise<Track[]> {
  const fileArray = Array.from(files).filter(
    (f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|flac|wav|ogg|opus)$/i.test(f.name)
  );
  if (fileArray.length === 0) return [];

  const db = await openVaultDB();
  const imported: Track[] = [];

  for (const file of fileArray) {
    const durationMs = await readAudioDurationMs(file);
    const { title, artist } = parseFilenameMetadata(file.name);
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const blobUrl = URL.createObjectURL(file);
    activeObjectUrlCache.set(id, blobUrl);

    const savedAt = Date.now();
    const track: Track = {
      id,
      title,
      artist,
      album: 'Local Audio Vault',
      label: 'Local Device File',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
      streamUrl: blobUrl,
      previewUrl: blobUrl,
      duration: durationMs,
      source: 'local',
      isOfflineSaved: true,
      addedAt: savedAt,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id,
        track,
        blob: file,
        savedAt,
        mimeType: file.type || 'audio/mpeg',
      } satisfies StoredVaultRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    imported.push(track);
  }

  return imported;
}

export async function removeOfflineTrack(trackId: string): Promise<void> {
  const cached = activeObjectUrlCache.get(trackId);
  if (cached) {
    URL.revokeObjectURL(cached);
    activeObjectUrlCache.delete(trackId);
  }
  const db = await openVaultDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(trackId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
