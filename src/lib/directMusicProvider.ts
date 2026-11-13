import CryptoJS from 'crypto-js';
import { Artist, Track } from '../types';
import { isNativeAndroid } from './apiConfig';
import { AuraMedia3 } from './nativeAudioBridge';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';

const SAAVN_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'X-Forwarded-For': '49.36.120.10',
};

interface HttpResult {
  status: number;
  body: string;
  finalUrl: string;
}

async function nativeAwareFetchText(
  url: string,
  options: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string; timeoutMs?: number } = {}
): Promise<HttpResult | null> {
  if (isNativeAndroid()) {
    try {
      return await AuraMedia3.httpRequest({
        url,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        timeoutMs: options.timeoutMs || 8000,
      });
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      signal: AbortSignal.timeout(options.timeoutMs || 7000),
    });
    const body = await res.text();
    return { status: res.status, body, finalUrl: res.url || url };
  } catch {
    return null;
  }
}

async function fetchJson(
  url: string,
  options: { method?: 'GET' | 'POST'; headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<any> {
  const res = await nativeAwareFetchText(url, options);
  if (!res || res.status < 200 || res.status >= 300 || !res.body) return null;
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

function cleanText(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function getHighResImage(url: string): string {
  if (!url) return '';
  return url.replace('150x150.jpg', '500x500.jpg').replace('50x50.jpg', '500x500.jpg');
}

function decryptSaavnMediaUrl(encryptedMediaUrl?: string): string | null {
  if (!encryptedMediaUrl) return null;
  try {
    const key = CryptoJS.enc.Utf8.parse('38346591');
    const decrypted = CryptoJS.DES.decrypt(encryptedMediaUrl, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    const decryptedUrl = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedUrl) return null;
    return decryptedUrl
      .replace(/_96\.mp4|_48\.mp4|_160\.mp4/, '_320.mp4')
      .replace(/_96\.mp3|_48\.mp3|_160\.mp3/, '_320.mp3');
  } catch {
    return null;
  }
}

function normalizeMatchText(str: string): string {
  return cleanText(str || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(feat\.?|ft\.?|featuring|with)\b.*$/i, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitArtistEntities(artistStr: string): string[] {
  return cleanText(artistStr || '')
    .split(/[,&/+×]|(?:\s+(?:feat\.?|ft\.?|featuring|with|vs\.?|x)\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleHasArtistCredit(title: string, targetArtist: string): boolean {
  const tClean = cleanText(title || '').toLowerCase();
  const target = cleanText(targetArtist || '').toLowerCase();
  if (!tClean || !target) return false;
  const esc = escapeRegExp(target);
  return [
    new RegExp(`^${esc}(?:\\s*[,&x×]|\\s*-|\\s+feat\\.?|\\s+ft\\.?|\\s+with\\b)`),
    new RegExp(`(?:[,&x×]\\s*|\\b(?:feat\\.?|ft\\.?|featuring|with)\\s+)${esc}(?:\\b|\\s*[-)\\]])`),
  ].some((rx) => rx.test(tClean));
}

function artistMatchesTarget(
  trackArtist: string,
  targetArtist: string,
  trackTitle: string = '',
  allowTitleCollab: boolean = false
): boolean {
  const targetClean = cleanText(targetArtist || '').toLowerCase();
  const targetCompact = targetClean.replace(/[^a-z0-9]/g, '');
  const targetSpaced = targetClean.replace(/[^a-z0-9]+/g, ' ').trim();
  if (!targetCompact) return false;

  if (trackArtist) {
    for (const ent of splitArtistEntities(trackArtist)) {
      const entLower = ent.toLowerCase();
      if (
        entLower.replace(/[^a-z0-9]/g, '') === targetCompact ||
        entLower.replace(/[^a-z0-9]+/g, ' ').trim() === targetSpaced
      ) {
        return true;
      }
    }
  }
  if (allowTitleCollab && trackTitle) {
    return titleHasArtistCredit(trackTitle, targetArtist);
  }
  return false;
}

const OFFICIAL_MAJOR_PUBLISHERS = [
  't-series', 'tseries', 'sony music', 'universal music', 'warner music', 'atlantic records',
  'republic records', 'interscope', 'columbia records', 'def jam', 'capitol records', 'rca records',
  'island records', 'virgin records', 'polydor', 'parlophone', 'elektra', 'epic records', 'arista',
  'zee music', 'yrf', 'yash raj', 'saregama', 'tips', 'speed records', 'white hill', 'desi melodies',
  'mass appeal', 'times music', 'rehaan records', 'gully gang', 'kalamkaar', 'famous studios',
  'spinnin', 'monstercat', 'nocopyrightsounds', 'mer recordings', 'mer musikk', 'world of walker',
  'octobersveryown', 'ovo sound', 'owsla', 'mau5trap', 'stmpd', 'revealed recordings',
  'armada music', 'ultra records', 'xo records', 'roc nation', 'dreamville', 'bmg', 'believe music',
  'bighit', 'hybe', 'yg entertainment', 'sm entertainment', 'jyp entertainment',
];

function isMajorPublisherLabel(labelOrChannel: string): boolean {
  const low = cleanText(labelOrChannel || '').toLowerCase();
  return Boolean(low && OFFICIAL_MAJOR_PUBLISHERS.some((pub) => low.includes(pub)));
}

const FAMOUS_GLOBAL_ARTISTS = [
  'justin bieber', 'adele', 'eminem', 'taylor swift', 'billie eilish', 'sabrina carpenter',
  'drake', 'rihanna', 'coldplay', 'maroon 5', 'bruno mars', 'lady gaga', 'dua lipa',
  'the weeknd', 'sia', 'avicii', 'ed sheeran', 'ariana grande', 'katy perry', 'selena gomez',
  'charlie puth', 'shawn mendes', 'imagine dragons', 'alan walker', 'marshmello', 'martin garrix',
  'chainsmokers', 'post malone', 'travis scott', 'kendrick lamar', 'kanye west', 'beyonce', 'shakira',
  'karan aujla', 'diljit dosanjh', 'arijit singh', 'hanumankind', 'shubh', 'ap dhillon',
  'sidhu moose wala', 'badshah', 'yo yo honey singh', 'skrillex', 'deadmau5', 'bts', 'blackpink',
];

function isUnofficialOrRemix(
  title: string,
  artist: string = '',
  album: string = '',
  rawTitle: string = '',
  label: string = ''
): boolean {
  if (!title && !rawTitle) return true;
  const tCombined = `${title} ${rawTitle}`.toLowerCase();
  const aLower = (artist || '').toLowerCase();
  const albLower = (album || '').toLowerCase();
  const labLower = (label || '').toLowerCase();
  const fullText = `${tCombined} ${aLower} ${albLower} ${labLower}`;

  const badSubstrings = [
    'karaoke', '16-bit', '16 bit', '16bit', '8-bit', '8 bit', '8bit', 'soundalike',
    'tribute band', 'tribute project', 'backing track', 'lullaby', 'sleep therapy', 'deep sleep',
    'slowed', 'sped up', 'speed up', 'speedup', 'reverb', 'reverbed', 'bass boosted', 'nightcore',
    'tribute to', 'originally performed by', 'lofi', 'lo-fi', 'lo fi', 'piano cover', 'acoustic cover',
    'instrumental cover', 'instrumental version', 'mashup', 'mash up', 'megamix', 'mixtape',
    'nonstop', 'bootleg', 'chipmunk', 'chopped', 'screwed', '8d audio', '9d audio', '3d audio',
    'ringtone', 'phonk', 'parody', 'acapella', 'type beat', 'free beat', 'karaoke version',
    'djjohal', 'mr-jatt', 'pagalworld', 'pendujatt', 'songspk', '7clouds',
  ];
  if (badSubstrings.some((p) => fullText.includes(p))) return true;

  const titleRegexes = [
    /\bmix(?:es|ed)?\b/i,
    /\bremix(?:ed|es|ing)?\b/i,
    /\bremake(?:s)?\b/i,
    /\brmx\b/i,
    /\bpreview\b/i,
    /\bdj\b/i,
    /\bcover(?:s|ed)?\b/i,
    /\btribute\b/i,
    /\binstrumental\b/i,
    /\bacoustic\b/i,
    /\b(?:8d|9d|3d|16d|dnb)\b/i,
    /\bbgm\b/i,
    /\bextended\b/i,
  ];
  if (titleRegexes.some((rx) => rx.test(tCombined))) return true;
  if (/\b(?:dj|karaoke|lofi|lo-fi|tribute|cover|arcade|sleep|study|meditation|instrumental|8-bit|16-bit)\b/i.test(aLower)) {
    return true;
  }
  return false;
}

function hasUnauthorizedFamousAttribution(title: string, rawTitle: string, artist: string, label: string = ''): boolean {
  const combined = `${title} ${rawTitle}`.toLowerCase();
  if (!combined || isMajorPublisherLabel(label)) return false;
  for (const fa of FAMOUS_GLOBAL_ARTISTS) {
    const esc = escapeRegExp(fa);
    const rx = new RegExp(`(?:^|\\s-\\s*|\\bby\\s+|[,&×]\\s*)${esc}(?:\\s*-|\\s*$|\\s*\\(|\\s*\\[|[,&×])`, 'i');
    if (rx.test(combined) && !artistMatchesTarget(artist, fa) && !artistMatchesTarget(label, fa)) {
      return true;
    }
  }
  return false;
}

function isOfficialPublisherTrack(track: any, query: string = '', strictArtistTarget: string = ''): boolean {
  if (!track || !track.title) return false;
  if (isUnofficialOrRemix(track.title, track.artist, track.album, track.rawTitle || '', track.label || '')) {
    return false;
  }
  const dur = Number(track.duration) || 0;
  if (dur > 0 && (dur < 60000 || dur > 660000)) return false;
  if (hasUnauthorizedFamousAttribution(track.title || '', track.rawTitle || '', track.artist || '', track.label || '')) {
    return false;
  }
  const allowCollab = Boolean(track.allowTitleCollab);
  if (strictArtistTarget && !artistMatchesTarget(track.artist || '', strictArtistTarget, track.rawTitle || track.title || '', allowCollab)) {
    return false;
  }
  const qLower = query.toLowerCase().trim();
  if (qLower) {
    for (const fa of FAMOUS_GLOBAL_ARTISTS) {
      if (new RegExp(`\\b${escapeRegExp(fa)}\\b`, 'i').test(qLower) && !artistMatchesTarget(track.artist || '', fa, track.rawTitle || track.title || '', allowCollab)) {
        return false;
      }
    }
  }
  return true;
}

function cleanSongTitle(rawTitle: string, artistName: string = ''): string {
  let title = rawTitle
    .replace(/\[NCS Release\]/gi, '')
    .replace(/\(Official Audio\)|\(Official Lyric Video\)|\(Lyric Video\)|\(Official Video\)|\(Audio\)|\(Official Music Video\)|\(Lyrics\)/gi, '')
    .trim();
  if (title.includes(' - ')) {
    title = title.split(' - ').slice(1).join(' - ').trim();
  } else if (artistName && title.toLowerCase().startsWith(artistName.toLowerCase() + ' - ')) {
    title = title.substring(artistName.length + 3).trim();
  }
  return title.replace(/\(.*\)|\[.*\]/g, '').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim();
}

function mapJioSaavnSong(song: any): any {
  let streamUrl = decryptSaavnMediaUrl(song?.more_info?.encrypted_media_url);
  if (streamUrl && (song?.more_info?.['320kbps'] === 'false' || song?.more_info?.['320kbps'] === false)) {
    streamUrl = streamUrl.replace('_320.mp4', '_160.mp4').replace('_320.mp3', '_160.mp3');
  }
  const durationSec = Number(song?.more_info?.duration) || Number(song?.duration) || 0;
  const primaryArtists = song?.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ');
  const singers = song?.more_info?.singers;
  const subtitleArtist = song?.subtitle ? song.subtitle.split(' - ')[0] : '';
  const cleanArtist = cleanText(primaryArtists || singers || subtitleArtist || 'Unknown Artist');
  return {
    id: 'saavn_' + song.id,
    title: cleanText(song.title),
    artist: cleanArtist,
    album: cleanText(song.more_info?.album || song.album || 'Single'),
    label: cleanText(song.more_info?.label || ''),
    coverUrl: getHighResImage(song.image) || DEFAULT_COVER,
    streamUrl: streamUrl || '',
    previewUrl: streamUrl || '',
    duration: durationSec * 1000,
    source: 'jiosaavn',
  };
}

let cachedScClientId = 'qLcgHhXgeEFFaSolTB9I71LBsqncsD93';
let scClientIdFetchedAt = 0;

async function getSoundCloudClientId(): Promise<string> {
  const now = Date.now();
  if (cachedScClientId && now - scClientIdFetchedAt < 1000 * 60 * 60 * 6) {
    return cachedScClientId;
  }
  try {
    const htmlRes = await nativeAwareFetchText('https://soundcloud.com', { timeoutMs: 4500 });
    if (htmlRes && htmlRes.status === 200) {
      const scripts = [...htmlRes.body.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
      for (const scriptUrl of scripts.slice(-4)) {
        const sRes = await nativeAwareFetchText(scriptUrl, { timeoutMs: 3500 });
        const match = sRes?.body?.match(/client_id[:=]"([a-zA-Z0-9]{32})"/);
        if (match?.[1]) {
          cachedScClientId = match[1];
          scClientIdFetchedAt = now;
          return cachedScClientId;
        }
      }
    }
  } catch {}
  return cachedScClientId;
}

async function resolveSoundCloudTranscoding(transcodingUrl: string): Promise<string | null> {
  let cid = await getSoundCloudClientId();
  let json = await fetchJson(`${transcodingUrl}?client_id=${cid}`, { timeoutMs: 4500 });
  if (!json?.url) {
    scClientIdFetchedAt = 0;
    cid = await getSoundCloudClientId();
    json = await fetchJson(`${transcodingUrl}?client_id=${cid}`, { timeoutMs: 4500 });
  }
  return json?.url || null;
}

function mapSoundCloudTrackMeta(t: any, query: string = '', strictArtistTarget: string = ''): any | null {
  if (!t?.id || !t.title || t.policy === 'SNIP' || t.user?.verified !== true) return null;
  const durationMs = t.full_duration || t.duration || 0;
  const rawTitle = cleanText(t.title);
  const cleanT = rawTitle.replace(/\s*\[NCS Release\]/gi, '').trim() || rawTitle;
  const userChannel = cleanText(t.user?.username || '');
  const artistName = cleanText(t.publisher_metadata?.artist || '') || userChannel || 'Verified Artist';
  const labelName = cleanText(t.publisher_metadata?.publisher || t.label_name || userChannel);
  const albumName = cleanText(t.publisher_metadata?.album_title || t.label_name || 'Official Release');

  if (
    !isOfficialPublisherTrack(
      { title: cleanT, rawTitle, artist: artistName, album: albumName, label: labelName, duration: durationMs, allowTitleCollab: true },
      query,
      strictArtistTarget
    )
  ) {
    return null;
  }

  const validTranscodings = (t.media?.transcodings || []).filter((x: any) => !x.snipped && x.url);
  const trans =
    validTranscodings.find((x: any) => x.format?.protocol === 'progressive' && x.format?.mime_type?.includes('mpeg')) ||
    validTranscodings.find((x: any) => x.format?.protocol === 'hls' && (x.preset === 'aac_160k' || x.preset === 'aac_96k')) ||
    validTranscodings.find((x: any) => x.format?.protocol === 'hls' && (x.preset?.startsWith('mp3') || x.format?.mime_type?.includes('mpeg')));
  if (!trans?.url) return null;

  const rawCover = t.artwork_url || t.user?.avatar_url || '';
  const coverUrl = rawCover ? rawCover.replace('-large', '-t500x500').replace('-badge', '-t500x500') : DEFAULT_COVER;
  return {
    id: 'sc_' + t.id,
    title: cleanT,
    rawTitle,
    artist: artistName,
    album: albumName,
    label: labelName,
    coverUrl,
    _scTranscodingUrl: trans.url,
    streamUrl: trans.url,
    previewUrl: trans.url,
    duration: durationMs,
    source: 'soundcloud',
    allowTitleCollab: true,
  };
}

async function resolveScTrackBatch(items: any[], limit: number = 15): Promise<any[]> {
  const sliced = items.slice(0, limit);
  const resolved = await Promise.all(
    sliced.map(async (t) => {
      const liveUrl = await resolveSoundCloudTranscoding(t._scTranscodingUrl);
      if (!liveUrl) return null;
      return {
        ...t,
        streamUrl: liveUrl,
        previewUrl: liveUrl,
      };
    })
  );
  return resolved.filter(Boolean);
}

async function searchAudiusTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  const json = await fetchJson(
    `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&limit=30&app_name=AuraMusic`,
    { timeoutMs: 4500 }
  );
  const out: any[] = [];
  for (const t of json?.data || []) {
    if (!t?.id || !t.title || t.is_unlisted || t.is_delete || !t.user?.is_verified) continue;
    if ((Number(t.play_count) || 0) < 250) continue;
    const cleanT = cleanText(t.title);
    const cleanArt = cleanText(t.user?.name || 'Verified Artist');
    const durationMs = (Number(t.duration) || 0) * 1000;
    if (!isOfficialPublisherTrack({ title: cleanT, artist: cleanArt, label: cleanArt, duration: durationMs }, query, strictArtistTarget)) {
      continue;
    }
    const streamUrl = `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=AuraMusic`;
    out.push({
      id: 'audius_' + t.id,
      title: cleanT,
      artist: cleanArt,
      album: 'Official Audius Master',
      coverUrl: t.artwork?.['480x480'] || t.artwork?.['1000x1000'] || DEFAULT_COVER,
      streamUrl,
      previewUrl: streamUrl,
      duration: durationMs,
      source: 'audius',
    });
  }
  return out;
}

async function searchSoundCloudTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  const cid = await getSoundCloudClientId();
  const json = await fetchJson(
    `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${cid}&limit=30&offset=0`,
    { timeoutMs: 4500 }
  );
  const metaList = (json?.collection || [])
    .map((t: any) => mapSoundCloudTrackMeta(t, query, strictArtistTarget))
    .filter(Boolean);
  return resolveScTrackBatch(metaList, 12);
}

async function fetchSaavnAutocompleteTracks(query: string): Promise<any[]> {
  const ac = await fetchJson(
    `https://www.jiosaavn.com/api.php?__call=autocomplete.get&api_version=4&_format=json&_marker=0&ctx=web6dot0&query=${encodeURIComponent(query)}`,
    { headers: SAAVN_HEADERS, timeoutMs: 4000 }
  );
  const ids = (ac?.songs?.data || []).map((s: any) => s?.id).filter(Boolean).slice(0, 6);
  if (ids.length === 0) return [];
  const det = await fetchJson(
    `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${encodeURIComponent(ids.join(','))}&api_version=4&_format=json&_marker=0&ctx=web6dot0`,
    { headers: SAAVN_HEADERS, timeoutMs: 4000 }
  );
  return (det?.songs || []).map(mapJioSaavnSong).filter((t: any) => Boolean(t.streamUrl));
}

export const DIRECT_FEATURED_ARTISTS: Artist[] = [
  {
    id: '565990',
    name: 'Taylor Swift',
    avatarUrl: 'https://c.saavncdn.com/artists/Taylor_Swift_002_20241003071250_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Taylor_Swift_002_20241003071250_500x500.jpg',
    monthlyListeners: '112.4M monthly listeners',
    genre: 'Pop / Singer-Songwriter',
    bio: 'Global recording icon Taylor Swift behind Anti-Hero, Cruel Summer, Fortnight, and Blank Space.',
    verified: true,
  },
  {
    id: '697691',
    name: 'Karan Aujla',
    avatarUrl: 'https://c.saavncdn.com/artists/Karan_Aujla_005_20260925061936_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Karan_Aujla_005_20260925061936_500x500.jpg',
    monthlyListeners: '22.8M monthly listeners',
    genre: 'Punjabi Hip-Hop / Pop',
    bio: 'Jashanpreet Singh Aujla behind Ashke, Winning Speech, Tauba Tauba, and Making Memories.',
    verified: true,
  },
  {
    id: '468245',
    name: 'Diljit Dosanjh',
    avatarUrl: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg',
    monthlyListeners: '28.4M monthly listeners',
    genre: 'Punjabi / Global Pop',
    bio: 'Global icon Diljit Dosanjh behind Hass Hass, Lover, and G.O.A.T.',
    verified: true,
  },
  {
    id: '459320',
    name: 'Arijit Singh',
    avatarUrl: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg',
    monthlyListeners: '46.2M monthly listeners',
    genre: 'Bollywood / Soulful Acoustic',
    bio: 'One of the world’s most-streamed vocalists of all time.',
    verified: true,
  },
  {
    id: '615155',
    name: 'The Weeknd',
    avatarUrl: 'https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_500x500.jpg',
    monthlyListeners: '113.8M monthly listeners',
    genre: 'Dark R&B / Synthpop',
    bio: 'Abel Tesfaye behind Blinding Lights, Starboy, and Often.',
    verified: true,
  },
  {
    id: '1918741',
    name: 'Billie Eilish',
    avatarUrl: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_500x500.jpg',
    monthlyListeners: '99.2M monthly listeners',
    genre: 'Alternative Pop',
    bio: 'Grammy and Oscar-winning artist behind Birds of a Feather, Bad Guy, and Ocean Eyes.',
    verified: true,
  },
  {
    id: '578407',
    name: 'Ed Sheeran',
    avatarUrl: 'https://c.saavncdn.com/artists/Ed_Sheeran_002_20250625073038_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Ed_Sheeran_002_20250625073038_500x500.jpg',
    monthlyListeners: '84.2M monthly listeners',
    genre: 'Pop / Acoustic Pop',
    bio: 'British singer-songwriter behind Shape of You, Perfect, and Sapphire.',
    verified: true,
  },
  {
    id: '603814',
    name: 'Sabrina Carpenter',
    avatarUrl: 'https://c.saavncdn.com/artists/Sabrina_Carpenter_001_20250313025519_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Sabrina_Carpenter_001_20250313025519_500x500.jpg',
    monthlyListeners: '88.1M monthly listeners',
    genre: 'Pop / Dance-Pop',
    bio: 'Global chart-topper behind Espresso, Please Please Please, and Taste.',
    verified: true,
  },
  {
    id: '589552',
    name: 'Ariana Grande',
    avatarUrl: 'https://c.saavncdn.com/artists/Ariana_Grande_004_20240308070221_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Ariana_Grande_004_20240308070221_500x500.jpg',
    monthlyListeners: '96.5M monthly listeners',
    genre: 'Pop / R&B',
    bio: 'Multi-platinum vocalist behind 7 rings and we can’t be friends.',
    verified: true,
  },
  {
    id: '14087974',
    name: 'Shubh',
    avatarUrl: 'https://c.saavncdn.com/artists/Shubh_000_20220921112507_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Shubh_000_20220921112507_500x500.jpg',
    monthlyListeners: '15.3M monthly listeners',
    genre: 'Trap / Desi Hip-Hop',
    bio: 'Punjabi trap icon behind Cheques, No Love, and Elevated.',
    verified: true,
  },
  {
    id: '681966',
    name: 'AP Dhillon',
    avatarUrl: 'https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_500x500.jpg',
    monthlyListeners: '13.1M monthly listeners',
    genre: 'Indo-Canadian Synthwave',
    bio: 'Artist behind With You and Excuses.',
    verified: true,
  },
  {
    id: '512453',
    name: 'Drake',
    avatarUrl: 'https://c.saavncdn.com/artists/Drake_006_20260520062317_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Drake_006_20260520062317_500x500.jpg',
    monthlyListeners: '78.6M monthly listeners',
    genre: 'Hip-Hop / Rap',
    bio: 'Hip-hop icon behind God’s Plan and One Dance.',
    verified: true,
  },
];

export async function directSearchTracks(query: string): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const qLower = trimmed.toLowerCase();

  if (/^(?:global top hits(?:\s+official|\s+english)?|top global|global hits)$/i.test(qLower)) {
    const [englishPl, trendPl] = await Promise.all([
      fetchJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=1081991857&api_version=4&_format=json&_marker=0&ctx=web6dot0', { headers: SAAVN_HEADERS }),
      fetchJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=110858205&api_version=4&_format=json&_marker=0&ctx=web6dot0', { headers: SAAVN_HEADERS }),
    ]);
    const songs = [...(englishPl?.list || []), ...(trendPl?.list || [])]
      .map(mapJioSaavnSong)
      .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t));
    if (songs.length > 0) return songs;
  }

  const [saavnP1, saavnP2, saavnAc, artSearch, scTracks, audiusTracks] = await Promise.all([
    fetchJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(trimmed)}&n=40&p=1`, { headers: SAAVN_HEADERS }),
    fetchJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(trimmed)}&n=40&p=2`, { headers: SAAVN_HEADERS }),
    fetchSaavnAutocompleteTracks(trimmed).catch(() => []),
    fetchJson(`https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(trimmed)}&n=2&p=1`, { headers: SAAVN_HEADERS }),
    searchSoundCloudTracks(trimmed).catch(() => []),
    searchAudiusTracks(trimmed).catch(() => []),
  ]);

  let artistTopTracks: any[] = [];
  const exactArt = (artSearch?.results || []).find((a: any) => artistMatchesTarget(a?.name || '', trimmed));
  if (exactArt?.id) {
    const artPage = await fetchJson(
      `https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&artistId=${exactArt.id}&api_version=4&_format=json&_marker=0&ctx=web6dot0&n_song=50`,
      { headers: SAAVN_HEADERS }
    );
    artistTopTracks = (artPage?.topSongs || [])
      .map(mapJioSaavnSong)
      .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, trimmed, cleanText(exactArt.name || trimmed)));
  }

  const allSaavn = [
    ...artistTopTracks,
    ...saavnAc,
    ...((saavnP1?.results || []).map(mapJioSaavnSong)),
    ...((saavnP2?.results || []).map(mapJioSaavnSong)),
  ].filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, trimmed));

  const seen = new Set<string>();
  const out: Track[] = [];
  for (const item of [...allSaavn, ...scTracks, ...audiusTracks]) {
    const cleanT = item.source === 'jiosaavn' ? cleanSongTitle(item.title, item.artist) : item.title;
    if (!item.streamUrl || !cleanT) continue;
    const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(item.artist)}`;
    if (seen.has(key) || seen.has(item.id)) continue;
    seen.add(key);
    seen.add(item.id);
    out.push({
      id: item.id,
      title: cleanT,
      artist: item.artist,
      album: item.album || 'Single',
      coverUrl: item.coverUrl || DEFAULT_COVER,
      previewUrl: item.streamUrl,
      streamUrl: item.streamUrl,
      duration: item.duration || 0,
      label: item.label || '',
      source: item.source,
    });
  }
  return out;
}

export async function directGetCharts(): Promise<any[]> {
  const [chartsList, englishPl, audiusTrendingJson] = await Promise.all([
    fetchJson('https://www.jiosaavn.com/api.php?__call=content.getCharts&api_version=4&_format=json&_marker=0&ctx=web6dot0', { headers: SAAVN_HEADERS }),
    fetchJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=1081991857&api_version=4&_format=json&_marker=0&ctx=web6dot0', { headers: SAAVN_HEADERS }),
    fetchJson('https://api.audius.co/v1/tracks/trending?app_name=AuraMusic&limit=25', { timeoutMs: 4500 }),
  ]);

  const validCharts: any[] = [];
  const englishTracks = (englishPl?.list || [])
    .map(mapJioSaavnSong)
    .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t))
    .slice(0, 25);
  if (englishTracks.length > 0) {
    validCharts.push({
      id: '1081991857',
      title: cleanText(englishPl?.title || 'English Hit Songs'),
      subtitle: 'Official Global Pop & Hip-Hop Publishers',
      coverUrl: getHighResImage(englishPl?.image) || englishTracks[0].coverUrl,
      tracks: englishTracks,
    });
  }

  const topCharts = Array.isArray(chartsList) ? chartsList.slice(0, 3) : [];
  const resolvedPlaylists = await Promise.all(
    topCharts.map(async (c: any) => {
      const listId = c.listid || c.id;
      const det = await fetchJson(
        `https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${listId}&api_version=4&_format=json&_marker=0&ctx=web6dot0`,
        { headers: SAAVN_HEADERS }
      );
      const tracks = (det?.list || [])
        .map(mapJioSaavnSong)
        .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t))
        .slice(0, 20);
      if (tracks.length === 0) return null;
      return {
        id: listId,
        title: cleanText(det?.title || c.title),
        subtitle: cleanText(det?.subtitle || c.subtitle || 'Top Trending Songs'),
        coverUrl: getHighResImage(det?.image || c.image) || tracks[0].coverUrl,
        tracks,
      };
    })
  );
  for (const ch of resolvedPlaylists) {
    if (ch) validCharts.push(ch);
  }

  const audiusTracks = (audiusTrendingJson?.data || [])
    .filter((t: any) => t?.id && t.title && t.user?.is_verified && (Number(t.play_count) || 0) >= 250 && isOfficialPublisherTrack({ title: t.title, artist: t.user?.name || '' }))
    .slice(0, 20)
    .map((t: any) => ({
      id: 'audius_' + t.id,
      title: cleanText(t.title),
      artist: cleanText(t.user?.name || 'Verified Artist'),
      album: 'Official Audius Master',
      coverUrl: t.artwork?.['480x480'] || DEFAULT_COVER,
      streamUrl: `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=AuraMusic`,
      previewUrl: `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=AuraMusic`,
      duration: (Number(t.duration) || 0) * 1000,
      source: 'audius',
    }));

  if (audiusTracks.length > 0) {
    validCharts.push({
      id: 'audius_global_trending',
      title: 'Audius 320kbps Trending',
      subtitle: 'Official Direct 320k MP3 Releases',
      coverUrl: audiusTracks[0].coverUrl,
      tracks: audiusTracks,
    });
  }

  return validCharts;
}

export async function directGetViralSongs(): Promise<Track[]> {
  const [englishPl, trendPl] = await Promise.all([
    fetchJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=1081991857&api_version=4&_format=json&_marker=0&ctx=web6dot0', { headers: SAAVN_HEADERS }),
    fetchJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=110858205&api_version=4&_format=json&_marker=0&ctx=web6dot0', { headers: SAAVN_HEADERS }),
  ]);
  const merged = [...(englishPl?.list || []).slice(0, 10), ...(trendPl?.list || []).slice(0, 10)]
    .map(mapJioSaavnSong)
    .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t));

  const seen = new Set<string>();
  return merged.filter((t: any) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export async function directSearchArtists(query: string): Promise<Artist[]> {
  if (!query.trim()) return DIRECT_FEATURED_ARTISTS;
  const [saavnRes, dzRes] = await Promise.all([
    fetchJson(
      `https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=20&p=1`,
      { headers: SAAVN_HEADERS }
    ),
    fetchJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=10`),
  ]);

  const seen = new Set<string>();
  const out: Artist[] = [];
  for (const a of saavnRes?.results || []) {
    if (!a?.name || !a.image || a.image.includes('artist-default-music')) continue;
    const name = cleanText(a.name);
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const img = getHighResImage(a.image);
    out.push({
      id: String(a.id),
      name,
      avatarUrl: img,
      bannerUrl: img,
      monthlyListeners: a.ctr ? `${(a.ctr * 140).toLocaleString()} monthly listeners` : '15M+ monthly listeners',
      genre: a.role || 'Official Artist',
      verified: true,
    });
  }
  for (const a of dzRes?.data || []) {
    if (!a?.name || !a.picture_big) continue;
    const name = cleanText(a.name);
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({
      id: `dz_${a.id}`,
      name,
      avatarUrl: a.picture_xl || a.picture_big,
      bannerUrl: a.picture_xl || a.picture_big,
      monthlyListeners: a.nb_fan ? `${Number(a.nb_fan).toLocaleString()} fans` : 'Official Artist',
      genre: 'Official Artist',
      verified: true,
    });
  }
  return out;
}

export async function directGetArtistDetails(id: string): Promise<Artist | null> {
  let artistObj = DIRECT_FEATURED_ARTISTS.find((a) => a.id === id || a.name.toLowerCase() === id.toLowerCase()) || null;
  let saavnId = /^\d+$/.test(id) ? id : artistObj && /^\d+$/.test(artistObj.id) ? artistObj.id : '';

  if (!saavnId && artistObj) {
    const ar = await fetchJson(
      `https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(artistObj.name)}&n=3&p=1`,
      { headers: SAAVN_HEADERS }
    );
    const match = (ar?.results || []).find((a: any) => artistMatchesTarget(a?.name || '', artistObj!.name));
    if (match?.id) saavnId = String(match.id);
  }

  let discogTracks: Track[] = [];
  if (saavnId) {
    const pageData = await fetchJson(
      `https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&artistId=${saavnId}&api_version=4&_format=json&_marker=0&ctx=web6dot0&n_song=80&n_album=10`,
      { headers: SAAVN_HEADERS }
    );
    if (pageData?.name) {
      if (!artistObj) {
        const img = getHighResImage(pageData.image || '') || DEFAULT_COVER;
        artistObj = {
          id: saavnId,
          name: cleanText(pageData.name),
          avatarUrl: img,
          bannerUrl: img,
          monthlyListeners: pageData.follower_count ? `${Number(pageData.follower_count).toLocaleString()} followers` : '20M+ monthly listeners',
          genre: pageData.dominantLanguage ? `${pageData.dominantLanguage} Artist` : 'Official Artist',
          bio: `${cleanText(pageData.name)} official streaming discography.`,
          verified: true,
        };
      }
      discogTracks = (pageData.topSongs || [])
        .map(mapJioSaavnSong)
        .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, artistObj!.name, artistObj!.name));
    }
  }

  if (!artistObj) {
    const searched = await directSearchArtists(id.replace(/^dz_/, ''));
    artistObj = searched[0] || null;
    if (!artistObj) return null;
  }

  if (discogTracks.length < 10) {
    const extra = await directSearchTracks(artistObj.name);
    const seen = new Set(discogTracks.map((t) => normalizeMatchText(t.title)));
    for (const t of extra) {
      if (!seen.has(normalizeMatchText(t.title)) && artistMatchesTarget(t.artist, artistObj.name)) {
        seen.add(normalizeMatchText(t.title));
        discogTracks.push(t);
      }
    }
  }

  return {
    ...artistObj,
    popularTracks: discogTracks,
  };
}

export async function directResolveFallback(title: string, artist: string): Promise<Track | null> {
  const results = await directSearchTracks(`${title} ${artist}`.trim());
  const targetNorm = normalizeMatchText(title);
  return (
    results.find((t) => normalizeMatchText(t.title).includes(targetNorm) && (!artist || artistMatchesTarget(t.artist, artist))) ||
    results[0] ||
    null
  );
}

export async function directFetchLyrics(
  title: string,
  artist: string
): Promise<{ syncedLyrics: string | null; plainLyrics: string | null }> {
  const cleanT = title.replace(/\(.*\)|\[.*\]|(Official.*)|(Lyric.*)|(Music Video)/gi, '').trim();
  const primaryArt = splitArtistEntities(artist)[0] || artist;

  try {
    const exact = await fetchJson(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanT)}&artist_name=${encodeURIComponent(primaryArt)}`,
      { timeoutMs: 4500 }
    );
    if (exact?.syncedLyrics || exact?.plainLyrics) {
      return { syncedLyrics: exact.syncedLyrics || null, plainLyrics: exact.plainLyrics || null };
    }
  } catch {}

  try {
    const list = await fetchJson(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${primaryArt} ${cleanT}`)}`,
      { timeoutMs: 5000 }
    );
    if (Array.isArray(list) && list.length > 0) {
      const synced = list.find((d: any) => d.syncedLyrics);
      return {
        syncedLyrics: synced?.syncedLyrics || null,
        plainLyrics: synced?.plainLyrics || list[0]?.plainLyrics || null,
      };
    }
  } catch {}

  return { syncedLyrics: null, plainLyrics: null };
}
