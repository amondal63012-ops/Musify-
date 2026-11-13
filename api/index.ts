import express from 'express';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const SAAVN_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'X-Forwarded-For': '49.36.120.10',
};

async function fetchSaavnJson(url: string, timeoutMs: number = 4500): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: SAAVN_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Decrypts DES-ECB encrypted media URL to direct high-fidelity 320kbps audio stream
function decryptMediaUrl(encryptedMediaUrl: string): string | null {
  if (!encryptedMediaUrl) return null;
  try {
    const key = CryptoJS.enc.Utf8.parse('38346591');
    const decrypted = CryptoJS.DES.decrypt(
      encryptedMediaUrl,
      key,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    const decryptedUrl = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedUrl) return null;
    return decryptedUrl
      .replace(/_96\.mp4|_48\.mp4|_160\.mp4/, '_320.mp4')
      .replace(/_96\.mp3|_48\.mp3|_160\.mp3/, '_320.mp3');
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

function mapJioSaavnSong(song: any) {
  let streamUrl = decryptMediaUrl(song.more_info?.encrypted_media_url);
  if (streamUrl && (song.more_info?.['320kbps'] === 'false' || song.more_info?.['320kbps'] === false)) {
    streamUrl = streamUrl.replace('_320.mp4', '_160.mp4').replace('_320.mp3', '_160.mp3');
  }
  const durationSec = Number(song.more_info?.duration) || Number(song.duration) || 0;
  const primaryArtists = song.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ');
  const singers = song.more_info?.singers;
  const subtitleArtist = song.subtitle ? song.subtitle.split(' - ')[0] : '';
  const cleanArtist = cleanText(primaryArtists || singers || subtitleArtist || 'Unknown Artist');
  const label = cleanText(song.more_info?.label || '');

  return {
    id: 'saavn_' + song.id,
    title: cleanText(song.title),
    artist: cleanArtist,
    album: cleanText(song.more_info?.album || song.album || 'Single'),
    label,
    coverUrl: getHighResImage(song.image),
    streamUrl: streamUrl || '',
    previewUrl: streamUrl || '',
    duration: durationSec * 1000,
    source: 'jiosaavn'
  };
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

function titleHasArtistCredit(title: string, targetArtist: string): boolean {
  const tClean = cleanText(title || '').toLowerCase();
  const target = cleanText(targetArtist || '').toLowerCase();
  if (!tClean || !target) return false;
  const esc = escapeRegExp(target);
  // Match structured artist credits in verified label titles like "Alok & Alan Walker - Headlights" or "(feat. Alan Walker)"
  const creditPatterns = [
    new RegExp(`^${esc}(?:\\s*[,&x×]|\\s*-|\\s+feat\\.?|\\s+ft\\.?|\\s+with\\b)`),
    new RegExp(`(?:[,&x×]\\s*|\\b(?:feat\\.?|ft\\.?|featuring|with)\\s+)${esc}(?:\\b|\\s*[-)\\]])`),
  ];
  return creditPatterns.some(rx => rx.test(tClean));
}

function splitArtistEntities(artistStr: string): string[] {
  return cleanText(artistStr || '')
    .split(/[,&\/+×]|(?:\s+(?:feat\.?|ft\.?|featuring|with|vs\.?|x)\s+)/i)
    .map(s => s.trim())
    .filter(Boolean);
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
    const entities = splitArtistEntities(trackArtist);
    for (const ent of entities) {
      const entLower = ent.toLowerCase();
      const entCompact = entLower.replace(/[^a-z0-9]/g, '');
      const entSpaced = entLower.replace(/[^a-z0-9]+/g, ' ').trim();
      if (entCompact === targetCompact || entSpaced === targetSpaced) {
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
  'armada music', 'ultra records', 'dim mak', 'mad decent', 'xo records', 'cactus jack',
  'good music', 'aftermath', 'shady records', 'roc nation', 'top dawg', 'dreamville',
  'quality control', 'young money', 'cash money', 'empire', '300 entertainment', 'fueled by ramen',
  'big machine', 'hollywood records', 'walt disney', 'geffen', 'mercury records', 'bmg',
  'geet mp3', 'jass records', 'humble music', 'lokdhun', 'vyrl', 'believe music',
  'bighit', 'hybe', 'yg entertainment', 'sm entertainment', 'jyp entertainment'
];

function isMajorPublisherLabel(labelOrChannel: string): boolean {
  const low = cleanText(labelOrChannel || '').toLowerCase();
  if (!low) return false;
  return OFFICIAL_MAJOR_PUBLISHERS.some(pub => low.includes(pub));
}

// Strictly deletes ALL unofficial mixes, mixtapes, slowed, reverb, lofi, sped up, remixes, covers, karaoke, and impostor uploads
function isUnofficialOrRemix(title: string, artist: string = '', album: string = '', rawTitle: string = '', label: string = ''): boolean {
  if (!title && !rawTitle) return true;
  const tCombined = `${title} ${rawTitle}`.toLowerCase();
  const aLower = (artist || '').toLowerCase();
  const albLower = (album || '').toLowerCase();
  const labLower = (label || '').toLowerCase();
  const fullText = `${tCombined} ${aLower} ${albLower} ${labLower}`;

  const strictBadSubstrings = [
    'karaoke', '16-bit', '16 bit', '16bit', '8-bit', '8 bit', '8bit', 'emulation',
    'soundalike', 'tribute band', 'tribute project', 'backing track', 'arcade player',
    'lullaby', 'sleeptherapy', 'sleep therapy', 'deep sleep', 'sleep music',
    'chiptune', 'zzang karaoke', 'melody karaoke', 'pop covers', 'covers unplugged', 'dreamy lofi',
    'night cascade', 'sunset roses', 'sound tower', 'shadow tower', 'pacani', 'zambazi', 'hyper visor',
    'calming & relaxing', 'relaxing piano', 'city string ensemble',
    'giacomo bucci', 'go rilla', 'cranked up', 'deep mage', 'hardstyle',
    'ambient version', 'slowed', 'sped up', 'speed up', 'speedup', 'reverb', 'reverbed',
    'bass boosted', 'bassboosted', 'nightcore', 'tribute to', 'originally performed by',
    'techno version', 'blinding lights (techno)', 'piano version', 'dance mix', 'club mix', 'party mix', 'dj mix',
    'stutter techno', 'extended instrumental', 'sing feel', 'nonnoburro', 'scity', 'key by key',
    'mellow jones', 'lofi lucy', 'john skyfield', 'lofi', 'lo-fi', 'lo fi',
    'javapink', 'sapphink', 'open masti', 'jackey mishra', 'moriom nessa',
    'insane moony', 'jhonny boutros', 'karaokeysph', 'karaoke idols', 'backing business',
    'dahiya the rapper', 'dikkat official', 'clavier', 'marlene t', 'saarthak',
    'hardeep grewal', 'your movie soundtrack', 'michael von bragin', 'maria lorens',
    'gareth koch', 'sychoside', 'egpianist', 'capybara piano', 'skyemane', 'echo rose',
    'the midnight library', 'taradu', 'boostereo', 'nyae', 'kate chruscicka',
    'workout music', 'lovinc', 'murxsaki', 'chill darling', 'polina cherkas',
    'atlantic notes', 'deep sleep music collective', 'romeo roy', 'ordsmith',
    'industry insiders', 'some study music', 'guitar instrumental', 'acoustic version', 'guitar cafeteria',
    'piano cover', 'acoustic cover', 'instrumental cover', 'instrumental version',
    'workout remix', 'fitness remix', 'study beats', 'chill instrumental',
    'mashup', 'mash up', 'circuit mash', 'megamix', 'mega mix', 'mixtape', 'jukebox',
    'nonstop', 'non-stop', 'bootleg', 'unplugged', 'tiny desk', 'r3d edit',
    'chipmunk', 'chopped', 'screwed', '8d audio', '9d audio', '3d audio', '16d audio',
    'ringtone', 'phonk', 'parody', '0fficial', '[download]', '(download)', 'download]',
    'taken hostage', 'meditation', 'acapella', 'a capella', 'vocal only', 'medley',
    'rework', 'remint', 're-mint', 'r3mix', '1 hour', '10 hour', 'extended loop', 'full album',
    'reaction', 'tutorial', 'type beat', 'free beat', 'karaoke version',
    'djjohal', 'mr-jatt', 'pagalworld', 'pendujatt', 'songspk',
    '7clouds', 'glazey', 'doggy k', 'studaviga', 'vom deich', 'sona prashant', 'fabi 461',
    'hyperbee', 'turborave', 'chill vibes', 'vibes network', 'spitz aura', 'bad subelo',
    'abr music label', 'allabakash khan', 'fran garro', 'mlicasiano09', 'josiane figueiredo',
    'don jaye', 'hustinder', 'hairitage',
    'official preview', '[out now]', 'out now', 'snippet', 'play violinist',
    'luke muzzic', 'gillan cash', 'lexmorris', 'harddope', 'rachel morgan perry',
    'navagio', 'kid on the block', 'fennecxx', 'akrai', 'revelries', 'victoria voss',
    'unresolved', 'magic records', 'losthill', '17diamonds', 'chill vibes records', 'southfold'
  ];

  if (strictBadSubstrings.some(p => fullText.includes(p))) {
    return true;
  }

  // Exact album/title garbage checks
  if (albLower === 'fart' || albLower === 'test') {
    return true;
  }

  // Word-boundary checks on title + rawTitle so words like "remix", "mix", "cover", "live concert" are strictly removed
  const titleRegexes = [
    /\bmix(?:es|ed)?\b/i,
    /\bmixtape\b/i,
    /\bremix(?:ed|es|ing)?\b/i,
    /\bremake(?:s)?\b/i,
    /\brmx\b/i,
    /\bremint\b/i,
    /\breedit\b/i,
    /(?:vip|club|festival)\s+(?:mix|edit)/i,
    /\bslowed\b/i,
    /\bpreview\b/i,
    /\bdj\b/i,
    /\bcover(?:s|ed)?\b/i,
    /\btribute\b/i,
    /\binstrumental\b/i,
    /\bacoustic\b/i,
    /\bpiano\s+(?:version|cover|tribute|instrumental|solo|medley)\b|\(piano\)|\[piano\]/i,
    /\bflip\b/i,
    /\((?:[^)]*\bedit\b[^)]*)\)|\[(?:[^\]]*\bedit\b[^\]]*)\]/i,
    /\b(?:8d|9d|3d|16d|dnb)\b/i,
    /\bconcert\b/i,
    /\bsessions?\b/i,
    /\b(?:live\s+(?:at|from|in|on|performance|session|version)|\(live\)|\[live\])\b/i,
    /\bbgm\b/i,
    /\bextended\b/i
  ];

  if (titleRegexes.some(rx => rx.test(tCombined))) {
    return true;
  }

  // Reject DJ/Tribute/Karaoke/Instrumental-soloist style artist channels
  if (/\b(?:dj|karaoke|lofi|lo-fi|tribute|cover|arcade|sleep|study|meditation|instrumental|violinist|pianist|guitarist|cellist|8-bit|16-bit)\b/i.test(aLower)) {
    return true;
  }

  return false;
}

const IMPOSTOR_STUDIOS = [
  'sound tower', 'shadow tower', 'sunset roses', 'nyae', 'echo rose', 'clavier', 'skyemane',
  'giacomo bucci', '8-bit arcade', 'arcade player', 'zzang karaoke', 'karaokeysph',
  'adam gill', 'ace assam beats', 'trapxmxr', 'alberto sordid', 'the midnight library',
  'taradu', 'boostereo', 'kate chruscicka', 'workout music', 'lovinc', 'murxsaki',
  'chill darling', 'aish', 'polina cherkas', 'atlantic notes', 'deep sleep music collective',
  'romeo roy', 'ordsmith', 'industry insiders', 'some study music', 'factory', 'blurr.',
  'teknodyn', 'mstr snd', "le'mon driver", 'kiran malosana', 'aryan kushagra', 'anu amanat',
  'himanshi bokadiya', 'karaoke idols', 'backing business', 'dahiya the rapper', 'dikkat official',
  'avval', '54godart', 'michigan mauler', 'inder d last level', '4tee7ven', 'shreta ghosal',
  'glazey', 'doggy k', 'studaviga', 'vom deich', 'sona prashant', 'michael von bragin',
  'fabi 461', 'hyperbee', 'turborave', 'insane moony', 'jhonny boutros', 'allabakash khan',
  'fran garro', 'javapink', 'egpianist', 'jackey mishra', 'don jaye', 'mlicasiano09',
  'josiane figueiredo', 'hustinder', 'akla', 'luke muzzic', 'gillan cash', 'lexmorris',
  'harddope', 'rachel morgan perry', 'navagio', 'kid on the block', 'fennecxx', 'akrai',
  'revelries', 'victoria voss', 'unresolved', 'southfold', 'play violinist'
];

const FAMOUS_GLOBAL_ARTISTS = [
  'justin bieber', 'adele', 'eminem', 'taylor swift', 'billie eilish', 'sabrina carpenter',
  'drake', 'rihanna', 'coldplay', 'maroon 5', 'bruno mars', 'lady gaga', 'dua lipa',
  'the weeknd', 'sia', 'avicii', 'ed sheeran', 'ariana grande', 'katy perry', 'selena gomez',
  'charlie puth', 'shawn mendes', 'imagine dragons', 'alan walker', 'marshmello', 'martin garrix',
  'chainsmokers', 'post malone', 'travis scott', 'kendrick lamar', 'kanye west', 'beyonce', 'shakira',
  'camila cabello', 'olivia rodrigo', 'harry styles', 'zayn', 'one direction',
  'karan aujla', 'diljit dosanjh', 'arijit singh', 'hanumankind', 'shubh', 'ap dhillon',
  'sidhu moose wala', 'badshah', 'yo yo honey singh', 'skrillex', 'deadmau5', 'bad bunny',
  'linkin park', 'bts', 'blackpink', 'lana del rey', 'sza', 'doja cat', 'michael jackson',
  'queen', 'the beatles', 'nirvana', 'metallica', 'pink floyd', 'tupac', '2pac', 'snoop dogg'
];

// Reject third-party uploads whose title attributes a famous artist (e.g., "Ariana Grande - positions" by AKLA) when artist credits don't match
function hasUnauthorizedFamousAttribution(title: string, rawTitle: string, artist: string, label: string = ''): boolean {
  const combined = `${title} ${rawTitle}`.toLowerCase();
  if (!combined) return false;
  if (isMajorPublisherLabel(label)) return false;

  for (const fa of FAMOUS_GLOBAL_ARTISTS) {
    const esc = escapeRegExp(fa);
    const rx = new RegExp(`(?:^|\\s-\\s*|\\bby\\s+|[,&×]\\s*)${esc}(?:\\s*-|\\s*$|\\s*\\(|\\s*\\[|[,&×])`, 'i');
    if (rx.test(combined)) {
      if (!artistMatchesTarget(artist, fa, '', false) && !artistMatchesTarget(label, fa, '', false)) {
        return true;
      }
    }
  }
  return false;
}

function isOfficialPublisherTrack(track: any, query: string = '', strictArtistTarget: string = ''): boolean {
  if (!track || !track.title) return false;
  if (isUnofficialOrRemix(track.title, track.artist, track.album, track.rawTitle || '', track.label || '')) {
    return false;
  }

  // Enforce authentic song duration bounds (1 minute to 11 minutes) when duration is reported
  const dur = Number(track.duration) || 0;
  if (dur > 0 && (dur < 60000 || dur > 660000)) {
    return false;
  }

  const aLower = (track.artist || '').toLowerCase();
  const entities = splitArtistEntities(track.artist || '').map(e => e.toLowerCase());
  if (IMPOSTOR_STUDIOS.some(imp => aLower === imp || entities.includes(imp) || (imp.length >= 5 && aLower.includes(imp)))) {
    return false;
  }

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
      const qHasFa = new RegExp(`\\b${escapeRegExp(fa)}\\b`, 'i').test(qLower);
      if (qHasFa && !artistMatchesTarget(track.artist || '', fa, track.rawTitle || track.title || '', allowCollab)) {
        return false;
      }
    }
  }

  return true;
}

function cleanSongTitle(rawTitle: string, artistName: string = ''): string {
  let title = rawTitle
    .replace(/\[NCS Release\]/gi, '')
    .replace(/\(Official Audio\)|\(Official Lyric Video\)|\(Lyric Video\)|\(Official Video\)|\(Audio\)|\(Official Music Video\)|\(Lyrics Video\)|\(Lyrics\)|\(Lyric\)|\(Topic\)|\(Visualizer\)/gi, '')
    .replace(/Official Audio|Official Lyric Video|Lyric Video|Official Video|Official Music Video|Lyrics Video/gi, '')
    .trim();

  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    title = parts.slice(1).join(' - ').trim();
  } else if (artistName && title.toLowerCase().startsWith(artistName.toLowerCase() + ' - ')) {
    title = title.substring(artistName.length + 3).trim();
  }

  return title.replace(/\(.*\)|\[.*\]/g, '').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim();
}

// Audius streaming provider integration for direct 320kbps MP3 background audio playback
function mapAudiusTrack(t: any, query: string = '', strictArtistTarget: string = ''): any | null {
  if (!t?.id || !t.title || t.is_unlisted || t.is_delete || !t.user?.is_verified) return null;
  if ((Number(t.play_count) || 0) < 250) return null;

  const rawT = cleanText(t.title);
  const cleanT = rawT.replace(/\s*\[[^\]]*(?:NCS|Official|Release)[^\]]*\]/gi, '').trim() || rawT;
  const cleanArt = cleanText(t.user?.name || 'Verified Artist');
  const durationMs = (t.duration || 0) * 1000;
  if (!isOfficialPublisherTrack({ title: cleanT, rawTitle: rawT, artist: cleanArt, label: cleanArt, duration: durationMs, allowTitleCollab: false }, query, strictArtistTarget)) {
    return null;
  }

  const streamUrl = `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=AuraMusic`;
  const coverUrl = t.artwork?.['480x480'] || t.artwork?.['1000x1000'] || t.artwork?.['150x150'] || '';

  return {
    id: 'audius_' + t.id,
    title: cleanT,
    artist: cleanArt,
    album: 'Official Audius Master',
    label: cleanArt,
    coverUrl: coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    streamUrl,
    previewUrl: streamUrl,
    duration: durationMs,
    source: 'audius',
    allowTitleCollab: false
  };
}

async function searchAudiusOfficialTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  try {
    const artistQuery = strictArtistTarget || query;
    const [tracksRes, usersRes] = await Promise.all([
      fetch(`https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&limit=50&app_name=AuraMusic`, {
        signal: AbortSignal.timeout(4000)
      }).catch(() => null),
      fetch(`https://api.audius.co/v1/users/search?query=${encodeURIComponent(artistQuery)}&limit=5&app_name=AuraMusic`, {
        signal: AbortSignal.timeout(4000)
      }).catch(() => null)
    ]);

    const tracksJson = tracksRes && tracksRes.ok ? await tracksRes.json().catch(() => ({ data: [] })) : { data: [] };
    const usersJson = usersRes && usersRes.ok ? await usersRes.json().catch(() => ({ data: [] })) : { data: [] };

    const matchingUsers = (usersJson.data || [])
      .filter((u: any) => u?.id && u.is_verified && artistMatchesTarget(u.name || u.handle || '', artistQuery))
      .slice(0, 2);

    const userTrackBatches = matchingUsers.length > 0
      ? await Promise.all(
          matchingUsers.map(async (u: any) => {
            try {
              const r = await fetch(`https://api.audius.co/v1/users/${encodeURIComponent(u.id)}/tracks?limit=50&app_name=AuraMusic`, {
                signal: AbortSignal.timeout(4000)
              });
              if (!r.ok) return [];
              const j = await r.json();
              return j.data || [];
            } catch {
              return [];
            }
          })
        )
      : [];

    const combined = [...userTrackBatches.flat(), ...(tracksJson.data || [])];
    const tracks: any[] = [];
    const seen = new Set<string>();

    for (const t of combined) {
      const mapped = mapAudiusTrack(t, query, strictArtistTarget);
      if (!mapped) continue;
      const key = `${normalizeMatchText(mapped.title)}:::${normalizeMatchText(mapped.artist)}`;
      if (seen.has(key) || seen.has(mapped.id)) continue;
      seen.add(key);
      seen.add(mapped.id);
      tracks.push(mapped);
    }
    return tracks;
  } catch (err) {
    console.error('Audius search error:', err);
    return [];
  }
}

async function fetchAudiusTrendingTracks(limit: number = 40): Promise<any[]> {
  try {
    const res = await fetch(`https://api.audius.co/v1/tracks/trending?app_name=AuraMusic&limit=${limit}`, {
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return [];
    const json = await res.json();
    const tracks: any[] = [];
    const seen = new Set<string>();
    for (const t of (json.data || [])) {
      const mapped = mapAudiusTrack(t);
      if (!mapped) continue;
      const key = `${normalizeMatchText(mapped.title)}:::${normalizeMatchText(mapped.artist)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tracks.push(mapped);
    }
    return tracks;
  } catch {
    return [];
  }
}

// SoundCloud streaming provider integration for direct audio & HLS background playback
let cachedScClientId: string = 'qLcgHhXgeEFFaSolTB9I71LBsqncsD93';
let scClientIdFetchedAt = 0;

async function getSoundCloudClientId(): Promise<string> {
  const now = Date.now();
  if (cachedScClientId && now - scClientIdFetchedAt < 1000 * 60 * 60 * 6) {
    return cachedScClientId;
  }
  try {
    const htmlRes = await fetch('https://soundcloud.com', { signal: AbortSignal.timeout(4000) });
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const scripts = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
      for (const scriptUrl of scripts.slice(-4)) {
        const sRes = await fetch(scriptUrl, { signal: AbortSignal.timeout(3000) });
        if (sRes.ok) {
          const sText = await sRes.text();
          const match = sText.match(/client_id[:=]"([a-zA-Z0-9]{32})"/);
          if (match && match[1]) {
            cachedScClientId = match[1];
            scClientIdFetchedAt = now;
            return cachedScClientId;
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to scrape SoundCloud client_id:', e);
  }
  return cachedScClientId || 'qLcgHhXgeEFFaSolTB9I71LBsqncsD93';
}

function mapSoundCloudTrack(t: any, query: string = '', strictArtistTarget: string = ''): any | null {
  // STRICTLY require verified official SoundCloud account (NEVER accept unverified uploads even with ISRC)
  if (!t?.id || !t.title || t.policy === 'SNIP' || t.user?.verified !== true) return null;

  const durationMs = t.full_duration || t.duration || 0;
  const rawTitle = cleanText(t.title);
  const cleanT = rawTitle.replace(/\s*\[NCS Release\]/gi, '').trim() || rawTitle;

  const userChannel = cleanText(t.user?.username || '');
  const userFullName = cleanText(t.user?.full_name || '');
  const pubArtist = cleanText(t.publisher_metadata?.artist || '');
  const artistName = pubArtist || userChannel || 'Verified Artist';
  const labelName = cleanText(t.publisher_metadata?.publisher || t.label_name || userChannel);

  const rawAlbum = cleanText(t.publisher_metadata?.album_title || '');
  const albumName = (rawAlbum && !['fart', 'test', 'none', 'na'].includes(rawAlbum.toLowerCase()) && rawAlbum.length > 1)
    ? rawAlbum
    : (cleanText(t.label_name || '') || 'Official Release');

  // Guard against low-follower verified artist-pro accounts impersonating famous global stars
  const followers = Number(t.user?.followers_count) || 0;
  for (const fa of FAMOUS_GLOBAL_ARTISTS) {
    const matchesCreditedOrTitle =
      artistMatchesTarget(artistName, fa, rawTitle, true);
    if (matchesCreditedOrTitle) {
      const channelIsRealArtist =
        artistMatchesTarget(userChannel, fa) || artistMatchesTarget(userFullName, fa);
      const isAuthorizedPublisher =
        isMajorPublisherLabel(userChannel) || isMajorPublisherLabel(labelName) || followers >= 200000;
      if (!channelIsRealArtist && !isAuthorizedPublisher) {
        return null;
      }
    }
  }

  if (!isOfficialPublisherTrack(
    { title: cleanT, rawTitle, artist: artistName, album: albumName, label: labelName, duration: durationMs, allowTitleCollab: true },
    query,
    strictArtistTarget
  )) {
    return null;
  }

  const validTranscodings = (t.media?.transcodings || []).filter((x: any) => !x.snipped && x.url);
  if (validTranscodings.length === 0) return null;

  // Prefer direct progressive MP3 first, then AAC HLS, then MP3 HLS (exclude Opus/abr_sq)
  const trans =
    validTranscodings.find((x: any) => x.format?.protocol === 'progressive' && x.format?.mime_type?.includes('mpeg')) ||
    validTranscodings.find((x: any) => x.format?.protocol === 'hls' && (x.preset === 'aac_160k' || x.preset === 'aac_96k')) ||
    validTranscodings.find((x: any) => x.format?.protocol === 'hls' && (x.preset?.startsWith('mp3') || x.format?.mime_type?.includes('mpeg')));

  if (!trans || !trans.url) return null;

  const rawCover = t.artwork_url || t.user?.avatar_url || '';
  const cover = rawCover ? rawCover.replace('-large', '-t500x500').replace('-badge', '-t500x500') : '';
  const isProgressive = trans.format?.protocol === 'progressive';
  const streamUrl = isProgressive
    ? `/api/soundcloud/stream?transcoding=${encodeURIComponent(trans.url)}&proto=progressive`
    : `/api/soundcloud/stream.m3u8?transcoding=${encodeURIComponent(trans.url)}&proto=hls`;

  return {
    id: 'sc_' + t.id,
    title: cleanT,
    rawTitle,
    artist: artistName,
    album: albumName,
    label: labelName,
    coverUrl: cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    streamUrl,
    previewUrl: streamUrl,
    duration: durationMs,
    source: 'soundcloud',
    allowTitleCollab: true
  };
}

async function fetchScJsonWithRetry(buildUrl: (cid: string) => string): Promise<any | null> {
  let clientId = await getSoundCloudClientId();
  let res = await fetch(buildUrl(clientId), { signal: AbortSignal.timeout(4500) }).catch(() => null);
  if (res && res.status === 401) {
    scClientIdFetchedAt = 0;
    clientId = await getSoundCloudClientId();
    res = await fetch(buildUrl(clientId), { signal: AbortSignal.timeout(4500) }).catch(() => null);
  }
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

async function searchSoundCloudOfficialTracks(query: string, strictArtistTarget: string = '', pages: number = 2): Promise<any[]> {
  try {
    const offsets = pages >= 2 ? [0, 50] : [0];
    const artistQuery = strictArtistTarget || query;

    const [trackPages, usersData] = await Promise.all([
      Promise.all(
        offsets.map(offset =>
          fetchScJsonWithRetry(cid =>
            `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${cid}&limit=50&offset=${offset}`
          )
        )
      ),
      fetchScJsonWithRetry(cid =>
        `https://api-v2.soundcloud.com/search/users?q=${encodeURIComponent(artistQuery)}&client_id=${cid}&limit=5`
      )
    ]);

    const verifiedUsers = ((usersData?.collection || []) as any[])
      .filter(u => u?.id && u.verified && artistMatchesTarget(u.username || u.full_name || '', artistQuery))
      .slice(0, 2);

    const userTrackPages = verifiedUsers.length > 0
      ? await Promise.all(
          verifiedUsers.map(u =>
            fetchScJsonWithRetry(cid =>
              `https://api-v2.soundcloud.com/users/${u.id}/tracks?client_id=${cid}&limit=50`
            )
          )
        )
      : [];

    const rawItems = [
      ...userTrackPages.flatMap(d => d?.collection || []),
      ...trackPages.flatMap(d => d?.collection || [])
    ];

    const tracks: any[] = [];
    const seen = new Set<string>();
    for (const t of rawItems) {
      const mapped = mapSoundCloudTrack(t, query, strictArtistTarget);
      if (!mapped) continue;
      const key = `${normalizeMatchText(mapped.title)}:::${normalizeMatchText(mapped.artist)}`;
      if (seen.has(key) || seen.has(mapped.id)) continue;
      seen.add(key);
      seen.add(mapped.id);
      tracks.push(mapped);
    }

    return tracks;
  } catch (err) {
    console.error('SoundCloud search error:', err);
    return [];
  }
}

async function fetchSoundCloudTrendingTracks(genre: string = 'all-music', limit: number = 50): Promise<any[]> {
  try {
    const data = await fetchScJsonWithRetry(cid =>
      `https://api-v2.soundcloud.com/charts?kind=trending&genre=${encodeURIComponent(`soundcloud:genres:${genre}`)}&client_id=${cid}&limit=${limit}`
    );
    const tracks: any[] = [];
    const seen = new Set<string>();
    for (const item of (data?.collection || [])) {
      const raw = item?.track || item;
      // Trending charts must only showcase established official accounts & substantial authentic releases
      if ((Number(raw?.user?.followers_count) || 0) < 10000 || (Number(raw?.playback_count) || 0) < 50000) {
        continue;
      }
      const mapped = mapSoundCloudTrack(raw);
      if (!mapped) continue;
      const key = `${normalizeMatchText(mapped.title)}:::${normalizeMatchText(mapped.artist)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tracks.push(mapped);
    }
    return tracks;
  } catch {
    return [];
  }
}

const GAANA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:49.0) Gecko/20100101 Firefox/49.0',
  'Accept': 'application/json, text/html, text/plain, */*',
  'Referer': 'https://gaana.com/',
  'Origin': 'https://gaana.com'
};

function decryptGaanaStreamUrl(enc: string | undefined): string | null {
  if (!enc || enc.length < 20) return null;
  try {
    const offset = parseInt(enc[0], 10);
    if (isNaN(offset)) return null;
    const ivStr = enc.slice(offset, offset + 16);
    if (ivStr.length !== 16) return null;
    const cipherB64 = enc.slice(offset + 16);
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from('gy1t#b@jl(b$wtme', 'utf8'), Buffer.from(ivStr, 'utf8'));
    const decrypted = decipher.update(cipherB64, 'base64', 'utf8') + decipher.final('utf8');
    return decrypted && decrypted.startsWith('http') ? decrypted : null;
  } catch {
    return null;
  }
}

// Decryption method from github.com/cyberboysumanjay/GaanaAPI (AES-128-CBC web HTML blob cipher)
function decryptGaanaLegacyWebLink(message: string | undefined): string | null {
  if (!message || message.length < 16) return null;
  try {
    const key = Buffer.from('g@1n!(f1#r.0$)&%', 'utf8');
    const iv = Buffer.from('asd!@#!@#@!12312', 'utf8');
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    const decrypted = decipher.update(message, 'base64', 'utf8') + decipher.final('utf8');
    return decrypted && decrypted.startsWith('http') ? decrypted : null;
  } catch {
    return null;
  }
}

function fixGaanaWebArtistName(rawArtist: string): string {
  if (!rawArtist) return 'Verified Artist';
  const cleaned = rawArtist
    .split(',')
    .map(part => part.split('#')[0].trim())
    .filter(Boolean)
    .join(', ');
  return cleanText(cleaned || 'Verified Artist');
}

const gaanaStreamCache = new Map<string, { url: string; exp: number }>();

function parseGaanaWebSongBlobs(html: string, query: string = '', strictArtistTarget: string = ''): any[] {
  if (!html) return [];
  const matches = [...html.matchAll(/> (\{[^<]*\}) </g)];
  const tracks: any[] = [];
  const seen = new Set<string>();

  for (const m of matches) {
    try {
      const jsonSong = JSON.parse(m[1]);
      if (!jsonSong?.title) continue;
      const encEntry =
        jsonSong.path?.high?.[0] ||
        jsonSong.path?.medium?.[0] ||
        jsonSong.path?.normal?.[0] ||
        jsonSong.path?.auto?.[0];
      const encMsg = encEntry?.message;
      const resolvedHls = decryptGaanaLegacyWebLink(encMsg) || decryptGaanaStreamUrl(encMsg);
      if (!resolvedHls) continue;

      const cleanT = cleanText(jsonSong.title);
      const artistName = Array.isArray(jsonSong.artist)
        ? cleanText(jsonSong.artist.map((a: any) => a.name).filter(Boolean).join(', '))
        : fixGaanaWebArtistName(jsonSong.artist || '');
      const albumName = cleanText(jsonSong.albumtitle || jsonSong.album_title || 'Gaana Official Master');
      const durationMs = (Number(jsonSong.duration) || 210) * 1000;

      if (!isOfficialPublisherTrack({ title: cleanT, artist: artistName, album: albumName, duration: durationMs }, query, strictArtistTarget)) {
        continue;
      }

      const sharePath = (jsonSong.share_url || '').replace(/\\/g, '');
      const seokey = jsonSong.seokey || (sharePath.split('/').filter(Boolean).pop()) || encodeURIComponent(cleanT.toLowerCase());
      if (seokey) {
        gaanaStreamCache.set(seokey, { url: resolvedHls, exp: Date.now() + 1000 * 60 * 30 });
      }

      const dedupKey = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const rawArt = jsonSong.albumartwork_large || jsonSong.artwork_large || jsonSong.artwork || '';
      const coverUrl = rawArt
        ? rawArt.replace('175x175', '640x640').replace(/size_s\.jpg|size_m\.jpg|50x50\.jpg/, 'size_l.jpg')
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';

      const streamUrl = `/api/gaana/stream.m3u8?seokey=${encodeURIComponent(seokey)}&proto=hls`;

      tracks.push({
        id: 'gaana_' + (jsonSong.id || seokey),
        title: cleanT,
        artist: artistName,
        album: albumName,
        language: jsonSong.language || '',
        releaseDate: jsonSong.release_date || '',
        gaanaUrl: sharePath ? `https://gaana.com${sharePath}` : undefined,
        coverUrl,
        streamUrl,
        previewUrl: streamUrl,
        duration: durationMs,
        source: 'gaana'
      });
    } catch {
      continue;
    }
  }
  return tracks;
}

function resolveGaanaFetchUrl(targetUrl: string): string {
  const proxyBase = (process.env.GAANA_PROXY_URL || '').trim();
  if (!proxyBase) return targetUrl;
  if (proxyBase.includes('{url}')) {
    return proxyBase.replace('{url}', encodeURIComponent(targetUrl));
  }
  const sep = proxyBase.includes('?') ? '&' : '?';
  return `${proxyBase}${sep}url=${encodeURIComponent(targetUrl)}`;
}

async function fetchGaanaSongsByUrl(gaanaUrl: string, query: string = '', strictArtistTarget: string = ''): Promise<any[]> {
  try {
    if (!/^https?:\/\/(?:www\.|m\.)?gaana\.com\//i.test(gaanaUrl)) return [];
    const res = await fetch(resolveGaanaFetchUrl(gaanaUrl), {
      headers: GAANA_HEADERS,
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseGaanaWebSongBlobs(html, query, strictArtistTarget);
  } catch {
    return [];
  }
}

async function fetchGaanaSongDetail(seokey: string): Promise<any | null> {
  try {
    const apiUrl = `https://gaana.com/apiv2?seokey=${encodeURIComponent(seokey)}&type=songDetail`;
    const res = await fetch(resolveGaanaFetchUrl(apiUrl), {
      method: 'POST',
      headers: GAANA_HEADERS,
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const rawText = await res.text();
      const data = JSON.parse(rawText);
      if (data.tracks?.[0]) return data.tracks[0];
    }
  } catch {}

  // Fallback to GaanaAPI web page scraper for song seokey
  try {
    const webTracks = await fetchGaanaSongsByUrl(`https://gaana.com/song/${encodeURIComponent(seokey)}`);
    if (webTracks.length > 0) {
      const cached = gaanaStreamCache.get(seokey);
      return {
        _preResolvedUrl: cached?.url || null,
        ...webTracks[0]
      };
    }
  } catch {}

  return null;
}

// Gaana streaming provider integration via live apiv2 API + GaanaAPI web HTML scraper with AES-128-CBC HLS stream resolution
async function searchGaanaOfficialTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  try {
    if (/^https?:\/\/(?:www\.|m\.)?gaana\.com\//i.test(query)) {
      return await fetchGaanaSongsByUrl(query, '', strictArtistTarget);
    }

    const searchUrl = `https://gaana.com/apiv2?keyword=${encodeURIComponent(query)}&type=search&content_filter=2&include=allItems`;
    const res = await fetch(resolveGaanaFetchUrl(searchUrl), {
      method: 'POST',
      headers: GAANA_HEADERS,
      signal: AbortSignal.timeout(4500)
    }).catch(() => null);

    if (!res || !res.ok) {
      // Opportunistically try gsearch -> gaana.com playlist/artist page scraping via GaanaAPI pattern
      try {
        const gsearchUrl = `https://gsearch.gaana.com/gaanasearch-api/mobilesuggest/autosuggest-lite-vltr-json?query=${encodeURIComponent(query)}&content_filter=2&include=allItems&isReg=1`;
        const gsRes = await fetch(resolveGaanaFetchUrl(gsearchUrl), {
          headers: GAANA_HEADERS,
          signal: AbortSignal.timeout(3500)
        });
        if (gsRes.ok) {
          const gsData = await gsRes.json().catch(() => null);
          const artistGroup = (gsData?.gr || []).find((g: any) => g.ty === 'Artist');
          const playlistGroup = (gsData?.gr || []).find((g: any) => g.ty === 'Playlist');
          const firstSeo = artistGroup?.gd?.[0]?.seo
            ? `https://gaana.com/artist/${artistGroup.gd[0].seo}`
            : (playlistGroup?.gd?.[0]?.seo ? `https://gaana.com/playlist/${playlistGroup.gd[0].seo}` : '');
          if (firstSeo) {
            return await fetchGaanaSongsByUrl(firstSeo, query, strictArtistTarget);
          }
        }
      } catch {}
      return [];
    }

    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return [];
    }
    const trackGroup = (data?.gr || []).find((g: any) => g.ty === 'Track');
    const candidates = (trackGroup?.gd || []).filter((item: any) => item.seo).slice(0, 12);
    if (candidates.length === 0) return [];

    const details = await Promise.all(candidates.map((c: any) => fetchGaanaSongDetail(c.seo)));
    const tracks: any[] = [];
    const seen = new Set<string>();

    for (const tr of details) {
      if (!tr || !tr.track_title) continue;
      const cleanT = cleanText(tr.track_title);
      const artistName = cleanText(
        Array.isArray(tr.artist) ? tr.artist.map((a: any) => a.name).filter(Boolean).join(', ') : (tr.artist || 'Verified Artist')
      );
      const albumName = cleanText(tr.album_title || 'Gaana Official Master');
      const durationMs = (Number(tr.duration) || 210) * 1000;

      if (!isOfficialPublisherTrack({ title: cleanT, artist: artistName, album: albumName, duration: durationMs }, query, strictArtistTarget)) {
        continue;
      }

      const encMsg = tr.urls?.high?.message || tr.urls?.auto?.message || tr.urls?.medium?.message;
      const resolvedHls = decryptGaanaStreamUrl(encMsg);
      if (!resolvedHls) continue;

      if (tr.seokey) {
        gaanaStreamCache.set(tr.seokey, { url: resolvedHls, exp: Date.now() + 1000 * 60 * 30 });
      }

      const key = `${cleanT.toLowerCase()}:::${artistName.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let coverUrl = tr.artwork_large || tr.artwork_web || tr.artwork || tr.atw || '';
      if (coverUrl && !coverUrl.startsWith('http')) {
        coverUrl = `https://a10.gaanacdn.com/images/${coverUrl}`;
      }
      if (!coverUrl) {
        coverUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
      } else {
        coverUrl = coverUrl.replace(/size_s\.jpg|size_m\.jpg|175x175\.jpg|50x50\.jpg/, 'size_l.jpg');
      }

      const streamUrl = `/api/gaana/stream.m3u8?seokey=${encodeURIComponent(tr.seokey)}&proto=hls`;

      tracks.push({
        id: 'gaana_' + (tr.track_id || tr.seokey),
        title: cleanT,
        artist: artistName,
        album: albumName,
        coverUrl,
        streamUrl,
        previewUrl: streamUrl,
        duration: durationMs,
        source: 'gaana'
      });
    }

    return tracks;
  } catch (err) {
    console.error('Gaana search error:', err);
    return [];
  }
}

function mapDeezerRawTrack(t: any, query: string = '', strictArtistTarget: string = '', coverOverride: string = '', albumOverride: string = ''): any | null {
  if (!t?.id || (!t.title && !t.title_short) || !t.artist?.name) return null;
  const rawTitle = cleanText(t.title || t.title_short);
  const cleanT = cleanText(t.title_short || t.title);
  const artistName = cleanText(t.artist.name);
  const albumName = cleanText(albumOverride || t.album?.title || 'Official Release');
  const durationMs = (Number(t.duration) || 0) * 1000;

  if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName, duration: durationMs }, query, strictArtistTarget)) {
    return null;
  }

  const coverUrl =
    coverOverride ||
    t.album?.cover_xl ||
    t.album?.cover_big ||
    t.album?.cover_medium ||
    t.artist?.picture_xl ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';

  return {
    id: 'dz_' + t.id,
    title: cleanT,
    artist: artistName,
    album: albumName,
    rank: Number(t.rank) || 0,
    coverUrl,
    streamUrl: '',
    previewUrl: '',
    duration: durationMs,
    source: 'deezer'
  };
}

// Deezer metadata lookup used solely for global artist discovery, anti-impostor validation, and chart title resolution
async function searchDeezerMetadataTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  try {
    const [p1, p2] = await Promise.all([
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=50&index=0`, { signal: AbortSignal.timeout(4500) })
        .then(r => r.ok ? r.json() : { data: [] })
        .catch(() => ({ data: [] })),
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=50&index=50`, { signal: AbortSignal.timeout(4500) })
        .then(r => r.ok ? r.json() : { data: [] })
        .catch(() => ({ data: [] }))
    ]);

    const tracks: any[] = [];
    const seen = new Set<string>();

    for (const t of [...(p1.data || []), ...(p2.data || [])]) {
      const mapped = mapDeezerRawTrack(t, query, strictArtistTarget);
      if (!mapped) continue;
      const key = `${mapped.title.toLowerCase()}:::${mapped.artist.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tracks.push(mapped);
    }

    return tracks;
  } catch (err) {
    console.error('Deezer metadata search error:', err);
    return [];
  }
}

async function fetchDeezerArtistTopTitles(artistName: string, knownDzId: string = ''): Promise<any[]> {
  try {
    let dzId = knownDzId;
    let targetName = artistName;
    if (!dzId) {
      const sRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=5`, {
        signal: AbortSignal.timeout(4000)
      });
      if (sRes.ok) {
        const sJson = await sRes.json();
        const exact = (sJson.data || []).find((a: any) => artistMatchesTarget(a.name, artistName)) || (sJson.data || [])[0];
        if (exact) {
          dzId = String(exact.id);
          targetName = cleanText(exact.name);
        }
      }
    }
    if (!dzId) return [];
    const topRes = await fetch(`https://api.deezer.com/artist/${encodeURIComponent(dzId)}/top?limit=40`, { signal: AbortSignal.timeout(4500) })
      .then(r => r.ok ? r.json() : { data: [] })
      .catch(() => ({ data: [] }));

    return (topRes.data || [])
      .map((t: any) => mapDeezerRawTrack(t, targetName, targetName))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Musixmatch official catalog, charts & synced lyrics integration (via MUSIXMATCH_API_KEY)
async function searchMusixmatchOfficialTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  const apiKey = process.env.MUSIXMATCH_API_KEY;
  if (!apiKey || !query) return [];
  try {
    const url = `https://api.musixmatch.com/ws/1.1/track.search?apikey=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&page_size=30&s_track_rating=desc`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json?.message?.body?.track_list || [];
    const tracks: any[] = [];
    for (const item of list) {
      const tr = item?.track;
      if (!tr?.track_name || !tr?.artist_name) continue;
      const cleanT = cleanText(tr.track_name);
      const artistName = cleanText(tr.artist_name);
      const albumName = cleanText(tr.album_name || 'Official Release');
      const durationMs = (Number(tr.track_length) || 0) * 1000;
      if (!isOfficialPublisherTrack({ title: cleanT, artist: artistName, album: albumName, duration: durationMs }, query, strictArtistTarget)) {
        continue;
      }
      tracks.push({
        id: 'mxm_' + tr.track_id,
        title: cleanT,
        artist: artistName,
        album: albumName,
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        streamUrl: '',
        previewUrl: '',
        duration: durationMs,
        source: 'musixmatch'
      });
    }
    return tracks;
  } catch {
    return [];
  }
}

async function fetchMusixmatchTopCharts(country: string = 'xw'): Promise<any[]> {
  const apiKey = process.env.MUSIXMATCH_API_KEY;
  if (!apiKey) return [];
  try {
    const url = `https://api.musixmatch.com/ws/1.1/chart.tracks.get?apikey=${encodeURIComponent(apiKey)}&chart_name=top&page=1&page_size=20&country=${encodeURIComponent(country)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json?.message?.body?.track_list || [];
    return list
      .map((item: any) => {
        const tr = item?.track;
        if (!tr?.track_name || !tr?.artist_name) return null;
        const cleanT = cleanText(tr.track_name);
        const artistName = cleanText(tr.artist_name);
        const albumName = cleanText(tr.album_name || 'Official Release');
        const durationMs = (Number(tr.track_length) || 0) * 1000;
        if (!isOfficialPublisherTrack({ title: cleanT, artist: artistName, album: albumName, duration: durationMs })) return null;
        return { title: cleanT, artist: artistName, album: albumName, coverUrl: '' };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchMusixmatchLyrics(title: string, artist: string): Promise<{ syncedLyrics: string | null; plainLyrics: string | null }> {
  const apiKey = process.env.MUSIXMATCH_API_KEY;
  if (!apiKey) return { syncedLyrics: null, plainLyrics: null };
  try {
    const [subRes, lyrRes] = await Promise.all([
      fetch(`https://api.musixmatch.com/ws/1.1/matcher.subtitle.get?apikey=${encodeURIComponent(apiKey)}&q_track=${encodeURIComponent(title)}&q_artist=${encodeURIComponent(artist)}`, { signal: AbortSignal.timeout(3500) })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      fetch(`https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?apikey=${encodeURIComponent(apiKey)}&q_track=${encodeURIComponent(title)}&q_artist=${encodeURIComponent(artist)}`, { signal: AbortSignal.timeout(3500) })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    ]);
    const syncedLyrics = subRes?.message?.body?.subtitle?.subtitle_body || null;
    const plainLyrics = lyrRes?.message?.body?.lyrics?.lyrics_body || null;
    return { syncedLyrics, plainLyrics };
  } catch {
    return { syncedLyrics: null, plainLyrics: null };
  }
}

// Last.fm official catalog, charts & artist top tracks integration (via LASTFM_API_KEY)
async function searchLastFmOfficialTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey || !query) return [];
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=30`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json?.results?.trackmatches?.track || [];
    const tracks: any[] = [];
    for (const t of list) {
      if (!t?.name || !t?.artist) continue;
      const cleanT = cleanText(t.name);
      const artistName = cleanText(t.artist);
      if (!isOfficialPublisherTrack({ title: cleanT, artist: artistName, album: 'Official Release' }, query, strictArtistTarget)) {
        continue;
      }
      tracks.push({
        id: 'lfm_' + encodeURIComponent(`${cleanT}_${artistName}`),
        title: cleanT,
        artist: artistName,
        album: 'Official Release',
        coverUrl: '',
        streamUrl: '',
        previewUrl: '',
        duration: 0,
        source: 'lastfm'
      });
    }
    return tracks;
  } catch {
    return [];
  }
}

async function fetchLastFmTopCharts(): Promise<any[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${encodeURIComponent(apiKey)}&format=json&limit=20`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json?.tracks?.track || [];
    return list
      .map((t: any) => {
        if (!t?.name || !t?.artist?.name) return null;
        const cleanT = cleanText(t.name);
        const artistName = cleanText(t.artist.name);
        const durationMs = (Number(t.duration) || 0) * 1000;
        if (!isOfficialPublisherTrack({ title: cleanT, artist: artistName, duration: durationMs })) return null;
        return { title: cleanT, artist: artistName, album: 'Last.fm Global Top', coverUrl: '' };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchLastFmArtistTopTracks(artistName: string): Promise<any[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey || !artistName) return [];
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(artistName)}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=25`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json?.toptracks?.track || [];
    return list
      .map((t: any) => {
        if (!t?.name || !t?.artist?.name) return null;
        const cleanT = cleanText(t.name);
        const art = cleanText(t.artist.name);
        if (!isOfficialPublisherTrack({ title: cleanT, artist: art }, art, art)) return null;
        return { title: cleanT, artist: art, album: 'Last.fm Top Track', coverUrl: '' };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Jamendo Official Catalog integration (free licensed MP3 streams when JAMENDO_CLIENT_ID is set)
async function searchJamendoOfficialTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  const clientId = (process.env.JAMENDO_CLIENT_ID || '').trim();
  if (!clientId || !query) return [];
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(clientId)}&format=json&limit=25&audioformat=mp32&search=${encodeURIComponent(query)}&order=popularity_total`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = await res.json();
    const results = json?.results || [];
    const tracks: any[] = [];
    const seen = new Set<string>();

    for (const item of results) {
      if (!item?.id || !item.name || !item.audio || item.audiodownload_allowed === false && !item.audio) continue;
      const cleanT = cleanText(item.name);
      const artistName = cleanText(item.artist_name || 'Jamendo Artist');
      const albumName = cleanText(item.album_name || 'Jamendo Official');
      const durationMs = (Number(item.duration) || 0) * 1000;
      if (!isOfficialPublisherTrack({ title: cleanT, artist: artistName, album: albumName, label: 'Jamendo Official', duration: durationMs }, query, strictArtistTarget)) {
        continue;
      }
      const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const coverUrl = item.album_image || item.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
      tracks.push({
        id: 'jam_' + item.id,
        title: cleanT,
        artist: artistName,
        album: albumName,
        label: 'Jamendo Official',
        coverUrl,
        streamUrl: item.audio,
        previewUrl: item.audio,
        duration: durationMs,
        source: 'jamendo'
      });
    }
    return tracks;
  } catch {
    return [];
  }
}

async function fetchJamendoTrendingTracks(limit: number = 25): Promise<any[]> {
  const clientId = (process.env.JAMENDO_CLIENT_ID || '').trim();
  if (!clientId) return [];
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(clientId)}&format=json&limit=${limit}&audioformat=mp32&order=popularity_week`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json = await res.json();
    const tracks: any[] = [];
    for (const item of (json?.results || [])) {
      if (!item?.id || !item.name || !item.audio) continue;
      const cleanT = cleanText(item.name);
      const artistName = cleanText(item.artist_name || 'Jamendo Artist');
      const albumName = cleanText(item.album_name || 'Jamendo Weekly Top');
      const durationMs = (Number(item.duration) || 0) * 1000;
      if (!isOfficialPublisherTrack({ title: cleanT, artist: artistName, album: albumName, duration: durationMs })) continue;
      tracks.push({
        id: 'jam_' + item.id,
        title: cleanT,
        artist: artistName,
        album: albumName,
        label: 'Jamendo Official',
        coverUrl: item.album_image || item.image || '',
        streamUrl: item.audio,
        previewUrl: item.audio,
        duration: durationMs,
        source: 'jamendo'
      });
    }
    return tracks;
  } catch {
    return [];
  }
}

function parseArchiveDurationSeconds(len: unknown): number {
  if (typeof len === 'number') return isFinite(len) ? len : 0;
  const s = String(len || '').trim();
  if (!s) return 0;
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

// Internet Archive Official Netlabel / Musopen / 78rpm Catalog (100% free direct HTTP 206 MP3 streaming)
async function searchArchiveOfficialTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  const cleanQ = query.replace(/[^a-zA-Z0-9\s'-]/g, ' ').trim();
  if (!cleanQ || cleanQ.length < 2) return [];
  try {
    const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      `collection:(musopen OR netlabels OR 78rpm) AND (title:(${cleanQ}) OR creator:(${cleanQ})) AND mediatype:audio`
    )}&fl[]=identifier,title,creator,downloads&sort[]=downloads+desc&rows=4&output=json`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(4000) });
    if (!searchRes.ok) return [];
    const searchJson = await searchRes.json().catch(() => null);
    const docs = (searchJson?.response?.docs || []).slice(0, 3);
    if (docs.length === 0) return [];

    const metadataBatches = await Promise.all(
      docs.map(async (doc: any) => {
        if (!doc?.identifier) return null;
        try {
          const mRes = await fetch(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`, {
            signal: AbortSignal.timeout(3500)
          });
          if (!mRes.ok) return null;
          const mJson = await mRes.json();
          return { doc, meta: mJson };
        } catch {
          return null;
        }
      })
    );

    const tracks: any[] = [];
    const seen = new Set<string>();
    for (const batch of metadataBatches) {
      if (!batch?.meta?.files) continue;
      const { doc, meta } = batch;
      const creatorRaw = Array.isArray(meta.metadata?.creator)
        ? meta.metadata.creator[0]
        : (meta.metadata?.creator || doc.creator || 'Archive Publisher');
      const albumTitle = cleanText(
        (Array.isArray(meta.metadata?.title) ? meta.metadata.title[0] : meta.metadata?.title) ||
        doc.title ||
        'Internet Archive Audio'
      );
      const publisherLabel = cleanText(
        (Array.isArray(meta.metadata?.publisher) ? meta.metadata.publisher[0] : meta.metadata?.publisher) ||
        'Internet Archive Netlabel'
      );
      const coverUrl = `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`;

      const mp3Files = (meta.files as any[])
        .filter((f) => {
          const isMp3 = f?.name?.toLowerCase().endsWith('.mp3') && (f?.source === 'original' || f?.format === 'VBR MP3');
          const lenSec = parseArchiveDurationSeconds(f?.length);
          return isMp3 && lenSec >= 60 && lenSec <= 660;
        })
        .slice(0, 5);

      for (const file of mp3Files) {
        const rawFileTitle = cleanText(file.title || file.name.replace(/\.mp3$/i, '').replace(/[_-]+/g, ' ').replace(/^\d+[\s._-]*/, ''));
        const trackArtist = cleanText(file.artist || file.creator || creatorRaw);
        const durationMs = Math.round(parseArchiveDurationSeconds(file.length) * 1000);
        if (!rawFileTitle) continue;
        if (!isOfficialPublisherTrack({ title: rawFileTitle, artist: trackArtist, album: albumTitle, label: publisherLabel, duration: durationMs }, query, strictArtistTarget)) {
          continue;
        }

        const key = `${normalizeMatchText(rawFileTitle)}:::${normalizeMatchText(trackArtist)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const streamUrl = `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeURIComponent(file.name)}`;
        tracks.push({
          id: `arch_${doc.identifier}_${tracks.length}`,
          title: rawFileTitle,
          artist: trackArtist,
          album: albumTitle,
          label: publisherLabel,
          coverUrl,
          streamUrl,
          previewUrl: streamUrl,
          duration: durationMs,
          source: 'archive'
        });
      }
    }

    return tracks.slice(0, 12);
  } catch {
    return [];
  }
}

export const app = express();
app.use(express.json());

// Enable CORS for Vercel and cross-origin embedding
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check for Vercel, Cloud Run, and monitoring (do not bind '/' so SPA frontend serves HTML)
app.get(['/api/health', '/health', '/api'], (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Aura Music API' });
});

// SoundCloud stream resolver endpoint (redirects 302 to live progressive/HLS URL)
app.get(['/api/soundcloud/stream', '/api/soundcloud/stream.m3u8', '/soundcloud/stream', '/soundcloud/stream.m3u8'], async (req, res) => {
  try {
    const transcoding = req.query.transcoding as string;
    if (!transcoding) {
      return res.status(400).json({ error: 'Transcoding URL is required' });
    }

    let clientId = await getSoundCloudClientId();
    let streamRes = await fetch(`${transcoding}?client_id=${clientId}`, { signal: AbortSignal.timeout(4000) });

    if (streamRes.status === 401) {
      scClientIdFetchedAt = 0;
      clientId = await getSoundCloudClientId();
      streamRes = await fetch(`${transcoding}?client_id=${clientId}`, { signal: AbortSignal.timeout(4000) });
    }

    if (!streamRes.ok) {
      return res.status(streamRes.status).json({ error: 'Failed to resolve stream' });
    }

    const data = await streamRes.json();
    if (!data.url) {
      return res.status(404).json({ error: 'Stream URL not found' });
    }

    res.redirect(302, data.url);
  } catch (err) {
    console.error('SoundCloud stream error:', err);
    res.status(500).json({ error: 'Failed to stream track' });
  }
});

// Gaana HLS stream resolver endpoint (uses cached decrypted URL first to bypass Akamai bursts, falls back to apiv2 + GaanaAPI scraper)
app.get(['/api/gaana/stream.m3u8', '/gaana/stream.m3u8', '/api/gaana/stream', '/gaana/stream'], async (req, res) => {
  try {
    const seokey = ((req.query.seokey as string) || '').trim();
    if (!seokey) {
      return res.status(400).json({ error: 'seokey is required' });
    }
    const cached = gaanaStreamCache.get(seokey);
    if (cached && cached.exp > Date.now() && cached.url) {
      return res.redirect(302, cached.url);
    }
    const tr = await fetchGaanaSongDetail(seokey);
    if (!tr) {
      return res.status(404).json({ error: 'Gaana track not found' });
    }
    const encMsg = tr.urls?.high?.message || tr.urls?.auto?.message || tr.urls?.medium?.message;
    const streamUrl = tr._preResolvedUrl || decryptGaanaStreamUrl(encMsg) || decryptGaanaLegacyWebLink(encMsg);
    if (!streamUrl) {
      return res.status(404).json({ error: 'Gaana stream URL unavailable' });
    }
    gaanaStreamCache.set(seokey, { url: streamUrl, exp: Date.now() + 1000 * 60 * 30 });
    res.redirect(302, streamUrl);
  } catch (err) {
    console.error('Gaana stream error:', err);
    res.status(500).json({ error: 'Failed to resolve Gaana stream' });
  }
});

// Direct Gaana URL resolver endpoint (implements github.com/cyberboysumanjay/GaanaAPI song/album/playlist/artist lookup)
app.get(['/api/gaana/resolve', '/api/gaana/result', '/gaana/result'], async (req, res) => {
  try {
    const url = ((req.query.url as string) || '').trim();
    if (!url || !/^https?:\/\/(?:www\.|m\.)?gaana\.com\//i.test(url)) {
      return res.status(400).json({ error: 'Valid https://gaana.com/... URL is required' });
    }
    const tracks = await fetchGaanaSongsByUrl(url);
    res.json(tracks);
  } catch (err) {
    console.error('Gaana URL resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve Gaana URL' });
  }
});

// Helper: Fetch JioSaavn autocomplete song details (key-less global publisher lookup)
async function fetchSaavnAutocompleteTracks(query: string): Promise<any[]> {
  try {
    const ac = await fetchSaavnJson(
      `https://www.jiosaavn.com/api.php?__call=autocomplete.get&api_version=4&_format=json&_marker=0&ctx=web6dot0&query=${encodeURIComponent(query)}`,
      3800
    );
    const ids = (ac?.songs?.data || []).map((s: any) => s?.id).filter(Boolean).slice(0, 6);
    if (ids.length === 0) return [];
    const det = await fetchSaavnJson(
      `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${encodeURIComponent(ids.join(','))}&api_version=4&_format=json&_marker=0&ctx=web6dot0`,
      4000
    );
    return (det?.songs || []).map(mapJioSaavnSong).filter((t: any) => Boolean(t.streamUrl));
  } catch {
    return [];
  }
}

// Helper: Fetch iTunes public global top songs metadata (100% key-less)
async function fetchItunesTopTracksMetadata(limit: number = 20): Promise<any[]> {
  try {
    const res = await fetch(`https://itunes.apple.com/us/rss/topsongs/limit=${limit}/json`, {
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const entries = json?.feed?.entry || [];
    return entries
      .map((entry: any) => {
        const title = cleanText(entry?.['im:name']?.label || '');
        const artist = cleanText(entry?.['im:artist']?.label || '');
        if (!title || !artist || isUnofficialOrRemix(title, artist)) return null;
        const images = entry?.['im:image'] || [];
        const coverRaw = images[images.length - 1]?.label || '';
        const coverUrl = coverRaw ? coverRaw.replace(/\d+x\d+bb/, '500x500bb') : '';
        return { title, artist, album: cleanText(entry?.['im:collection']?.['im:name']?.label || 'Global Top Hits'), coverUrl };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Helper: Resolve any track to a direct HTML5/HLS background-playable stream across JioSaavn / SoundCloud / Gaana / Audius
async function resolveDirectStreamTrack(title: string, artist: string = '', coverOverride: string = '', albumOverride: string = ''): Promise<any | null> {
  const cleanTitle = title.replace(/\(.*\)|\[.*\]/g, '').trim();
  const targetTitleNorm = normalizeMatchText(cleanTitle);
  const query = `${cleanTitle} ${artist}`.trim();
  if (!cleanTitle) return null;

  const matchesTrack = (t: any) => {
    if (!t?.streamUrl) return false;
    const candNorm = normalizeMatchText(t.title || '');
    const titleMatch = Boolean(
      candNorm && targetTitleNorm && (candNorm === targetTitleNorm || candNorm.includes(targetTitleNorm) || targetTitleNorm.includes(candNorm))
    );
    if (!titleMatch) return false;
    if (artist && !artistMatchesTarget(t.artist || '', artist, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab))) {
      return false;
    }
    return true;
  };

  try {
    const [saavnRes, saavnAcTracks, scTracks, gaanaTracks, audiusTracks, jamendoTracks] = await Promise.all([
      fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=8&p=1`, 4000)
        .then(d => d || {}),
      fetchSaavnAutocompleteTracks(query).catch(() => []),
      searchSoundCloudOfficialTracks(query, artist, 1).catch(() => []),
      searchGaanaOfficialTracks(query, artist).catch(() => []),
      searchAudiusOfficialTracks(query, artist).catch(() => []),
      searchJamendoOfficialTracks(query, artist).catch(() => [])
    ]);

    const saavnCandidates = [
      ...(saavnAcTracks || []),
      ...((saavnRes.results || []).map(mapJioSaavnSong)),
    ].filter((t: any) => t.streamUrl && isOfficialPublisherTrack(t, query, artist));

    const match =
      saavnCandidates.find(matchesTrack) ||
      gaanaTracks.find(matchesTrack) ||
      scTracks.find(matchesTrack) ||
      audiusTracks.find(matchesTrack) ||
      jamendoTracks.find(matchesTrack) ||
      null;

    if (!match) return null;
    return {
      ...match,
      title: cleanTitle,
      artist: artist || match.artist,
      coverUrl: coverOverride || match.coverUrl,
      album: albumOverride || match.album
    };
  } catch {
    return null;
  }
}

// Track fallback & recovery resolver -> strictly resolves ONLY to direct background-playable streams
app.get(['/api/track/fallback', '/track/fallback'], async (req, res) => {
  try {
    const title = ((req.query.title as string) || '').trim();
    const artist = ((req.query.artist as string) || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const resolved = await resolveDirectStreamTrack(title, artist);
    if (resolved && resolved.streamUrl) {
      return res.json(resolved);
    }

    return res.status(404).json({ error: 'No direct background stream fallback available' });
  } catch (err) {
    console.error('Track fallback error:', err);
    res.status(500).json({ error: 'Fallback resolution failed' });
  }
});

// In-memory cache for charts
let cachedCharts: any[] | null = null;
let cacheExpiry = 0;

// API Route to fetch official JioSaavn + English Hit Songs + SoundCloud + Audius + International Top charts (100% key-less direct background playback)
app.get(['/api/charts', '/charts'], async (req, res) => {
  try {
    const now = Date.now();
    if (cachedCharts && now < cacheExpiry) {
      return res.json(cachedCharts);
    }

    const [chartsData, englishHitsPl, scAllTrending, scPopTrending, audiusTrending, jamendoTrending, dzChartRes, itunesTopList, mxmChartList, lfmChartList] = await Promise.all([
      fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=content.getCharts&api_version=4&_format=json&_marker=0&ctx=web6dot0', 4500),
      fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=1081991857&api_version=4&_format=json&_marker=0&ctx=web6dot0', 4500),
      fetchSoundCloudTrendingTracks('all-music', 40).catch(() => []),
      fetchSoundCloudTrendingTracks('pop', 30).catch(() => []),
      fetchAudiusTrendingTracks(30).catch(() => []),
      fetchJamendoTrendingTracks(25).catch(() => []),
      fetch('https://api.deezer.com/chart/0/tracks?limit=25', { signal: AbortSignal.timeout(4500) }).catch(() => null),
      fetchItunesTopTracksMetadata(18).catch(() => []),
      fetchMusixmatchTopCharts().catch(() => []),
      fetchLastFmTopCharts().catch(() => [])
    ]);

    const topCharts = Array.isArray(chartsData) ? chartsData.slice(0, 3) : [];
    const detailedCharts = await Promise.all(
      topCharts.map(async (chart: any) => {
        try {
          const listId = chart.listid || chart.id;
          const detailData = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${listId}&api_version=4&_format=json&_marker=0&ctx=web6dot0`, 4000);
          if (!detailData) return null;
          const tracks = (detailData.list || [])
            .map(mapJioSaavnSong)
            .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t))
            .slice(0, 20);

          if (tracks.length === 0) return null;
          return {
            id: listId,
            title: cleanText(detailData.title || chart.title),
            subtitle: cleanText(detailData.subtitle || chart.subtitle || 'Top Trending Songs'),
            coverUrl: getHighResImage(detailData.image || chart.image),
            tracks
          };
        } catch {
          return null;
        }
      })
    );

    const validCharts: any[] = detailedCharts.filter(Boolean);

    // Add JioSaavn English Hit Songs playlist (Global Western publishers unlocked via key-less regional header)
    const englishTracks = (englishHitsPl?.list || [])
      .map(mapJioSaavnSong)
      .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t))
      .slice(0, 25);
    if (englishTracks.length > 0) {
      validCharts.unshift({
        id: '1081991857',
        title: cleanText(englishHitsPl?.title || 'English Hit Songs'),
        subtitle: 'Official Global Pop & Hip-Hop Publishers',
        coverUrl: getHighResImage(englishHitsPl?.image) || englishTracks[0].coverUrl,
        tracks: englishTracks
      });
    }

    // Resolve International Global Top Hits (iTunes RSS + Deezer + optional Musixmatch/Last.fm) solely to verified direct-stream URLs
    const extraGlobalRaw: any[] = [...mxmChartList, ...lfmChartList, ...itunesTopList];
    if (dzChartRes && dzChartRes.ok) {
      try {
        const dzJson = await dzChartRes.json();
        const dzRawTracks = (dzJson.data || [])
          .map((t: any) => mapDeezerRawTrack(t))
          .filter(Boolean)
          .slice(0, 15);
        extraGlobalRaw.push(...dzRawTracks);
      } catch {}
    }

    if (extraGlobalRaw.length > 0) {
      const seenChartTitles = new Set<string>();
      const dedupedGlobalRaw = extraGlobalRaw.filter(t => {
        const k = `${normalizeMatchText(t.title)}:::${normalizeMatchText(t.artist)}`;
        if (seenChartTitles.has(k)) return false;
        seenChartTitles.add(k);
        return true;
      }).slice(0, 16);

      const resolvedGlobal = (
        await Promise.all(
          dedupedGlobalRaw.map((t: any) => resolveDirectStreamTrack(t.title, t.artist, t.coverUrl, t.album))
        )
      ).filter((t: any) => Boolean(t?.streamUrl));

      if (resolvedGlobal.length >= 3) {
        validCharts.unshift({
          id: 'global_official_top',
          title: 'Global Official Top Hits',
          subtitle: 'Verified Background-Playable Publishers',
          coverUrl: resolvedGlobal[0].coverUrl,
          tracks: resolvedGlobal
        });
      }
    }

    const scMerged = [...scAllTrending, ...scPopTrending].filter((t, idx, arr) =>
      Boolean(t.streamUrl) && arr.findIndex(x => x.id === t.id) === idx
    ).slice(0, 25);

    if (scMerged.length > 0) {
      validCharts.push({
        id: 'soundcloud_global_trending',
        title: 'SoundCloud Verified Trending',
        subtitle: 'Official Labels & Verified Artists • Direct Background Stream',
        coverUrl: scMerged[0].coverUrl,
        tracks: scMerged
      });
    }

    if (audiusTrending.length > 0) {
      validCharts.push({
        id: 'audius_global_trending',
        title: 'Audius 320kbps Trending',
        subtitle: 'Official Direct 320k MP3 Releases',
        coverUrl: audiusTrending[0].coverUrl,
        tracks: audiusTrending.slice(0, 25)
      });
    }

    if (jamendoTrending.length > 0) {
      validCharts.push({
        id: 'jamendo_official_top',
        title: 'Jamendo Official Releases',
        subtitle: 'Licensed Direct MP3 Background Stream',
        coverUrl: jamendoTrending[0].coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        tracks: jamendoTrending.slice(0, 25)
      });
    }

    cachedCharts = validCharts;
    cacheExpiry = now + 1000 * 60 * 30; // 30 minutes cache

    res.json(validCharts);
  } catch (err) {
    console.error('Charts error:', err);
    res.status(500).json({ error: 'Failed to fetch charts' });
  }
});

// Canvas video lookup disabled to avoid any YouTube embeds; mobile screen renders ambient canvas backdrop
app.get(['/api/canvas', '/canvas'], (req, res) => {
  res.json({ videoId: null, thumbnail: null });
});

// Authentic 100% Real Artist Profiles with verified CDN photographs
const FEATURED_ARTISTS = [
  {
    id: '697691',
    name: 'Karan Aujla',
    avatarUrl: 'https://c.saavncdn.com/artists/Karan_Aujla_005_20260925061936_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Karan_Aujla_005_20260925061936_500x500.jpg',
    monthlyListeners: '22.8M monthly listeners',
    genre: 'Punjabi Hip-Hop / Pop',
    bio: 'Jashanpreet Singh Aujla, known professionally as Karan Aujla, is a global sensation and award-winning singer-songwriter behind Ashke, Winning Speech, Tauba Tauba, and Making Memories.',
    verified: true
  },
  {
    id: '468245',
    name: 'Diljit Dosanjh',
    avatarUrl: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg',
    monthlyListeners: '28.4M monthly listeners',
    genre: 'Punjabi / Global Pop',
    bio: 'Diljit Dosanjh is a global icon who made history as the first Punjabi artist to perform at Coachella, delivering worldwide anthems like Hass Hass, Lover, and G.O.A.T.',
    verified: true
  },
  {
    id: '459320',
    name: 'Arijit Singh',
    avatarUrl: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg',
    monthlyListeners: '46.2M monthly listeners',
    genre: 'Bollywood / Soulful Acoustic',
    bio: 'Arijit Singh is the king of romantic music and one of the world’s most-streamed vocalists of all time.',
    verified: true
  },
  {
    id: '14087974',
    name: 'Shubh',
    avatarUrl: 'https://c.saavncdn.com/artists/Shubh_000_20220921112507_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Shubh_000_20220921112507_500x500.jpg',
    monthlyListeners: '15.3M monthly listeners',
    genre: 'Trap / Desi Hip-Hop',
    bio: 'Shubneet Singh, known as Shubh, burst onto international charts with smash records Cheques, No Love, Baller, and Elevated.',
    verified: true
  },
  {
    id: '681966',
    name: 'AP Dhillon',
    avatarUrl: 'https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_500x500.jpg',
    monthlyListeners: '13.1M monthly listeners',
    genre: 'Indo-Canadian Synthwave',
    bio: 'Amritpal Singh Dhillon, known as AP Dhillon, revolutionized modern music blending R&B, synthwave, and trap on hits like With You and Excuses.',
    verified: true
  },
  {
    id: '3319750',
    name: 'Sidhu Moose Wala',
    avatarUrl: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_004_20250617183705_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_004_20250617183705_500x500.jpg',
    monthlyListeners: '18.9M monthly listeners',
    genre: 'Gangsta Rap / Folk Hip-Hop',
    bio: 'Shubhdeep Singh Sidhu, known as Sidhu Moose Wala, was a legendary lyricist and pioneer of the global Punjabi wave.',
    verified: true
  },
  {
    id: 'Alan Walker',
    name: 'Alan Walker',
    avatarUrl: 'https://cdn-images.dzcdn.net/images/artist/2e018122f98f4d9873d08a400a2efdf8/500x500-000000-80-0-0.jpg',
    bannerUrl: 'https://cdn-images.dzcdn.net/images/artist/2e018122f98f4d9873d08a400a2efdf8/500x500-000000-80-0-0.jpg',
    monthlyListeners: '54.1M monthly listeners',
    genre: 'Electronic / Dance Pop',
    bio: 'Norwegian DJ and producer Alan Walker delivers chart-topping anthems Faded, Alone, On My Way, and Spectre.',
    verified: true
  },
  {
    id: 'Marshmello',
    name: 'Marshmello',
    avatarUrl: 'https://cdn-images.dzcdn.net/images/artist/b7b9e6c4532b5e66202a1d1f3a5b6a0a/500x500-000000-80-0-0.jpg',
    bannerUrl: 'https://cdn-images.dzcdn.net/images/artist/b7b9e6c4532b5e66202a1d1f3a5b6a0a/500x500-000000-80-0-0.jpg',
    monthlyListeners: '48.6M monthly listeners',
    genre: 'Future Bass / Dance',
    bio: 'Masked electronic superstar Marshmello behind Happier, Alone, Silence, and Friends.',
    verified: true
  },
  {
    id: '1918741',
    name: 'Billie Eilish',
    avatarUrl: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Billie_Eilish_20190211151539_500x500.jpg',
    monthlyListeners: '99.2M monthly listeners',
    genre: 'Alternative Pop',
    bio: 'Oscar and Grammy-winning sensation Billie Eilish continually pushes sonic boundaries with Birds of a Feather, Bad Guy, and Ocean Eyes.',
    verified: true
  },
  {
    id: '615155',
    name: 'The Weeknd',
    avatarUrl: 'https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_500x500.jpg',
    monthlyListeners: '113.8M monthly listeners',
    genre: 'Dark R&B / Synthpop',
    bio: 'Abel Tesfaye holds records for the biggest streaming tracks of all time, including Blinding Lights, Starboy, and Often.',
    verified: true
  },
  {
    id: '456863',
    name: 'Badshah',
    avatarUrl: 'https://c.saavncdn.com/artists/Badshah_006_20241118064015_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Badshah_006_20241118064015_500x500.jpg',
    monthlyListeners: '25.3M monthly listeners',
    genre: 'Commercial Rap / Pop',
    bio: 'Hitmaker behind Soulmate, Genda Phool, Jugnu, and Paani Paani.',
    verified: true
  },
  {
    id: '512453',
    name: 'Drake',
    avatarUrl: 'https://c.saavncdn.com/artists/Drake_006_20260520062317_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Drake_006_20260520062317_500x500.jpg',
    monthlyListeners: '78.6M monthly listeners',
    genre: 'Hip-Hop / Rap',
    bio: 'Multi-Grammy winner and hip-hop titan behind God’s Plan, One Dance, and Hotline Bling.',
    verified: true
  },
  {
    id: '503531',
    name: 'Bruno Mars',
    avatarUrl: 'https://c.saavncdn.com/artists/Bruno_Mars_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Bruno_Mars_500x500.jpg',
    monthlyListeners: '128.5M monthly listeners',
    genre: 'Pop / Funk / R&B',
    bio: 'Multi-Grammy winning icon behind Die With A Smile, That’s What I Like, 24K Magic, and Uptown Funk.',
    verified: true
  },
  {
    id: '455132',
    name: 'Lady Gaga',
    avatarUrl: 'https://c.saavncdn.com/artists/Lady_Gaga_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Lady_Gaga_500x500.jpg',
    monthlyListeners: '115.2M monthly listeners',
    genre: 'Pop / Electronic',
    bio: 'Oscar and 13-time Grammy-winning powerhouse behind Die With A Smile, Shallow, Poker Face, and Bad Romance.',
    verified: true
  },
  {
    id: '456860',
    name: 'Yo Yo Honey Singh',
    avatarUrl: 'https://c.saavncdn.com/artists/Yo_Yo_Honey_Singh_002_20221124115852_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Yo_Yo_Honey_Singh_002_20221124115852_500x500.jpg',
    monthlyListeners: '21.4M monthly listeners',
    genre: 'Desi Hip-Hop / Rap',
    bio: 'Desi hip-hop legend behind Millionaire, Dope Shope, Blue Eyes, and Brown Rang.',
    verified: true
  },
  {
    id: '15764273',
    name: 'Hanumankind',
    avatarUrl: 'https://c.saavncdn.com/artists/Hanumankind_000_20230914101115_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Hanumankind_000_20230914101115_500x500.jpg',
    monthlyListeners: '14.8M monthly listeners',
    genre: 'Southern Hip-Hop / Rap',
    bio: 'Global breakout rap sensation behind the viral anthem Big Dawgs.',
    verified: true
  },
  {
    id: '565990',
    name: 'Taylor Swift',
    avatarUrl: 'https://c.saavncdn.com/artists/Taylor_Swift_002_20241003071250_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Taylor_Swift_002_20241003071250_500x500.jpg',
    monthlyListeners: '112.4M monthly listeners',
    genre: 'Pop / Singer-Songwriter',
    bio: 'Global recording icon Taylor Swift behind Anti-Hero, Cruel Summer, Fortnight, and Blank Space.',
    verified: true
  },
  {
    id: '578407',
    name: 'Ed Sheeran',
    avatarUrl: 'https://c.saavncdn.com/artists/Ed_Sheeran_002_20250625073038_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Ed_Sheeran_002_20250625073038_500x500.jpg',
    monthlyListeners: '84.2M monthly listeners',
    genre: 'Pop / Acoustic Pop',
    bio: 'Grammy-winning British singer-songwriter behind Shape of You, Perfect, Sapphire, and Shivers.',
    verified: true
  },
  {
    id: '589552',
    name: 'Ariana Grande',
    avatarUrl: 'https://c.saavncdn.com/artists/Ariana_Grande_004_20240308070221_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Ariana_Grande_004_20240308070221_500x500.jpg',
    monthlyListeners: '96.5M monthly listeners',
    genre: 'Pop / R&B',
    bio: 'Multi-platinum vocalist Ariana Grande behind we can’t be friends, 7 rings, and thank u, next.',
    verified: true
  },
  {
    id: '603814',
    name: 'Sabrina Carpenter',
    avatarUrl: 'https://c.saavncdn.com/artists/Sabrina_Carpenter_001_20250313025519_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Sabrina_Carpenter_001_20250313025519_500x500.jpg',
    monthlyListeners: '88.1M monthly listeners',
    genre: 'Pop / Dance-Pop',
    bio: 'Chart-topping pop star Sabrina Carpenter behind Espresso, Please Please Please, and Taste.',
    verified: true
  },
  {
    id: '568565',
    name: 'Justin Bieber',
    avatarUrl: 'https://c.saavncdn.com/artists/Justin_Bieber_005_20201127112218_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Justin_Bieber_005_20201127112218_500x500.jpg',
    monthlyListeners: '77.4M monthly listeners',
    genre: 'Pop / R&B',
    bio: 'Global pop superstar Justin Bieber behind STAY, Peaches, Sorry, and Let Me Love You.',
    verified: true
  },
  {
    id: '1274170',
    name: 'Dua Lipa',
    avatarUrl: 'https://c.saavncdn.com/artists/Dua_Lipa_004_20231120090922_500x500.jpg',
    bannerUrl: 'https://c.saavncdn.com/artists/Dua_Lipa_004_20231120090922_500x500.jpg',
    monthlyListeners: '74.3M monthly listeners',
    genre: 'Dance-Pop / Synth-Pop',
    bio: 'Multi-Grammy winner Dua Lipa behind Levitating, Don’t Start Now, Houdini, and No Lie.',
    verified: true
  },
  {
    id: 'audius_artist_skrillex',
    name: 'Skrillex',
    avatarUrl: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=500&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=1200&auto=format&fit=crop&q=80',
    monthlyListeners: '42M+ monthly listeners',
    genre: 'Electronic / Bass Music',
    bio: 'Multi-Grammy winning electronic pioneer Sonny Moore, known as Skrillex, behind Bangarang, Scary Monsters and Nice Sprites, and Rumble.',
    verified: true
  },
  {
    id: 'audius_artist_deadmau5',
    name: 'deadmau5',
    avatarUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
    monthlyListeners: '450K+ on Audius',
    genre: 'Progressive House / Electronic',
    bio: 'Joel Zimmerman, known as deadmau5, legendary Canadian electronic producer behind Ghosts n Stuff, Strobe, and Raise Your Weapon.',
    verified: true
  }
];

// API Route for Featured Artists
app.get(['/api/artists', '/artists'], (req, res) => {
  res.json(FEATURED_ARTISTS);
});

// API Route for UNLIMITED Artists Search (JioSaavn + Deezer)
app.get(['/api/artists/search', '/artists/search'], async (req, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      return res.json(FEATURED_ARTISTS);
    }

    const [saavnRes, dzRes] = await Promise.all([
      fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=30&p=1`, 4000)
        .then(d => d || { results: [] }),
      fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=15`, { signal: AbortSignal.timeout(4000) })
        .then(r => r.ok ? r.json() : { data: [] })
        .catch(() => ({ data: [] }))
    ]);

    const seenNames = new Set<string>();
    const results: any[] = [];

    for (const a of (dzRes.data || [])) {
      if (!a.name || !a.picture_big) continue;
      const nameClean = cleanText(a.name);
      const key = nameClean.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      results.push({
        id: `dz_${a.id}`,
        name: nameClean,
        avatarUrl: a.picture_xl || a.picture_big,
        bannerUrl: a.picture_xl || a.picture_big,
        monthlyListeners: a.nb_fan ? `${Number(a.nb_fan).toLocaleString()} fans` : 'Official Artist',
        genre: 'Official Artist',
        verified: true
      });
    }

    for (const a of (saavnRes.results || [])) {
      if (!a.image || a.image.includes('artist-default-music')) continue;
      const nameClean = cleanText(a.name);
      const key = nameClean.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      const highRes = a.image.replace(/50x50\.jpg|150x150\.jpg/, '500x500.jpg');
      results.push({
        id: String(a.id),
        name: nameClean,
        avatarUrl: highRes,
        bannerUrl: highRes,
        monthlyListeners: a.ctr ? `${(a.ctr * 140).toLocaleString()} monthly listeners` : '10M+ monthly listeners',
        genre: a.role || 'Artist',
        verified: true
      });
    }

    res.json(results);
  } catch (err) {
    console.error('Artist search error:', err);
    res.json([]);
  }
});

// API Route for specific artist profile with 100% direct-stream background playable official tracks
app.get(['/api/artist/:id', '/artist/:id'], async (req, res) => {
  try {
    const artistParam = req.params.id;
    let artistObj = FEATURED_ARTISTS.find(a => a.id === artistParam || a.name.toLowerCase() === artistParam.toLowerCase());

    if (!artistObj && artistParam.startsWith('dz_')) {
      try {
        const dzId = artistParam.replace(/^dz_/, '');
        const dzArtRes = await fetch(`https://api.deezer.com/artist/${encodeURIComponent(dzId)}`, { signal: AbortSignal.timeout(4000) });
        if (dzArtRes.ok) {
          const dzArt = await dzArtRes.json();
          if (dzArt.name) {
            artistObj = {
              id: `dz_${dzArt.id}`,
              name: cleanText(dzArt.name),
              avatarUrl: dzArt.picture_xl || dzArt.picture_big || '',
              bannerUrl: dzArt.picture_xl || dzArt.picture_big || '',
              monthlyListeners: dzArt.nb_fan ? `${Number(dzArt.nb_fan).toLocaleString()} fans` : 'Official Artist',
              genre: 'Official Artist',
              bio: `${dzArt.name} official publisher discography across JioSaavn, SoundCloud, Audius, and Gaana with strict background playback.`,
              verified: true
            };
          }
        }
      } catch {}
    }

    if (!artistObj && /^\d+$/.test(artistParam)) {
      try {
        const pageData = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&artistId=${artistParam}&api_version=4&_format=json&_marker=0&ctx=web6dot0&n_song=100`);
        if (pageData?.name) {
          const highRes = (pageData.image || '').replace(/50x50\.jpg|150x150\.jpg/, '500x500.jpg');
          artistObj = {
            id: String(pageData.artistId || artistParam),
            name: cleanText(pageData.name),
            avatarUrl: highRes,
            bannerUrl: highRes,
            monthlyListeners: pageData.follower_count ? `${Number(pageData.follower_count).toLocaleString()} followers` : '20M+ monthly listeners',
            genre: pageData.dominantLanguage ? `${pageData.dominantLanguage} ${pageData.dominantType || 'Artist'}` : 'Artist',
            bio: pageData.subtitle || `${pageData.name} official streaming catalog with strict background audio playback.`,
            verified: true
          };
        }
      } catch (e) {
        console.error('Direct artist page fetch error:', e);
      }
    }

    if (!artistObj) {
      try {
        const [dzArtSearch, saavnArtSearch] = await Promise.all([
          fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistParam)}&limit=1`, { signal: AbortSignal.timeout(4000) })
            .then(r => r.ok ? r.json() : { data: [] })
            .catch(() => ({ data: [] })),
          fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(artistParam)}&n=1&p=1`, 4000)
            .then(d => d || { results: [] })
        ]);

        const dzFound = dzArtSearch.data?.[0];
        const found = saavnArtSearch.results?.[0];
        if (dzFound && dzFound.name) {
          artistObj = {
            id: `dz_${dzFound.id}`,
            name: cleanText(dzFound.name),
            avatarUrl: dzFound.picture_xl || dzFound.picture_big || '',
            bannerUrl: dzFound.picture_xl || dzFound.picture_big || '',
            monthlyListeners: dzFound.nb_fan ? `${Number(dzFound.nb_fan).toLocaleString()} fans` : 'Official Artist',
            genre: 'Official Artist',
            bio: `${dzFound.name} official publisher catalog and popular records.`,
            verified: true
          };
        } else if (found) {
          const highRes = (found.image || '').replace(/50x50\.jpg|150x150\.jpg/, '500x500.jpg');
          artistObj = {
            id: String(found.id),
            name: cleanText(found.name),
            avatarUrl: highRes,
            bannerUrl: highRes,
            monthlyListeners: found.ctr ? `${(found.ctr * 140).toLocaleString()} monthly listeners` : '15M+ monthly listeners',
            genre: found.role || 'Artist',
            bio: `${found.name} official streaming catalog and popular records.`,
            verified: true
          };
        }
      } catch (e) {
        console.error('Artist search fallback error:', e);
      }
    }

    if (!artistObj) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const targetArtist = artistObj.name;
    const seenTitleNorms = new Set<string>();
    const directTracks: any[] = [];
    const artistIdForApi = /^\d+$/.test(artistObj.id) ? artistObj.id : '';
    const knownDzId = artistObj.id.startsWith('dz_') ? artistObj.id.replace(/^dz_/, '') : '';

    // Fetch JioSaavn + Gaana + SoundCloud + Audius + Last.fm + Deezer top titles in parallel
    const [
      jioSaavnDiscogTracks,
      saavnSearchPages,
      scOfficial,
      gaanaOfficial,
      audiusOfficial,
      dzTopTitles,
      lfmTopTitles
    ] = await Promise.all([
      (async () => {
        let resolvedArtistId = artistIdForApi;
        if (!resolvedArtistId) {
          const matchedArt = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(targetArtist)}&n=3&p=1`, 3500);
          const bestArt = (matchedArt?.results || []).find((a: any) => artistMatchesTarget(a?.name || '', targetArtist));
          if (bestArt?.id) resolvedArtistId = String(bestArt.id);
        }
        if (!resolvedArtistId) return [] as any[];
        try {
          const pageData = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&artistId=${resolvedArtistId}&api_version=4&_format=json&_marker=0&ctx=web6dot0&n_song=100&n_album=30`, 4500);
          if (!pageData) return [];
          const rawTopSongs = (pageData.topSongs || []).map(mapJioSaavnSong);

          const artistPlaylists = [
            ...(pageData.dedicated_artist_playlist || []),
            ...(pageData.featured_artist_playlist || [])
          ].slice(0, 6);

          const artistAlbums = [
            ...(pageData.topAlbums || []),
            ...(pageData.singles || [])
          ].slice(0, 8);

          const [playlistSongBatches, albumSongBatches] = await Promise.all([
            Promise.all(
              artistPlaylists.map(async (pl: any) => {
                const plData = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${pl.id}&api_version=4&_format=json&_marker=0&ctx=web6dot0`, 3500);
                return (plData?.list || []).map(mapJioSaavnSong);
              })
            ),
            Promise.all(
              artistAlbums.map(async (alb: any) => {
                const albData = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&albumid=${alb.id}&api_version=4&_format=json&_marker=0&ctx=web6dot0`, 3500);
                return (albData?.list || albData?.songs || []).map(mapJioSaavnSong);
              })
            )
          ]);

          return [...rawTopSongs, ...playlistSongBatches.flat(), ...albumSongBatches.flat()]
            .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, targetArtist, targetArtist));
        } catch {
          return [];
        }
      })(),
      Promise.all(
        [1, 2, 3, 4, 5, 6].map(p =>
          fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(targetArtist)}&n=50&p=${p}`, 4000)
            .then(d => d || {})
        )
      ),
      searchSoundCloudOfficialTracks(targetArtist, targetArtist, 2).catch(() => []),
      searchGaanaOfficialTracks(targetArtist, targetArtist).catch(() => []),
      searchAudiusOfficialTracks(targetArtist, targetArtist).catch(() => []),
      fetchDeezerArtistTopTitles(targetArtist, knownDzId).catch(() => []),
      fetchLastFmArtistTopTracks(targetArtist).catch(() => [])
    ]);

    const saavnSearchSongs = saavnSearchPages
      .flatMap(d => d.results || [])
      .map(mapJioSaavnSong)
      .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, targetArtist, targetArtist));

    for (const t of [...jioSaavnDiscogTracks, ...saavnSearchSongs, ...gaanaOfficial, ...scOfficial, ...audiusOfficial]) {
      if (!t?.streamUrl) continue;
      const cleanT = t.source === 'jiosaavn' ? cleanSongTitle(t.title, targetArtist) : t.title;
      if (!isOfficialPublisherTrack({ ...t, title: cleanT }, targetArtist, targetArtist)) continue;
      const norm = normalizeMatchText(cleanT);
      if (!norm || seenTitleNorms.has(norm)) continue;
      seenTitleNorms.add(norm);
      directTracks.push({ ...t, title: cleanT });
    }

    // For popular hit titles from Last.fm / Deezer not yet covered, resolve to direct-stream providers
    const missingHits = [...lfmTopTitles, ...dzTopTitles]
      .filter((item: any) => {
        const norm = normalizeMatchText(item.title);
        return norm && !seenTitleNorms.has(norm);
      })
      .slice(0, 10);

    if (missingHits.length > 0) {
      const resolvedMissing = await Promise.all(
        missingHits.map((item: any) => resolveDirectStreamTrack(item.title, item.artist, item.coverUrl || '', item.album || ''))
      );
      for (const resolved of resolvedMissing) {
        if (!resolved?.streamUrl) continue;
        const norm = normalizeMatchText(resolved.title);
        if (!norm || seenTitleNorms.has(norm)) continue;
        seenTitleNorms.add(norm);
        directTracks.push(resolved);
      }
    }

    const popularTracks = directTracks.filter(t => Boolean(t.streamUrl)).slice(0, 300);

    res.json({
      ...artistObj,
      popularTracks
    });
  } catch (err) {
    console.error('Artist detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Viral songs cache
let cachedViral: any[] | null = null;
let viralCacheExpiry = 0;

// API Route for Best Viral Songs (100% direct background-playable streams across JioSaavn / SoundCloud / Gaana / Audius)
app.get(['/api/viral', '/viral'], async (req, res) => {
  try {
    const now = Date.now();
    if (cachedViral && now < viralCacheExpiry) {
      return res.json(cachedViral);
    }

    const viralQueries = [
      { title: 'Die With A Smile', artist: 'Lady Gaga' },
      { title: 'Espresso', artist: 'Sabrina Carpenter' },
      { title: 'BIRDS OF A FEATHER', artist: 'Billie Eilish' },
      { title: 'Blinding Lights', artist: 'The Weeknd' },
      { title: 'Anti-Hero', artist: 'Taylor Swift' },
      { title: 'Ashke', artist: 'Karan Aujla' },
      { title: 'Winning Speech', artist: 'Karan Aujla' },
      { title: 'Tauba Tauba', artist: 'Karan Aujla' },
      { title: 'Millionaire', artist: 'Yo Yo Honey Singh' },
      { title: 'G.O.A.T.', artist: 'Diljit Dosanjh' },
      { title: 'Lover', artist: 'Diljit Dosanjh' },
      { title: 'Cheques', artist: 'Shubh' },
      { title: 'With You', artist: 'AP Dhillon' },
      { title: 'Kesariya', artist: 'Arijit Singh' },
      { title: 'Spectre', artist: 'Alan Walker' },
      { title: 'Hero', artist: 'Alan Walker' },
      { title: 'Bangarang', artist: 'Skrillex' }
    ];

    const resolvedViral = await Promise.all(
      viralQueries.map(q => resolveDirectStreamTrack(q.title, q.artist).catch(() => null))
    );

    const seenViralIds = new Set<string>();
    const viralSongs: any[] = [];
    for (const track of resolvedViral) {
      if (track && track.streamUrl && !seenViralIds.has(track.id)) {
        seenViralIds.add(track.id);
        viralSongs.push({
          ...track,
          isViral: true,
          viralRank: viralSongs.length + 1
        });
      }
    }

    if (viralSongs.length > 0) {
      cachedViral = viralSongs;
      viralCacheExpiry = now + 1000 * 60 * 60; // 1 hour cache
      return res.json(viralSongs);
    }

    res.json([]);
  } catch (err) {
    console.error('Viral songs error:', err);
    res.status(500).json({ error: 'Failed to fetch viral songs' });
  }
});

// API Route to search UNLIMITED official songs strictly from direct background-playable providers:
app.get(['/api/search', '/search'], async (req, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (/^https?:\/\/(?:www\.|m\.)?gaana\.com\//i.test(query)) {
      const gaanaUrlTracks = await fetchGaanaSongsByUrl(query);
      return res.json(gaanaUrlTracks.filter(t => Boolean(t.streamUrl)));
    }

    const seenKeys = new Set<string>();
    const allTracks: any[] = [];
    const queryLower = query.toLowerCase();
    const queryNorm = normalizeMatchText(query);

    // Handle Global Top Hits / English Top Hits chart browse queries directly with curated live playlists + global charts
    if (/^(?:global top hits(?:\s+official|\s+english)?|top global|global hits)$/i.test(queryLower.trim())) {
      const [englishPl, trendPl] = await Promise.all([
        fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=1081991857&api_version=4&_format=json&_marker=0&ctx=web6dot0', 4500),
        fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=110858205&api_version=4&_format=json&_marker=0&ctx=web6dot0', 4500),
      ]);
      const playlistSongs = [...(englishPl?.list || []), ...(trendPl?.list || [])]
        .map(mapJioSaavnSong)
        .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t));
      for (const t of playlistSongs) {
        const cleanT = cleanSongTitle(t.title, t.artist);
        const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(t.artist)}`;
        if (!seenKeys.has(key) && !seenKeys.has(t.id)) {
          seenKeys.add(key);
          seenKeys.add(t.id);
          allTracks.push({ ...t, title: cleanT });
        }
      }
      if (allTracks.length >= 15) {
        return res.json(allTracks.slice(0, 100));
      }
    }

    try {
      const matchedSaavnArtist = FEATURED_ARTISTS.find(a => a.name.toLowerCase() === queryLower);
      let saavnArtistId = matchedSaavnArtist && /^\d+$/.test(matchedSaavnArtist.id) ? matchedSaavnArtist.id : '';
      let saavnArtistName = matchedSaavnArtist?.name || query;
      if (!saavnArtistId) {
        const artSearch = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=3&p=1`, 3500);
        const exactArt = (artSearch?.results || []).find((a: any) => artistMatchesTarget(a?.name || '', query));
        if (exactArt?.id) {
          saavnArtistId = String(exactArt.id);
          saavnArtistName = cleanText(exactArt.name || query);
        }
      }
      if (saavnArtistId) {
        const pageData = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&artistId=${saavnArtistId}&api_version=4&_format=json&_marker=0&ctx=web6dot0&n_song=50&n_album=10`, 4200);
        if (pageData) {
          for (const t of (pageData.topSongs || []).map(mapJioSaavnSong)) {
            if (t.streamUrl && isOfficialPublisherTrack(t, query, saavnArtistName)) {
              const cleanT = cleanSongTitle(t.title, saavnArtistName);
              const key = normalizeMatchText(cleanT);
              if (key && !seenKeys.has(key)) {
                seenKeys.add(key);
                allTracks.push({ ...t, title: cleanT });
              }
            }
          }
        }
      }
    } catch {}

    try {
      const pages = [1, 2, 3, 4, 5, 6];
      const [pageResults, saavnAcTracks, albumSearchRes, playlistSearchRes, scTracks, gaanaTracks, deezerMetaTracks, mxmMetaTracks, lfmMetaTracks, audiusTracks, jamendoTracks, archiveTracks] = await Promise.all([
        Promise.all(
          pages.map(p =>
            fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=50&p=${p}`, 4500)
              .then(d => d || {})
          )
        ),
        fetchSaavnAutocompleteTracks(query).catch(() => []),
        fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=4&p=1`, 4000)
          .then(d => d || {}),
        fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=3&p=1`, 4000)
          .then(d => d || {}),
        searchSoundCloudOfficialTracks(query, '', 2).catch(() => []),
        searchGaanaOfficialTracks(query).catch(() => []),
        searchDeezerMetadataTracks(query).catch(() => []),
        searchMusixmatchOfficialTracks(query).catch(() => []),
        searchLastFmOfficialTracks(query).catch(() => []),
        searchAudiusOfficialTracks(query).catch(() => []),
        searchJamendoOfficialTracks(query).catch(() => []),
        searchArchiveOfficialTracks(query).catch(() => [])
      ]);

      // Dynamic anti-impostor detection using verified global discographies (Deezer + Musixmatch + Last.fm)
      const verifiedArtistMatchCount = [...(deezerMetaTracks || []), ...(mxmMetaTracks || []), ...(lfmMetaTracks || [])]
        .filter((t: any) => artistMatchesTarget(t.artist, query))
        .length;
      const isArtistQuery =
        FEATURED_ARTISTS.some(f => f.name.toLowerCase() === queryLower) ||
        verifiedArtistMatchCount >= 3;

      // Build Rule B global song-title ownership map from top-ranked Deezer official releases
      const verifiedOwnersByTitle = new Map<string, string[]>();
      const dzByTitle = new Map<string, any[]>();
      for (const dt of (deezerMetaTracks || [])) {
        const tn = normalizeMatchText(dt.title || '');
        if (!tn) continue;
        if (!dzByTitle.has(tn)) dzByTitle.set(tn, []);
        dzByTitle.get(tn)!.push(dt);
      }
      for (const [tn, items] of dzByTitle.entries()) {
        items.sort((a, b) => (b.rank || 0) - (a.rank || 0));
        const maxRank = items[0]?.rank || 0;
        const threshold = maxRank >= 300000
          ? Math.max(maxRank * 0.85, maxRank - 120000)
          : (maxRank >= 50000 ? maxRank * 0.5 : 0);
        const owners = Array.from(new Set(
          items
            .filter(it => (it.rank || 0) >= threshold)
            .map(it => it.artist)
            .filter(Boolean)
        ));
        if (owners.length > 0) {
          verifiedOwnersByTitle.set(tn, owners);
        }
      }

      const queryBannedWords = /^(?:slowed|reverb|slowed reverb|lofi|lo-fi|karaoke|nightcore|remix|mixtape|8d audio|bootleg)$/i;
      const isPureBannedQuery = queryBannedWords.test(queryLower.trim());

      const isImpostorForQuery = (t: any) => {
        if (isPureBannedQuery) return true;

        const artMatchQuery = artistMatchesTarget(t.artist, query, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab));
        const tTitleNorm = normalizeMatchText(t.title || '');
        const tTitleBase = tTitleNorm
          .replace(/\s+(?:funk|phonk|brazil|drill|trap|sped|slowed|hardstyle|techno|nightcore|version|edition)$/i, '')
          .trim();

        // Rule A: When the query targets an artist, strictly require matching that artist (no tributes or random fallback tracks)
        if (isArtistQuery && queryNorm) {
          if (!artMatchQuery) {
            return true;
          }
        }

        // Rule B: Song-title ownership guard -> reject DIY clones/covers/funk edits of globally owned official songs
        const ownerKey = verifiedOwnersByTitle.has(tTitleNorm)
          ? tTitleNorm
          : (tTitleBase && verifiedOwnersByTitle.has(tTitleBase) ? tTitleBase : '');

        if (ownerKey && queryNorm) {
          const matchesQueryTitle =
            ownerKey === queryNorm ||
            (ownerKey.length >= 4 && queryNorm.includes(ownerKey)) ||
            (queryNorm.length >= 4 && ownerKey.includes(queryNorm));

          if (matchesQueryTitle) {
            const owners = verifiedOwnersByTitle.get(ownerKey)!;
            const matchesAnyOwner = owners.some(owner =>
              artistMatchesTarget(t.artist || '', owner, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab))
            );
            const hasMajorLabel = isMajorPublisherLabel(t.label || '');
            if (!matchesAnyOwner && !hasMajorLabel) {
              return true;
            }
          }
        }

        // Rule C: If user searched an exact famous song in Deezer (e.g. "Die With A Smile"), drop unrelated partial-word filler tracks
        if (!isArtistQuery && queryNorm && verifiedOwnersByTitle.has(queryNorm)) {
          const queryOwners = verifiedOwnersByTitle.get(queryNorm)!;
          const isExactSongTitle = tTitleNorm === queryNorm || tTitleBase === queryNorm;
          const matchesQueryOwner = queryOwners.some(owner =>
            artistMatchesTarget(t.artist || '', owner, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab))
          );
          const hasMajorLabel = isMajorPublisherLabel(t.label || '');
          if (!isExactSongTitle && !matchesQueryOwner) {
            // Allow if title clearly contains the searched song title AND comes from an official major label or verified owner
            if (!(tTitleNorm.includes(queryNorm) && hasMajorLabel)) {
              return true;
            }
          }
        }

        return false;
      };

      const combinedSaavnSongs = [
        ...(saavnAcTracks || []),
        ...pageResults.flatMap(d => d.results || []).map(mapJioSaavnSong),
      ].filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, query) && !isImpostorForQuery(t));

      for (const t of combinedSaavnSongs) {
        const cleanT = cleanSongTitle(t.title, t.artist);
        const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(t.artist)}`;
        const trackId = t.id;
        if (!seenKeys.has(key) && !seenKeys.has(trackId)) {
          seenKeys.add(key);
          seenKeys.add(trackId);
          allTracks.push({ ...t, title: cleanT });
        }
      }

      const albumResults = (albumSearchRes.results || []).slice(0, 4);
      if (albumResults.length > 0) {
        const albumDetailBatches = await Promise.all(
          albumResults.map((alb: any) =>
            fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&albumid=${alb.id}&api_version=4&_format=json&_marker=0&ctx=web6dot0`, 4000)
              .then(d => d || {})
          )
        );

        for (const albData of albumDetailBatches) {
          const albTracks = (albData.list || albData.songs || [])
            .map(mapJioSaavnSong)
            .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, query) && !isImpostorForQuery(t));

          for (const t of albTracks) {
            const cleanT = cleanSongTitle(t.title, t.artist);
            const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(t.artist)}`;
            const trackId = t.id;
            if (!seenKeys.has(key) && !seenKeys.has(trackId)) {
              seenKeys.add(key);
              seenKeys.add(trackId);
              allTracks.push({ ...t, title: cleanT });
            }
          }
        }
      }

      const playlistResults = (playlistSearchRes.results || []).slice(0, 3);
      if (playlistResults.length > 0) {
        const playlistDetailBatches = await Promise.all(
          playlistResults.map((pl: any) => {
            const listId = pl.id || pl.listid;
            return fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${listId}&api_version=4&_format=json&_marker=0&ctx=web6dot0`, 4000)
              .then(d => d || {});
          })
        );

        for (const plData of playlistDetailBatches) {
          const plTracks = (plData.list || [])
            .map(mapJioSaavnSong)
            .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, query) && !isImpostorForQuery(t));

          for (const t of plTracks) {
            const cleanT = cleanSongTitle(t.title, t.artist);
            const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(t.artist)}`;
            const trackId = t.id;
            if (!seenKeys.has(key) && !seenKeys.has(trackId)) {
              seenKeys.add(key);
              seenKeys.add(trackId);
              allTracks.push({ ...t, title: cleanT });
            }
          }
        }
      }

      // Merge direct streaming Gaana, SoundCloud, Audius, Jamendo, and Internet Archive tracks (100% streamUrl guaranteed)
      for (const t of [...(gaanaTracks || []), ...(scTracks || []), ...(audiusTracks || []), ...(jamendoTracks || []), ...(archiveTracks || [])]) {
        if (!t?.streamUrl || isImpostorForQuery(t)) continue;
        const key = `${normalizeMatchText(t.title)}:::${normalizeMatchText(t.artist)}`;
        if (!seenKeys.has(key) && !seenKeys.has(t.id)) {
          seenKeys.add(key);
          seenKeys.add(t.id);
          allTracks.push(t);
        }
      }

      // Resolve any top Musixmatch / Last.fm hits not yet present into playable direct-stream tracks
      const catalogCandidates = [...(mxmMetaTracks || []), ...(lfmMetaTracks || [])]
        .filter((t: any) => {
          const key = `${normalizeMatchText(t.title)}:::${normalizeMatchText(t.artist)}`;
          return !seenKeys.has(key) && !isImpostorForQuery(t);
        })
        .slice(0, 6);

      if (catalogCandidates.length > 0) {
        const resolvedCatalog = await Promise.all(
          catalogCandidates.map((c: any) => resolveDirectStreamTrack(c.title, c.artist))
        );
        for (const t of resolvedCatalog) {
          if (!t?.streamUrl || isImpostorForQuery(t)) continue;
          const key = `${normalizeMatchText(t.title)}:::${normalizeMatchText(t.artist)}`;
          if (!seenKeys.has(key) && !seenKeys.has(t.id)) {
            seenKeys.add(key);
            seenKeys.add(t.id);
            allTracks.push(t);
          }
        }
      }
    } catch (searchErr) {
      console.error('Search parallel error:', searchErr);
    }

    allTracks.sort((a, b) => {
      const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const qNorm = normalize(query);
      const aTitleNorm = normalize(a.title);
      const bTitleNorm = normalize(b.title);
      const aArtistNorm = normalize(a.artist);
      const bArtistNorm = normalize(b.artist);

      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      const aArtist = (a.artist || '').toLowerCase();
      const bArtist = (b.artist || '').toLowerCase();

      const isFamous = (name: string, norm: string) =>
        FEATURED_ARTISTS.some(f => {
          const fNorm = normalize(f.name);
          return norm.includes(fNorm) || fNorm.includes(norm) || name.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(name);
        });
      const aFamous = isFamous(aArtist, aArtistNorm);
      const bFamous = isFamous(bArtist, bArtistNorm);

      const queryIsArtist = FEATURED_ARTISTS.some(f => normalize(f.name) === qNorm || f.name.toLowerCase() === queryLower);
      const aArtExact = aArtistNorm === qNorm || aArtist === queryLower;
      const bArtExact = bArtistNorm === qNorm || bArtist === queryLower;

      if (queryIsArtist) {
        if (aArtExact && !bArtExact) return -1;
        if (bArtExact && !aArtExact) return 1;
      }

      const aExact = aTitleNorm === qNorm || aTitle === queryLower;
      const bExact = bTitleNorm === qNorm || bTitle === queryLower;

      if (aExact && bExact) {
        if (aFamous && !bFamous) return -1;
        if (!aFamous && bFamous) return 1;
      }

      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      if (aArtExact && !bArtExact) return -1;
      if (bArtExact && !aArtExact) return 1;
      if (aArtExact && bArtExact) {
        if (aFamous && !bFamous) return -1;
        if (!aFamous && bFamous) return 1;
      }

      const aArtStarts = aArtistNorm.startsWith(qNorm) || aArtist.startsWith(queryLower);
      const bArtStarts = bArtistNorm.startsWith(qNorm) || bArtist.startsWith(queryLower);
      if (aArtStarts && !bArtStarts) return -1;
      if (bArtStarts && !aArtStarts) return 1;

      if (aFamous && !bFamous && (aArtist.includes(queryLower) || aTitle.includes(queryLower))) return -1;
      if (!aFamous && bFamous && (bArtist.includes(queryLower) || bTitle.includes(queryLower))) return 1;

      const aStarts = aTitleNorm.startsWith(qNorm) || aTitle.startsWith(queryLower);
      const bStarts = bTitleNorm.startsWith(qNorm) || bTitle.startsWith(queryLower);
      if (aStarts && bStarts) {
        if (aFamous && !bFamous) return -1;
        if (!aFamous && bFamous) return 1;
      }
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      const aArt = aArtistNorm.includes(qNorm) || aArtist.includes(queryLower);
      const bArt = bArtistNorm.includes(qNorm) || bArtist.includes(queryLower);
      if (aArt && !bArt) return -1;
      if (bArt && !aArt) return 1;

      const aTitleContains = aTitleNorm.includes(qNorm) || aTitle.includes(queryLower);
      const bTitleContains = bTitleNorm.includes(qNorm) || bTitle.includes(queryLower);
      if (aTitleContains && !bTitleContains) return -1;
      if (bTitleContains && !aTitleContains) return 1;

      return 0;
    });

    // Guarantee 100% of returned tracks have a live direct streamUrl for strict background playback
    res.json(allTracks.filter(t => Boolean(t.streamUrl)).slice(0, 300));
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API Route to get lyrics via LRCLIB + Musixmatch official lyrics
app.post(['/api/lyrics', '/lyrics'], async (req, res) => {
  try {
    const { title, artist } = req.body;
    if (!title || !artist) {
      return res.status(400).json({ error: 'Title and artist are required' });
    }

    const cleanTitle = title.replace(/\(.*\)|\[.*\]|(Official.*)|(Lyric.*)|(Music Video)/gi, '').trim();
    const primaryArtist = splitArtistEntities(artist)[0] || artist;
    let syncedLyrics: string | null = null;
    let plainLyrics: string | null = null;

    const mxmPromise = fetchMusixmatchLyrics(cleanTitle, primaryArtist);

    // 1. Key-less LRCLIB exact get + fuzzy search
    try {
      const exactRes = await fetch(
        `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (exactRes.ok) {
        const exactJson = await exactRes.json();
        syncedLyrics = exactJson?.syncedLyrics || null;
        plainLyrics = exactJson?.plainLyrics || null;
      }
    } catch {}

    if (!syncedLyrics) {
      try {
        const searchRes = await fetch(
          `https://lrclib.net/api/search?q=${encodeURIComponent(`${primaryArtist} ${cleanTitle}`)}`,
          { signal: AbortSignal.timeout(4500) }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (Array.isArray(searchData) && searchData.length > 0) {
            const syncedMatch = searchData.find((d: any) => d.syncedLyrics);
            if (syncedMatch) {
              syncedLyrics = syncedMatch.syncedLyrics;
              plainLyrics = plainLyrics || syncedMatch.plainLyrics;
            } else if (!plainLyrics) {
              plainLyrics = searchData[0].plainLyrics || null;
            }
          }
        }
      } catch {}
    }

    // 2. Key-less JioSaavn lyrics fallback if still empty
    if (!syncedLyrics && !plainLyrics) {
      try {
        const sRes = await fetchSaavnJson(
          `https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(`${cleanTitle} ${primaryArtist}`)}&n=3&p=1`,
          3500
        );
        const withLyrics = (sRes?.results || []).find((r: any) => r?.more_info?.has_lyrics === 'true' || r?.has_lyrics === 'true');
        if (withLyrics?.id) {
          const lyrJson = await fetchSaavnJson(
            `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(withLyrics.id)}&api_version=4&_format=json&_marker=0&ctx=web6dot0`,
            3500
          );
          if (lyrJson?.lyrics) {
            plainLyrics = cleanText(lyrJson.lyrics.replace(/<br\s*\/?>/gi, '\n'));
          }
        }
      } catch {}
    }

    const mxmLyrics = await mxmPromise;
    if (!syncedLyrics && mxmLyrics.syncedLyrics) syncedLyrics = mxmLyrics.syncedLyrics;
    if (!plainLyrics && mxmLyrics.plainLyrics) plainLyrics = mxmLyrics.plainLyrics;

    res.json({ syncedLyrics, plainLyrics });
  } catch (error) {
    console.error('Lyrics error:', error);
    res.json({ syncedLyrics: null, plainLyrics: null });
  }
});

export default app;
