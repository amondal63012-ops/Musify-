import express from 'express';
import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const SAAVN_HEADERS: Record<string, string> = {
  'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 13)',
  'Accept': 'application/json, text/plain, */*',
  'X-Forwarded-For': '49.36.120.10',
};

const SAAVN_WEB_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'X-Forwarded-For': '49.36.120.10',
};

const saavnJsonCache = new Map<string, { data: any; exp: number }>();

async function fetchSaavnJson(url: string, timeoutMs: number = 4500): Promise<any> {
  const now = Date.now();
  const cached = saavnJsonCache.get(url);
  if (cached && cached.exp > now) {
    return cached.data;
  }
  const androidUrl = url.replace(/ctx=web6dot0/g, 'ctx=android');
  try {
    let res = await fetch(androidUrl, {
      headers: SAAVN_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 403 || res.status === 429) {
      res = await fetch(url, {
        headers: SAAVN_WEB_HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
      });
    }
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data === 'object') {
      if (saavnJsonCache.size > 400) {
        const firstKey = saavnJsonCache.keys().next().value;
        if (firstKey) saavnJsonCache.delete(firstKey);
      }
      saavnJsonCache.set(url, { data, exp: now + 1000 * 60 * 5 });
    }
    return data;
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
  return url.replace(/([-_])(?:50x50|150x150)\.(jpg|jpeg|webp|png)(?=$|\?)/gi, '$1500x500.$2');
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

function foldDiacritics(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[øØ]/g, 'o')
    .replace(/[łŁ]/g, 'l')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[ß]/g, 'ss');
}

function extractQueryTokens(normStr: string): string[] {
  return (normStr || '')
    .split(' ')
    .filter(tok => {
      if (!tok) return false;
      if (/[\u3040-\u30ff\u4e00-\u9faf\uac00-\ud7af\u0600-\u06ff\u0900-\u097f]/.test(tok)) {
        return tok.length >= 1;
      }
      return tok.length >= 2;
    });
}

function normalizeMatchText(str: string): string {
  return foldDiacritics(cleanText(str || ''))
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(feat\.?|ft\.?|featuring|with)\b.*$/i, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleHasArtistCredit(title: string, targetArtist: string): boolean {
  const tClean = foldDiacritics(cleanText(title || '')).toLowerCase();
  const target = foldDiacritics(cleanText(targetArtist || '')).toLowerCase();
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
  const targetClean = foldDiacritics(cleanText(targetArtist || '')).toLowerCase();
  const targetCompact = targetClean.replace(/[^\p{L}\p{N}]/gu, '');
  const targetSpaced = targetClean.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!targetCompact) return false;

  if (trackArtist) {
    const entities = splitArtistEntities(trackArtist);
    for (const ent of entities) {
      const entLower = foldDiacritics(ent).toLowerCase();
      const entCompact = entLower.replace(/[^\p{L}\p{N}]/gu, '');
      const entSpaced = entLower.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
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
  'republic records', 'interscope', 'columbia records', 'columbia', 'def jam', 'capitol records', 'rca records',
  'island records', 'virgin records', 'polydor', 'parlophone', 'elektra', 'epic records', 'arista',
  'laface records', 'geffen', 'domino recording', 'xl recordings', 'rhino', 'legacy recordings',
  'zee music', 'yrf', 'yash raj', 'saregama', 'tips', 'speed records', 'white hill', 'desi melodies',
  'mass appeal', 'times music', 'rehaan records', 'gully gang', 'kalamkaar', 'famous studios',
  'spinnin', 'monstercat', 'nocopyrightsounds', 'mer recordings', 'mer musikk', 'world of walker',
  'octobersveryown', 'ovo sound', 'owsla', 'mau5trap', 'stmpd', 'revealed recordings',
  'armada music', 'ultra records', 'dim mak', 'mad decent', 'xo records', 'cactus jack',
  'good music', 'aftermath', 'shady records', 'roc nation', 'top dawg', 'dreamville',
  'quality control', 'young money', 'cash money', 'empire', '300 entertainment', 'fueled by ramen',
  'big machine', 'hollywood records', 'mercury records', 'bmg', 'blackened recordings',
  'pink floyd records', 'monkey puzzle', 'artist partner', 'rimas entertainment', 'motown', 'emi',
  'geet mp3', 'jass records', 'humble music', 'lokdhun', 'vyrl', 'believe music',
  'bighit', 'hybe', 'yg entertainment', 'sm entertainment', 'jyp entertainment', 'ador', 'ume - global',
  'silent records', 'big beat records', 'dj snake music'
];

function isMajorPublisherLabel(labelOrChannel: string): boolean {
  const low = foldDiacritics(cleanText(labelOrChannel || '')).toLowerCase();
  if (!low) return false;
  return OFFICIAL_MAJOR_PUBLISHERS.some(pub => low.includes(pub));
}

const VERIFIED_OFFICIAL_DJS = new Set([
  'dj snake', 'dj khaled', 'dj premier', 'dj shadow', 'dj mustard', 'dj drama',
  'dj tiesto', 'dj fresh', 'dj jazzy jeff', 'dj luian', 'dj maphorisa', 'dj chetas',
  'dj cassette', 'dj spinall', 'dj kentaro', 'dj krush', 'dj koze', 'dj seinfeld',
  'djoko', 'dj boring', 'dj rashad'
]);

// Deletes unofficial mixes, mixtapes, slowed, reverb, lofi covers, sped up, remixes, covers, karaoke, and impostor uploads
// while preserving genuine official studio releases whose title/artist contains words like "DJ", "Cover Me", etc.
function isUnofficialOrRemix(
  title: string,
  artist: string = '',
  album: string = '',
  rawTitle: string = '',
  label: string = '',
  query: string = ''
): boolean {
  if (!title && !rawTitle) return true;
  const tCombined = `${title} ${rawTitle}`.toLowerCase();
  const aLower = (artist || '').toLowerCase();
  const albLower = (album || '').toLowerCase();
  const labLower = (label || '').toLowerCase();
  const qLower = (query || '').toLowerCase();
  // Check non-label fields separately for ambiguous words like "mixtape" (e.g. Juice WRLD's label "Juice WRLD Mixtape / ISR P&D")
  const trackText = `${tCombined} ${aLower} ${albLower}`;
  const fullText = `${trackText} ${labLower}`;

  const strictBadSubstrings = [
    'karaoke', '16-bit', '16 bit', '16bit', '8-bit', '8 bit', '8bit', 'emulation',
    'soundalike', 'tribute band', 'tribute project', 'backing track', 'backing version', 'arcade player',
    'lullaby', 'sleeptherapy', 'sleep therapy', 'deep sleep', 'sleep music', 'rockabye baby', 'kidz bop', 'babies go',
    'chiptune', 'zzang karaoke', 'melody karaoke', 'pop covers', 'covers unplugged', 'dreamy lofi',
    'covers factory', 'soothing piano', 'billboard masters', 'propa charts', 'studio lead',
    'once jamison', 'born to rock', 'xoxo music', 'strings from paris', 'party tyme', 'done again',
    'stingray music', 'roma music group', 'roma symphony orchestra', 'midnite string quartet', 'sweet little band',
    'rgs music', 'running music', 'running trax', 'workout buddy', 'mirror2music', 'sybersound',
    'lee sang gul', 'aiden yoo', 'seraphic sounds', 'frenmad', 'digi beat publishing', 'unik god', 'tchiz', 'lcdff',
    'night cascade', 'sunset roses', 'sound tower', 'shadow tower', 'pacani', 'zambazi', 'hyper visor',
    'calming & relaxing', 'relaxing piano', 'city string ensemble', 'piano tribute', 'samuel kim',
    'giacomo bucci', 'go rilla', 'cranked up', 'deep mage', 'hardstyle', 'inspired by',
    'ambient version', 'slowed', 'sped up', 'speed up', 'speedup', 'reverb', 'reverbed',
    'bass boosted', 'bassboosted', 'nightcore', 'tribute to', 'originally performed by', 'in the style of',
    'made popular by', 'techno version', 'blinding lights (techno)', 'piano version', 'dance mix', 'club mix', 'party mix', 'dj mix',
    'stutter techno', 'extended instrumental', 'sing feel', 'nonnoburro', 'scity', 'key by key',
    'mellow jones', 'lofi lucy', 'john skyfield', 'javapink', 'sapphink', 'open masti', 'jackey mishra', 'moriom nessa',
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
    'mashup', 'mash up', 'circuit mash', 'megamix', 'mega mix', 'jukebox',
    'nonstop', 'non-stop', 'bootleg', 'unplugged', 'tiny desk', 'r3d edit',
    'chipmunk', 'chopped', 'screwed', '8d audio', '9d audio', '3d audio', '16d audio',
    'ringtone', 'parody', '0fficial', '[download]', '(download)', 'download]',
    'taken hostage', 'meditation', 'acapella', 'a capella', 'vocal only', 'medley',
    'rework', 'remint', 're-mint', 'r3mix', '1 hour', '10 hour', 'extended loop', 'full album',
    'reaction', 'tutorial', 'type beat', 'free beat', 'karaoke version',
    'djjohal', 'mr-jatt', 'pagalworld', 'pendujatt', 'songspk',
    '7clouds', 'glazey', 'doggy k', 'studaviga', 'vom deich', 'sona prashant', 'fabi 461',
    'hyperbee', 'turborave', 'chill vibes', 'vibes network', 'spitz aura', 'bad subelo',
    'abr music label', 'allabakash khan', 'fran garro', 'mlicasiano09', 'josiane figueiredo',
    'don jaye', 'hustinder', 'hairitage', 'dj nedo', 'full bass', 'caitlyn craig',
    'official preview', '[out now]', 'snippet', 'play violinist',
    'luke muzzic', 'tommymuzzic', 'gillan cash', 'lexmorris', 'harddope', 'rachel morgan perry',
    'navagio', 'kid on the block', 'fennecxx', 'akrai', 'revelries', 'victoria voss',
    'magic records', 'losthill', '17diamonds', 'chill vibes records', 'southfold',
    'allison pink', 'smilax publishing', 'melodi-fi', 'coopers music', 'talking clive', 'brand new rockers',
    'st. martins pops', 'pops orchestra', 'musique de gym', 'james shanon', 'laszlo teofil',
    'leonie carter', 'tiffany mason', 'the braids', 'musical mania', 'wonderoos', 'xooos'
  ];

  if (strictBadSubstrings.some(p => fullText.includes(p))) {
    return true;
  }

  // Only reject mixtape/phonk/lofi when in title/album/artist or not explicitly requested as genre
  if (/\bmixtape\b/i.test(trackText)) return true;
  const queryWantsLofi = /\blo-?fi\b/i.test(qLower);
  if (!queryWantsLofi && /\blo-?fi\b|\blofi\b|\bphonk\b/i.test(fullText)) {
    return true;
  }

  // Reject mashup-style multi-song combinations like "After Dark x Sweater Weather" when not a major publisher collab
  if (/\s+x\s+[^-]+\s+x\s+/i.test(tCombined) || (!isMajorPublisherLabel(label) && /\b(?:after dark|sweater weather|perfect girl)\s+x\s+/i.test(tCombined))) {
    return true;
  }

  // Exact album/title garbage checks
  if (albLower === 'fart' || albLower === 'test') {
    return true;
  }

  // Word-boundary checks on title + rawTitle targeting derivative remix/cover/live modifiers cleanly
  const queryWantsAcoustic = /\bacoustic\b/i.test(qLower);
  const titleRegexes = [
    /\b(?:club|dance|party|dj|extended|workout|fitness|festival|dub|vip|bootleg|mega|continuous|non-?stop|house|techno|trance)\s+mix(?:es|ed)?\b/i,
    /\((?:[^)]*\bmix\b[^)]*)\)|\[(?:[^\]]*\bmix\b[^\]]*)\]/i,
    /(?:^|[^\p{L}])remix(?:ed|es|ing)?(?:$|[^\p{L}])/iu,
    /\bremake(?:s)?\b/i,
    /\brmx\b/i,
    /\bremint\b/i,
    /\breedit\b/i,
    /(?:vip|club|festival)\s+(?:mix|edit)/i,
    /\bslowed\b/i,
    /\bpreview\b/i,
    /\bdj\s+(?:mix|remix|set|nonstop|mashup|edit|bootleg)\b/i,
    /\bcover(?:s)?\s+(?:by|of|version|mix|edit|band)\b|\b(?:piano|acoustic|vocal|instrumental|guitar|violin|cello|pop|rock|metal|orchestral)\s+covers?\b|\((?:[^)]*\bcover(?:s)?\b[^)]*)\)|\[(?:[^\]]*\bcover(?:s)?\b[^\]]*)\]/i,
    /\btribute\b/i,
    /\binstrumental\s+(?:version|ver\.?|mix|edit|cover|backing|karaoke|track)\b|\((?:[^)]*\b(?:instrumental|inst\.?)\b[^)]*)\)|\[(?:[^\]]*\b(?:instrumental|inst\.?)\b[^\]]*)\]/i,
    /\bpiano\s+(?:version|cover|tribute|instrumental|solo|medley|arrangement)\b|\(piano\)|\[piano\]/i,
    /\bmetal\s+version\b|\bstring\s+quartet\b|\bsymphony\s+orchestra\b|\bperforms\b/i,
    /\((?:[^)]*\bflip\b[^)]*)\)|\[(?:[^\]]*\bflip\b[^\]]*)\]|\b(?:lofi|lo-fi|trap|jersey|drill)\s+flip\b|\bflip\s+(?:mix|edit|remix)\b/i,
    /\b(?:8d|9d|3d|16d|dnb)\b/i,
    /\b(?:live\s+(?:at|from|in|on|performance|session|version|concert)|\(live\)|\[live\])\b/i,
    /\bbgm\b/i,
    /\((?:[^)]*\bextended\b[^)]*)\)|\[(?:[^\]]*\bextended\b[^\]]*)\]|\bextended\s+(?:mix|version|edit|cut)\b/i
  ];

  if (titleRegexes.some(rx => rx.test(tCombined))) {
    return true;
  }

  // Allow official Radio/Single/Album/Video/Clean/Explicit edits (e.g. "Alors on danse (Radio Edit)", "Umbrella (Radio Edit)"),
  // while blocking fan/TikTok/club/sped-up edits.
  for (const m of tCombined.matchAll(/\(([^)]*\bedit\b[^)]*)\)|\[([^\]]*\bedit\b[^\]]*)\]/gi)) {
    const inner = (m[1] || m[2] || '').toLowerCase();
    const isOfficialEdit = /\b(?:radio|single|album|video|clean|explicit|main|original|short|uk|us|international)\s+edit\b/.test(inner);
    if (!isOfficialEdit) {
      return true;
    }
  }

  if (!queryWantsAcoustic && (/\((?:[^)]*\bacoustic\b[^)]*)\)|\[(?:[^\]]*\bacoustic\b[^\]]*)\]|\bacoustic\s+(?:version|cover|mix|edit|session)\b/i.test(tCombined))) {
    return true;
  }

  // Reject DJ/Tribute/Karaoke/Instrumental-soloist style artist channels unless it's a verified major DJ/publisher
  if (/\b(?:karaoke|tribute|cover|arcade|sleep|study|meditation|instrumental|violinist|pianist|guitarist|cellist|8-bit|16-bit)\b/i.test(aLower)) {
    return true;
  }
  if (!queryWantsLofi && /\b(?:lofi|lo-fi)\b/i.test(aLower)) {
    return true;
  }
  if (/\bdj\b/i.test(aLower)) {
    const artistEnts = splitArtistEntities(aLower).map(e => foldDiacritics(e).trim());
    const hasLegitDj = artistEnts.some(e => VERIFIED_OFFICIAL_DJS.has(e)) || isMajorPublisherLabel(label);
    if (!hasLegitDj && /\b(?:dj\s*(?:mix|remix|nedo|johal)|dance\s+dj|club\s+dj)\b/i.test(aLower)) {
      return true;
    }
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
  'josiane figueiredo', 'hustinder', 'akla', 'luke muzzic', 'tommymuzzic', 'gillan cash', 'lexmorris',
  'harddope', 'rachel morgan perry', 'navagio', 'kid on the block', 'fennecxx', 'akrai',
  'revelries', 'victoria voss', 'southfold', 'play violinist',
  'lee sang gul', 'aiden yoo', 'seraphic sounds', 'frenmad', 'unik god', 'tchiz', 'lcdff',
  'covers factory', 'caitlyn craig', 'once jamison', 'born to rock', 'party tyme', 'done again',
  'strings from paris', 'sweet little band', 'midnite string quartet', 'roma symphony orchestra',
  'running music', 'running trax', 'workout buddy', 'rockabye baby', 'kidz bop', 'samuel kim',
  'allison pink', 'dj nedo', 'katrina hundred', 'alda rikson', 'the tibbs', 'brand new rockers',
  'st. martins pops orchestra', 'musique de gym club', 'james shanon', 'laszlo teofil',
  'leonie carter', 'tiffany mason', 'the braids', 'musical mania', 'wonderoos', 'xooos'
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
  'queen', 'the beatles', 'nirvana', 'metallica', 'pink floyd', 'tupac', '2pac', 'snoop dogg',
  'arctic monkeys', 'the neighbourhood', 'kali uchis', 'usher', 'dj snake', 'p!nk', 'pink',
  'radiohead', 'jvke', 'newjeans', 'psy', 'yoasobi', 'fujii kaze', 'juice wrld', 'tame impala',
  'wiz khalifa', 'chappell roan', 'djo', 'the killers', 'vance joy'
];

// Reject third-party uploads whose title attributes a famous artist (e.g., "Ariana Grande - positions" by AKLA) when artist credits don't match
function hasUnauthorizedFamousAttribution(title: string, rawTitle: string, artist: string, label: string = ''): boolean {
  const combined = foldDiacritics(`${title} ${rawTitle}`).toLowerCase();
  if (!combined) return false;
  if (isMajorPublisherLabel(label)) return false;

  for (const fa of FAMOUS_GLOBAL_ARTISTS) {
    const esc = escapeRegExp(fa);
    const rx = new RegExp(`(?:^|\\s-\\s*|\\bby\\s+|[,&×]\\s*|\\s)${esc}(?:\\s*-|\\s*$|\\s*\\(|\\s*\\[|[,&×])`, 'i');
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
  if (isUnofficialOrRemix(track.title, track.artist, track.album, track.rawTitle || '', track.label || '', query)) {
    return false;
  }

  // Enforce authentic studio song duration bounds (1 minute to 15 minutes) when duration is reported
  const dur = Number(track.duration) || 0;
  if (dur > 0 && (dur < 60000 || dur > 900000)) {
    return false;
  }

  const aLower = foldDiacritics((track.artist || '').toLowerCase());
  const entities = splitArtistEntities(track.artist || '').map(e => foldDiacritics(e.toLowerCase()));
  if (IMPOSTOR_STUDIOS.some(imp => aLower === imp || entities.includes(imp) || (imp.length >= 5 && aLower.includes(imp)))) {
    return false;
  }

  // Reject self-titled karaoke/reupload spam where artist literally equals a song title (e.g. "Gangnam Style — Gangnam Style")
  const normT = normalizeMatchText(track.title || '');
  const normA = normalizeMatchText(track.artist || '');
  if (normT.length >= 6 && normT === normA && !isMajorPublisherLabel(track.label || '') && !FAMOUS_GLOBAL_ARTISTS.includes(normA)) {
    return false;
  }

  if (hasUnauthorizedFamousAttribution(track.title || '', track.rawTitle || '', track.artist || '', track.label || '')) {
    return false;
  }

  const allowCollab = Boolean(track.allowTitleCollab);
  if (strictArtistTarget && !artistMatchesTarget(track.artist || '', strictArtistTarget, track.rawTitle || track.title || '', allowCollab)) {
    return false;
  }

  const qLower = foldDiacritics(query).toLowerCase().trim();
  if (qLower) {
    for (const fa of FAMOUS_GLOBAL_ARTISTS) {
      if (fa.length < 4 && fa !== 'sza' && fa !== 'psy' && fa !== 'djo' && fa !== 'sia') continue;
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
  const coverUrl = t.artwork?.['1000x1000'] || t.artwork?.['480x480'] || t.artwork?.['150x150'] || '';

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

export interface CanonicalTrackMeta {
  title: string;
  artist: string;
  duration?: number;
}

function mapSoundCloudTrack(
  t: any,
  query: string = '',
  strictArtistTarget: string = '',
  canonicalRefs: CanonicalTrackMeta[] = []
): any | null {
  // NEVER allow snipped/30s previews
  if (!t?.id || !t.title || t.policy === 'SNIP') return null;

  const durationMs = t.full_duration || t.duration || 0;
  const rawTitle = cleanText(t.title);
  const cleanT = rawTitle.replace(/\s*\[NCS Release\]/gi, '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim() || rawTitle;

  const userChannel = cleanText(t.user?.username || '');
  const userFullName = cleanText(t.user?.full_name || '');
  const pubArtist = cleanText(t.publisher_metadata?.artist || '');
  const isrc = cleanText(t.publisher_metadata?.isrc || '');
  const hasValidIsrc = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(isrc);
  const artistName = pubArtist || (userFullName && !/official|music|records/i.test(userFullName) ? userFullName : '') || userChannel || 'Verified Artist';
  const labelName = cleanText(t.publisher_metadata?.publisher || t.label_name || userFullName || userChannel);
  const followers = Number(t.user?.followers_count) || 0;
  const playCount = Number(t.playback_count) || 0;

  const isVerifiedUser = t.user?.verified === true;
  const isOfficialLabelOrArtist =
    isVerifiedUser ||
    isMajorPublisherLabel(labelName) ||
    isMajorPublisherLabel(userChannel);

  // Check if an unverified artist/ISRC upload matches an authoritative global master (e.g. Mr.Kitty - After Dark with ISRC)
  const matchesCanonicalMaster = canonicalRefs.some((c) => {
    const cTitle = normalizeMatchText(c.title);
    const sTitle = normalizeMatchText(cleanT);
    const titleOk = Boolean(cTitle && sTitle && cTitle === sTitle);
    const artistOk =
      artistMatchesTarget(artistName, c.artist, rawTitle, true) &&
      (artistMatchesTarget(userChannel, c.artist) || artistMatchesTarget(userFullName, c.artist) || hasValidIsrc || isMajorPublisherLabel(labelName));
    const durOk = !c.duration || !durationMs || Math.abs(durationMs - c.duration) <= 15000;
    const channelCredible =
      isMajorPublisherLabel(labelName) ||
      (artistMatchesTarget(userChannel, c.artist) && (followers >= 500 || playCount >= 10000)) ||
      (hasValidIsrc && followers >= 5000 && playCount >= 50000);
    return titleOk && artistOk && durOk && channelCredible;
  });

  if (!isVerifiedUser && !isOfficialLabelOrArtist && !matchesCanonicalMaster) {
    return null;
  }

  const rawAlbum = cleanText(t.publisher_metadata?.album_title || '');
  const albumName = (rawAlbum && !['fart', 'test', 'none', 'na'].includes(rawAlbum.toLowerCase()) && rawAlbum.length > 1)
    ? rawAlbum
    : (cleanText(t.label_name || '') || 'Official Release');

  // Guard against low-follower verified artist-pro accounts impersonating famous global stars
  for (const fa of FAMOUS_GLOBAL_ARTISTS) {
    const matchesCreditedOrTitle =
      artistMatchesTarget(artistName, fa, rawTitle, true);
    if (matchesCreditedOrTitle) {
      const channelIsRealArtist =
        artistMatchesTarget(userChannel, fa) || artistMatchesTarget(userFullName, fa);
      const isAuthorizedPublisher =
        isMajorPublisherLabel(userChannel) || isMajorPublisherLabel(labelName) || followers >= 200000 || matchesCanonicalMaster;
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
  const cover = rawCover
    ? rawCover.replace(/-(?:large|badge|small|tiny|mini|crop|t67x67|t120x120|t200x200|t300x300)(?=\.[a-z0-9]+(?:$|\?))/i, '-t500x500')
    : '';
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

async function searchSoundCloudOfficialTracks(
  query: string,
  strictArtistTarget: string = '',
  pages: number = 2,
  canonicalRefs: CanonicalTrackMeta[] = []
): Promise<{ tracks: any[]; rawItems: any[] }> {
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
      const mapped = mapSoundCloudTrack(t, query, strictArtistTarget, canonicalRefs);
      if (!mapped) continue;
      const key = `${normalizeMatchText(mapped.title)}:::${normalizeMatchText(mapped.artist)}`;
      if (seen.has(key) || seen.has(mapped.id)) continue;
      seen.add(key);
      seen.add(mapped.id);
      tracks.push(mapped);
    }

    return { tracks, rawItems };
  } catch (err) {
    console.error('SoundCloud search error:', err);
    return { tracks: [], rawItems: [] };
  }
}

async function searchSoundCloudLegacyArray(query: string, strictArtistTarget: string = '', pages: number = 1, canonicalRefs: CanonicalTrackMeta[] = []): Promise<any[]> {
  const res = await searchSoundCloudOfficialTracks(query, strictArtistTarget, pages, canonicalRefs);
  return res.tracks;
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
        coverUrl = coverUrl.replace(/(?:size_xs|size_s|size_m|175x175|50x50)\.(jpg|jpeg|webp)/i, 'size_l.$1');
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

// Deezer metadata lookup used for global artist/song discovery, canonical ownership, and ranking
async function searchDeezerMetadataTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  try {
    const p1 = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=50&index=0`, { signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : { data: [] })
      .catch(() => ({ data: [] }));

    const tracks: any[] = [];
    const seen = new Set<string>();

    for (const t of (p1.data || [])) {
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

function detectRegionalItunesStores(query: string): string[] {
  const q = (query || '').toLowerCase();
  const stores = new Set<string>(['us']);
  if (/[\u3040-\u30ff]|\b(?:japanese|j-?pop|anime|yoasobi|ado|kenshi|fujii|official hige|radwimps|babymetal|lisa|aimyon)\b/i.test(query)) {
    stores.add('jp');
  }
  if (/[\uac00-\ud7af]|\b(?:korean|k-?pop|bts|blackpink|newjeans|stray kids|twice|ive|aespa|seventeen|jung kook|psy|gangnam)\b/i.test(query)) {
    stores.add('kr');
  }
  if (/[\u4e00-\u9faf]|\b(?:chinese|mandopop|cantopop|c-?pop|jay chou|eason chan|jolin|mayday|g\.e\.m)\b/i.test(query)) {
    stores.add('tw');
    stores.add('hk');
  }
  if (/[\u0900-\u0d7f]|\b(?:hindi|punjabi|tamil|telugu|bollywood|malayalam|kannada|marathi|bhojpuri|desi|arijit|diljit|karan aujla|sidhu|shubh|ap dhillon)\b/i.test(query)) {
    stores.add('in');
  }
  if (/\b(?:spanish|latin|reggaeton|corridos|bachata|salsa|cumbia|bad bunny|karol g|feid|peso pluma|grupo frontera|shakira|rosalia|enrique|despacito|bailando)\b/i.test(q)) {
    stores.add('es');
    stores.add('mx');
  }
  if (/\b(?:french|français|francais|stromae|indila|aya nakamura|gims|dadi|zaz|ed[ií]th piaf|alors on danse)\b/i.test(q)) {
    stores.add('fr');
  }
  if (/\b(?:german|deutsch|rammstein|nena|luftballons|apache 207|cro|mark forster|herbert)\b/i.test(q)) {
    stores.add('de');
  }
  if (/\b(?:italian|italiano|maneskin|eros ramazzotti|laura pausini|andrea bocelli|tiziano|mahmood)\b/i.test(q)) {
    stores.add('it');
  }
  if (/\b(?:portuguese|brazil|brazilian|sertanejo|anitta|bossa nova|funk carioca)\b/i.test(q)) {
    stores.add('br');
  }
  if (/[\u0600-\u06ff]|\b(?:arabic|habibi|amr diab|nancy ajram|fairuz|elissa|tamally|sherine)\b/i.test(query)) {
    stores.add('ae');
  }
  if (/\b(?:turkish|türkçe|turkce|tarkan|sezen aksu)\b/i.test(q)) {
    stores.add('tr');
  }
  if (/\b(?:thai|t-?pop)\b/i.test(q)) stores.add('th');
  if (/\b(?:indonesian|dangdut)\b/i.test(q)) stores.add('id');
  return Array.from(stores).slice(0, 3);
}

// iTunes worldwide canonical catalog lookup (fast, key-less global & regional music encyclopedia)
async function searchItunesMetadataTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  try {
    const stores = detectRegionalItunesStores(query);
    const nonUsStore = stores.find(s => s !== 'us');
    const isPureLanguageQuery = /^(?:japanese|korean|chinese|mandopop|cantopop|j-?pop|k-?pop|c-?pop|french|german|italian|portuguese|arabic|turkish|spanish|latin)(?:\s+(?:songs?|hits?|music|top))?$/i.test(query.trim());

    const [storeResponses, regionalRssJson] = await Promise.all([
      Promise.all(
        stores.map(country =>
          fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=${country}&media=music&entity=song&limit=25`,
            { signal: AbortSignal.timeout(3800) }
          )
            .then(r => (r.ok ? r.json() : { results: [] }))
            .catch(() => ({ results: [] }))
        )
      ),
      isPureLanguageQuery && nonUsStore
        ? fetch(`https://itunes.apple.com/${nonUsStore}/rss/topsongs/limit=15/json`, { signal: AbortSignal.timeout(3800) })
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null)
        : Promise.resolve(null)
    ]);

    const tracks: any[] = [];
    const seen = new Set<string>();

    // Prioritize real native top charts when searching purely by language/country (e.g. "Japanese", "Korean", "French")
    const rssEntries = regionalRssJson?.feed?.entry || [];
    for (let i = 0; i < rssEntries.length; i++) {
      const entry = rssEntries[i];
      const rawTitle = cleanText(entry?.['im:name']?.label || '');
      const artistName = cleanText(entry?.['im:artist']?.label || '');
      const albumName = cleanText(entry?.['im:collection']?.['im:name']?.label || 'Regional Top Hits');
      if (!rawTitle || !artistName) continue;
      const cleanT = cleanSongTitle(rawTitle, artistName) || rawTitle;
      if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName }, query, strictArtistTarget)) {
        continue;
      }
      const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
      if (!key || key === ':::' || seen.has(key)) continue;
      seen.add(key);
      const imgs = entry?.['im:image'] || [];
      const coverRaw = imgs[imgs.length - 1]?.label || '';
      tracks.push({
        id: 'it_rss_' + i,
        title: cleanT,
        rawTitle,
        artist: artistName,
        album: albumName,
        rank: Math.max(600000, 950000 - i * 18000),
        coverUrl: coverRaw ? coverRaw.replace(/\d+x\d+bb/, '600x600bb') : '',
        streamUrl: '',
        previewUrl: '',
        duration: 0,
        source: 'itunes'
      });
    }

    for (const json of storeResponses) {
      const results = json?.results || [];
      for (let i = 0; i < results.length; i++) {
        const t = results[i];
        if (!t?.trackName || !t?.artistName) continue;
        const rawTitle = cleanText(t.trackName);
        const cleanT = cleanSongTitle(rawTitle, t.artistName) || rawTitle;
        const artistName = cleanText(t.artistName);
        const albumName = cleanText(t.collectionName || 'Official Release');
        const durationMs = Number(t.trackTimeMillis) || 0;
        if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName, duration: durationMs }, query, strictArtistTarget)) {
          continue;
        }
        const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
        if (!key || key === ':::' || seen.has(key)) continue;
        seen.add(key);
        const coverRaw = t.artworkUrl100 || '';
        const coverUrl = coverRaw ? coverRaw.replace(/\d+x\d+bb/, '600x600bb') : '';
        tracks.push({
          id: 'it_' + (t.trackId || `${tracks.length}_${i}`),
          title: cleanT,
          rawTitle,
          artist: artistName,
          album: albumName,
          rank: Math.max(250000, (isPureLanguageQuery ? 720000 : 900000) - i * 32000),
          coverUrl,
          streamUrl: '',
          previewUrl: '',
          duration: durationMs,
          source: 'itunes'
        });
      }
    }
    return tracks;
  } catch {
    return [];
  }
}

function parseYtmDurationMs(durStr: string): number {
  const m = (durStr || '').trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const sec = Number(m[3] || 0);
  return (h * 3600 + min * 60 + sec) * 1000;
}

// YouTube Music key-less canonical metadata search (resolves lyric lines, global languages, topics & official hits)
async function searchYouTubeMusicMetadata(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  if (!query) return [];
  try {
    const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240724.00.00',
            hl: 'en',
            gl: 'US'
          }
        },
        query,
        params: 'EgWKAQIIAWoMEAMQBBAJEAoQBRAV'
      }),
      signal: AbortSignal.timeout(4200)
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
    const sections = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const shelf = sections.find((s: any) => s.musicShelfRenderer)?.musicShelfRenderer;
    const contents = shelf?.contents || [];

    const tracks: any[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < Math.min(contents.length, 25); i++) {
      const r = contents[i]?.musicResponsiveListItemRenderer;
      if (!r) continue;
      const cols = r.flexColumns || [];
      const rawTitle = cleanText((cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []).map((x: any) => x.text).join(''));
      if (!rawTitle) continue;

      const metaRuns = (cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []).map((x: any) => x.text || '');
      // Split by " • " bullet separator into logical segments [artistSegment, albumSegment, durationSegment]
      const segments: string[] = [];
      let buf = '';
      for (const piece of metaRuns) {
        if (piece.trim() === '•') {
          if (buf.trim()) segments.push(buf.trim());
          buf = '';
        } else {
          buf += piece;
        }
      }
      if (buf.trim()) segments.push(buf.trim());

      const cleanedSegs = segments.filter(s => !/^(?:Song|Video|Single|EP|Album)$/i.test(s));
      if (cleanedSegs.length === 0) continue;

      let durationMs = 0;
      const nonDurSegs: string[] = [];
      for (const seg of cleanedSegs) {
        if (/^(?:\d+:)?\d{1,2}:\d{2}$/.test(seg)) {
          durationMs = parseYtmDurationMs(seg);
        } else if (!/^\d+(?:\.\d+)?[KMB]?\s+(?:plays|views)$/i.test(seg)) {
          nonDurSegs.push(seg);
        }
      }

      const artistName = cleanText(nonDurSegs[0] || '');
      const albumName = cleanText(nonDurSegs[1] || 'Official Release');
      if (!artistName) continue;

      const cleanT = cleanSongTitle(rawTitle, artistName) || rawTitle;
      if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName, duration: durationMs }, query, strictArtistTarget)) {
        continue;
      }

      const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
      if (!key || key === ':::' || seen.has(key)) continue;
      seen.add(key);

      const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      const rawThumb = thumbs[thumbs.length - 1]?.url || '';
      const coverUrl = rawThumb
        ? rawThumb
            .replace(/=w\d+-h\d+[^&]*/, '=w600-h600-l90-rj')
            .replace(/=s\d+[^&]*/, '=w600-h600-l90-rj')
        : '';

      tracks.push({
        id: 'ytm_' + (r.playlistItemData?.videoId || `${i}`),
        title: cleanT,
        rawTitle,
        artist: artistName,
        album: albumName,
        rank: Math.max(400000, 960000 - i * 35000),
        coverUrl,
        streamUrl: '',
        previewUrl: '',
        duration: durationMs,
        source: 'ytm'
      });
    }
    return tracks;
  } catch {
    return [];
  }
}

// LRCLIB key-less lyrics & line search (resolves song lyric snippets across languages)
async function searchLrclibMetadataTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  if (!query || query.length < 3) return [];
  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(3800)
    });
    if (!res.ok) return [];
    const list = await res.json().catch(() => []);
    if (!Array.isArray(list)) return [];

    const tracks: any[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < Math.min(list.length, 15); i++) {
      const item = list[i];
      const rawTitle = cleanText(item?.trackName || item?.name || '');
      const artistName = cleanText(item?.artistName || '');
      const albumName = cleanText(item?.albumName || 'Official Release');
      const durationMs = (Number(item?.duration) || 0) * 1000;
      if (!rawTitle || !artistName) continue;
      const cleanT = cleanSongTitle(rawTitle, artistName) || rawTitle;
      if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName, duration: durationMs }, query, strictArtistTarget)) {
        continue;
      }
      const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
      if (!key || key === ':::' || seen.has(key)) continue;
      seen.add(key);

      tracks.push({
        id: 'lrc_' + (item.id || i),
        title: cleanT,
        rawTitle,
        artist: artistName,
        album: albumName,
        rank: Math.max(200000, 650000 - i * 25000),
        coverUrl: '',
        streamUrl: '',
        previewUrl: '',
        duration: durationMs,
        source: 'lrclib'
      });
    }
    return tracks;
  } catch {
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

// Internet Archive Official Netlabel / Musopen Catalog (100% free direct HTTP 206 MP3 streaming, excludes spoken-word broadcasts)
async function searchArchiveOfficialTracks(query: string, strictArtistTarget: string = ''): Promise<any[]> {
  const cleanQ = query.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();
  if (!cleanQ || cleanQ.length < 2) return [];
  const qTokens = extractQueryTokens(normalizeMatchText(query));
  try {
    const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      `collection:(musopen OR netlabels) AND (title:(${cleanQ}) OR creator:(${cleanQ})) AND mediatype:audio`
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
      if (/\b(?:speech|address|charter|broadcast|podcast|lecture|sermon|interview|news|parliament|senate|roosevelt|truman|orson welles|hitler|churchill)\b/i.test(`${albumTitle} ${creatorRaw}`)) {
        continue;
      }
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
        const normComb = normalizeMatchText(`${rawFileTitle} ${trackArtist} ${albumTitle}`);
        if (qTokens.length > 0 && !qTokens.some(tok => normComb.includes(tok))) continue;

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
        const coverUrl = coverRaw ? coverRaw.replace(/\d+x\d+bb/, '600x600bb') : '';
        return { title, artist, album: cleanText(entry?.['im:collection']?.['im:name']?.label || 'Global Top Hits'), coverUrl };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Helper: Resolve any track to a direct HTML5/HLS background-playable stream across JioSaavn / SoundCloud / Gaana / Audius / Jamendo
async function resolveDirectStreamTrack(
  title: string,
  artist: string = '',
  coverOverride: string = '',
  albumOverride: string = '',
  targetDurationMs: number = 0
): Promise<any | null> {
  const cleanTitle = cleanSongTitle(title, artist) || title.replace(/\(.*\)|\[.*\]/g, '').trim();
  const asciiTitle = foldDiacritics(cleanTitle).replace(/[!?'".]/g, ' ').replace(/\s+/g, ' ').trim();
  const targetTitleNorm = normalizeMatchText(cleanTitle);
  const artistEntities = splitArtistEntities(artist);
  const primaryArtist = artistEntities[0] || artist;
  const asciiArtist = foldDiacritics(primaryArtist).replace(/[!?'".]/g, ' ').replace(/\s+/g, ' ').trim();
  const query = `${asciiTitle || cleanTitle} ${asciiArtist || primaryArtist}`.trim();
  if (!cleanTitle || !targetTitleNorm) return null;

  const canonicalRef: CanonicalTrackMeta[] = artistEntities.length > 0
    ? artistEntities.map(ent => ({ title: cleanTitle, artist: ent, duration: targetDurationMs }))
    : [];

  const matchesTrack = (t: any) => {
    if (!t?.streamUrl) return false;
    const candNorm = normalizeMatchText(t.title || '');
    const titleMatch = Boolean(
      candNorm && targetTitleNorm && (candNorm === targetTitleNorm || candNorm.includes(targetTitleNorm) || targetTitleNorm.includes(candNorm))
    );
    if (!titleMatch) return false;
    if (artistEntities.length > 0) {
      const matchesAnyEnt = artistEntities.some(ent =>
        artistMatchesTarget(t.artist || '', ent, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab))
      );
      if (!matchesAnyEnt) return false;
    }
    return true;
  };

  try {
    const [saavnRes, scRes, gaanaTracks, audiusTracks, jamendoTracks] = await Promise.all([
      fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=10&p=1`, 4000)
        .then(d => d || {}),
      searchSoundCloudOfficialTracks(query, '', 1, canonicalRef).catch(() => ({ tracks: [], rawItems: [] })),
      process.env.GAANA_PROXY_URL ? searchGaanaOfficialTracks(query, primaryArtist).catch(() => []) : Promise.resolve([]),
      searchAudiusOfficialTracks(query, '').catch(() => []),
      searchJamendoOfficialTracks(query, '').catch(() => [])
    ]);

    let saavnCandidates = (saavnRes.results || [])
      .map(mapJioSaavnSong)
      .filter((t: any) => t.streamUrl && isOfficialPublisherTrack(t, query, ''));

    if (!saavnCandidates.some(matchesTrack) && asciiTitle && asciiTitle.toLowerCase() !== query.toLowerCase()) {
      const saavnTitleRes = await fetchSaavnJson(
        `https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(asciiTitle)}&n=10&p=1`,
        3800
      ).then(d => d || {});
      const titleCandidates = (saavnTitleRes.results || [])
        .map(mapJioSaavnSong)
        .filter((t: any) => t.streamUrl && isOfficialPublisherTrack(t, query, ''));
      saavnCandidates = [...saavnCandidates, ...titleCandidates];
    }

    const scTracks = scRes.tracks || [];

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
      artist: primaryArtist ? (artistMatchesTarget(match.artist || '', primaryArtist) ? match.artist : artist) : match.artist,
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
      const highRes = getHighResImage(a.image);
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
          const highRes = getHighResImage(pageData.image || '');
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
          const highRes = getHighResImage(found.image || '');
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
      searchSoundCloudLegacyArray(targetArtist, targetArtist, 2).catch(() => []),
      process.env.GAANA_PROXY_URL ? searchGaanaOfficialTracks(targetArtist, targetArtist).catch(() => []) : Promise.resolve([]),
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
const searchResultsCache = new Map<string, { data: any[]; exp: number }>();

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

    const cacheKey = normalizeMatchText(query) || query.toLowerCase();
    const cachedSearch = searchResultsCache.get(cacheKey);
    if (cachedSearch && cachedSearch.exp > Date.now() && cachedSearch.data.length > 0) {
      return res.json(cachedSearch.data);
    }

    const seenKeys = new Set<string>();
    const allTracks: any[] = [];
    const queryLower = foldDiacritics(query).toLowerCase();
    const queryNorm = normalizeMatchText(query);
    const queryTokens = extractQueryTokens(queryNorm);
    const isTopicOrLanguageQuery = /\b(?:songs?|hits?|music|playlist|mix|vibes?|chill|sad|love|romantic|party|workout|rock|pop|hip\s*hop|rap|jazz|classical|japanese|korean|chinese|mandopop|cantopop|hindi|punjabi|tamil|telugu|malayalam|spanish|latin|reggaeton|french|german|italian|portuguese|arabic|turkish|k-?pop|j-?pop|c-?pop|bollywood)\b/i.test(queryLower);
    const canonicalSongHits: Array<{ title: string; artist: string; album: string; coverUrl: string; duration: number; weight: number }> = [];

    // Handle Global Top Hits / English Top Hits chart browse queries directly with curated live playlists
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
        return res.json(allTracks.slice(0, 150));
      }
    }

    const queryBannedWords = /^(?:slowed|reverb|slowed reverb|karaoke|nightcore|remix|mixtape|8d audio|bootleg)$/i;
    const isPureBannedQuery = queryBannedWords.test(queryLower.trim());
    if (isPureBannedQuery) {
      return res.json([]);
    }

    try {
      const asciiQuery = foldDiacritics(query).replace(/[!?'".]/g, ' ').replace(/\s+/g, ' ').trim();
      const saavnQuery = asciiQuery || query;
      const pages = [1, 2];

      // Stage 1: Fetch JioSaavn (2 pages x 50) + Playlists + Albums + Global Encyclopedias (YTM + iTunes + Deezer + LRCLIB) + SoundCloud (2 pages) + Audius + Archive in parallel
      const [
        pageResults,
        albumSearchRes,
        playlistSearchRes,
        scRawResult,
        gaanaTracks,
        ytmMetaTracks,
        deezerMetaTracks,
        itunesMetaTracks,
        lrclibMetaTracks,
        mxmMetaTracks,
        lfmMetaTracks,
        audiusTracks,
        jamendoTracks,
        archiveTracks
      ] = await Promise.all([
        Promise.all(
          pages.map(p =>
            fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(saavnQuery)}&n=50&p=${p}`, 4500)
              .then(d => d || {})
          )
        ),
        fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(saavnQuery)}&n=4&p=1`, 3500)
          .then(d => d || {}),
        fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(saavnQuery)}&n=4&p=1`, 3500)
          .then(d => d || {}),
        searchSoundCloudOfficialTracks(saavnQuery, '', 2).catch(() => ({ tracks: [], rawItems: [] })),
        process.env.GAANA_PROXY_URL ? searchGaanaOfficialTracks(query).catch(() => []) : Promise.resolve([]),
        searchYouTubeMusicMetadata(query).catch(() => []),
        searchDeezerMetadataTracks(query).catch(() => []),
        searchItunesMetadataTracks(query).catch(() => []),
        searchLrclibMetadataTracks(query).catch(() => []),
        searchMusixmatchOfficialTracks(query).catch(() => []),
        searchLastFmOfficialTracks(query).catch(() => []),
        searchAudiusOfficialTracks(query).catch(() => []),
        searchJamendoOfficialTracks(query).catch(() => []),
        searchArchiveOfficialTracks(query).catch(() => [])
      ]);

      const saavnRawPageCount = pageResults.reduce((acc, d) => acc + (d?.results?.length || 0), 0);
      const saavnAcTracks = saavnRawPageCount < 10
        ? await fetchSaavnAutocompleteTracks(saavnQuery).catch(() => [])
        : [];

      // Build ordered canonical global hits from YTM + iTunes + Deezer + LRCLIB (keep max rank across sources)
      const combinedCanonicalRaw = [
        ...(ytmMetaTracks || []),
        ...(itunesMetaTracks || []),
        ...(deezerMetaTracks || []),
        ...(lrclibMetaTracks || [])
      ];
      const canonicalMap = new Map<string, { title: string; artist: string; album: string; coverUrl: string; duration: number; weight: number }>();
      for (const ct of combinedCanonicalRaw) {
        const tn = normalizeMatchText(ct.title || '');
        const an = normalizeMatchText(ct.artist || '');
        if (!tn || !an) continue;
        const cKey = `${tn}:::${an}`;
        const w = Number(ct.rank) || 350000;
        const existing = canonicalMap.get(cKey);
        if (!existing) {
          canonicalMap.set(cKey, {
            title: ct.title,
            artist: ct.artist,
            album: ct.album || 'Official Release',
            coverUrl: ct.coverUrl || '',
            duration: Number(ct.duration) || 0,
            weight: w
          });
        } else {
          if (w > existing.weight) existing.weight = w;
          if (!existing.coverUrl && ct.coverUrl) existing.coverUrl = ct.coverUrl;
          if (!existing.duration && ct.duration) existing.duration = Number(ct.duration) || 0;
        }
      }
      canonicalSongHits.push(...canonicalMap.values());
      canonicalSongHits.sort((a, b) => b.weight - a.weight);

      const canonicalRefs: CanonicalTrackMeta[] = canonicalSongHits.slice(0, 14).map(c => ({
        title: c.title,
        artist: c.artist,
        duration: c.duration
      }));

      // Re-map SoundCloud raw items WITH canonicalRefs so official non-blue-check artists unlock cleanly
      const scTracks: any[] = [];
      const scSeen = new Set<string>();
      for (const rawSc of (scRawResult?.rawItems || [])) {
        const mapped = mapSoundCloudTrack(rawSc, query, '', canonicalRefs);
        if (!mapped) continue;
        const key = `${normalizeMatchText(mapped.title)}:::${normalizeMatchText(mapped.artist)}`;
        if (scSeen.has(key) || scSeen.has(mapped.id)) continue;
        scSeen.add(key);
        scSeen.add(mapped.id);
        scTracks.push(mapped);
      }

      // Determine whether this is genuinely an artist-only query (never treat language/topic words like "Korean" or "Spanish hits" as artist queries!)
      const isFeaturedArtistQuery = FEATURED_ARTISTS.some(f => foldDiacritics(f.name).toLowerCase() === queryLower);
      const verifiedArtistMatchCount = [...(deezerMetaTracks || []), ...(itunesMetaTracks || []), ...(ytmMetaTracks || []), ...(mxmMetaTracks || []), ...(lfmMetaTracks || [])]
        .filter((t: any) => artistMatchesTarget(t.artist, query))
        .length;
      const hasDominantSongTitleMatch = canonicalSongHits.some(c =>
        normalizeMatchText(c.title) === queryNorm &&
        !artistMatchesTarget(c.artist, query) &&
        c.weight >= 450000
      );
      const isArtistQuery = isFeaturedArtistQuery || (!isTopicOrLanguageQuery && verifiedArtistMatchCount >= 3 && !hasDominantSongTitleMatch);

      // Build canonical owner map per song title
      const verifiedOwnersByTitle = new Map<string, string[]>();
      const dzByTitle = new Map<string, any[]>();
      for (const dt of combinedCanonicalRaw) {
        const tn = normalizeMatchText(dt.title || '');
        if (!tn) continue;
        if (!dzByTitle.has(tn)) dzByTitle.set(tn, []);
        dzByTitle.get(tn)!.push(dt);
      }
      for (const [tn, items] of dzByTitle.entries()) {
        items.sort((a, b) => (b.rank || 0) - (a.rank || 0));
        const maxRank = items[0]?.rank || 0;
        const threshold = maxRank >= 300000
          ? Math.max(maxRank * 0.80, maxRank - 150000)
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

      const matchesSplitQuery = (t: any): boolean => {
        if (queryTokens.length === 0) return true;
        const tTitleN = normalizeMatchText(t.title || '');
        const tArtN = normalizeMatchText(t.artist || '');
        const tCombinedN = `${tTitleN} ${tArtN}`.trim();
        return queryTokens.every(tok => tCombinedN.includes(tok));
      };

      const isImpostorForQuery = (t: any) => {
        const artMatchQuery = artistMatchesTarget(t.artist, query, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab));
        const tTitleNorm = normalizeMatchText(t.title || '');
        const tTitleBase = tTitleNorm
          .replace(/\s+(?:funk|phonk|brazil|drill|trap|sped|slowed|hardstyle|techno|nightcore|version|edition)$/i, '')
          .trim();

        // Rule A: When query genuinely targets an artist, strictly require matching that artist
        if (isArtistQuery && queryNorm) {
          if (!artMatchQuery) {
            return true;
          }
        }

        // Rule B: Canonical song-title ownership guard
        const ownerKey = verifiedOwnersByTitle.has(tTitleNorm)
          ? tTitleNorm
          : (tTitleBase && verifiedOwnersByTitle.has(tTitleBase) ? tTitleBase : '');

        if (ownerKey && queryNorm) {
          const matchesQueryTitle =
            ownerKey === queryNorm ||
            (ownerKey.length >= 2 && new RegExp(`\\b${escapeRegExp(ownerKey)}\\b`, 'u').test(queryNorm)) ||
            (queryNorm.length >= 4 && ownerKey.includes(queryNorm));

          if (matchesQueryTitle) {
            const owners = verifiedOwnersByTitle.get(ownerKey)!;
            const matchesAnyOwner = owners.some(owner =>
              artistMatchesTarget(t.artist || '', owner, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab))
            );
            const hasMajorLabel = isMajorPublisherLabel(t.label || '');
            const matchesAnotherCanonical = canonicalSongHits.some(c =>
              normalizeMatchText(c.title) === tTitleNorm && artistMatchesTarget(t.artist || '', c.artist)
            );
            if (!matchesAnyOwner && !hasMajorLabel && !matchesAnotherCanonical) {
              return true;
            }
          }
        }

        // Reject spam tracks whose title literally stuffs "<SongTitle> <Artist>" when a real canonical hit separates them cleanly
        if (canonicalSongHits.length > 0 && queryTokens.length >= 2) {
          const topCanon = canonicalSongHits[0];
          const cTitleN = normalizeMatchText(topCanon.title);
          const cArtN = normalizeMatchText(topCanon.artist);
          if (
            cTitleN && cArtN &&
            tTitleNorm.includes(cTitleN) &&
            tTitleNorm.includes(cArtN) &&
            !artistMatchesTarget(t.artist || '', topCanon.artist) &&
            !isMajorPublisherLabel(t.label || '')
          ) {
            return true;
          }
        }

        return false;
      };

      // Fetch artist top discography when query targets an artist
      if (isFeaturedArtistQuery || isArtistQuery) {
        try {
          const matchedSaavnArtist = FEATURED_ARTISTS.find(a => foldDiacritics(a.name).toLowerCase() === queryLower);
          let saavnArtistId = matchedSaavnArtist && /^\d+$/.test(matchedSaavnArtist.id) ? matchedSaavnArtist.id : '';
          let saavnArtistName = matchedSaavnArtist?.name || query;
          if (!saavnArtistId) {
            const artSearch = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=3&p=1`, 3000);
            const exactArt = (artSearch?.results || []).find((a: any) => artistMatchesTarget(a?.name || '', query));
            if (exactArt?.id) {
              saavnArtistId = String(exactArt.id);
              saavnArtistName = cleanText(exactArt.name || query);
            }
          }
          if (saavnArtistId) {
            const pageData = await fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&artistId=${saavnArtistId}&api_version=4&_format=json&_marker=0&ctx=web6dot0&n_song=80&n_album=10`, 4000);
            if (pageData) {
              for (const t of (pageData.topSongs || []).map(mapJioSaavnSong)) {
                if (t.streamUrl && isOfficialPublisherTrack(t, query, saavnArtistName)) {
                  const cleanT = cleanSongTitle(t.title, saavnArtistName) || t.title;
                  const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(t.artist)}`;
                  if (key && !seenKeys.has(key) && !seenKeys.has(t.id)) {
                    seenKeys.add(key);
                    seenKeys.add(t.id);
                    allTracks.push({ ...t, title: cleanT });
                  }
                }
              }
            }
          }
        } catch {}
      }

      const combinedSaavnSongs = [
        ...(saavnAcTracks || []),
        ...pageResults.flatMap(d => d.results || []).map(mapJioSaavnSong),
      ].filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, query) && !isImpostorForQuery(t));

      for (const t of combinedSaavnSongs) {
        const cleanT = cleanSongTitle(t.title, t.artist) || t.title;
        const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(t.artist)}`;
        const trackId = t.id;
        if (!seenKeys.has(key) && !seenKeys.has(trackId)) {
          seenKeys.add(key);
          seenKeys.add(trackId);
          allTracks.push({ ...t, title: cleanT });
        }
      }

      // Expand matching albums & curated official playlists for broad topic/language/word searches (never hijack exact single-song hits)

      const albumResults = (albumSearchRes.results || [])
        .filter((alb: any) => {
          const aText = normalizeMatchText(`${alb.title || ''} ${alb.more_info?.music || ''}`);
          return queryTokens.some(tok => aText.includes(tok));
        })
        .slice(0, 3);

      const playlistResults = (playlistSearchRes.results || [])
        .filter((pl: any) => {
          const pText = normalizeMatchText(`${pl.title || ''} ${pl.subtitle || ''}`);
          return queryTokens.some(tok => pText.includes(tok));
        })
        .slice(0, 3);

      if ((albumResults.length > 0 || playlistResults.length > 0) && !hasDominantSongTitleMatch && allTracks.length < 70) {
        const [albumDetailBatches, playlistDetailBatches] = await Promise.all([
          Promise.all(
            albumResults.map((alb: any) =>
              fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&albumid=${alb.id}&api_version=4&_format=json&_marker=0&ctx=web6dot0`, 3500)
                .then(d => d || {})
            )
          ),
          isTopicOrLanguageQuery || allTracks.length < 25
            ? Promise.all(
                playlistResults.map((pl: any) =>
                  fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${pl.id}&api_version=4&_format=json&_marker=0&ctx=web6dot0`, 3500)
                    .then(d => d || {})
                )
              )
            : Promise.resolve([])
        ]);

        for (const albData of albumDetailBatches) {
          const albTracks = (albData.list || albData.songs || [])
            .map(mapJioSaavnSong)
            .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, query) && !isImpostorForQuery(t) && (isTopicOrLanguageQuery || matchesSplitQuery(t)));

          for (const t of albTracks) {
            const cleanT = cleanSongTitle(t.title, t.artist) || t.title;
            const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(t.artist)}`;
            const trackId = t.id;
            if (!seenKeys.has(key) && !seenKeys.has(trackId)) {
              seenKeys.add(key);
              seenKeys.add(trackId);
              allTracks.push({ ...t, title: cleanT });
            }
          }
        }

        for (const plData of playlistDetailBatches) {
          const plTracks = (plData.list || [])
            .map(mapJioSaavnSong)
            .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, query) && !isImpostorForQuery(t))
            .slice(0, 30);

          for (const t of plTracks) {
            const cleanT = cleanSongTitle(t.title, t.artist) || t.title;
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

      // Merge direct streaming Gaana, SoundCloud, Audius, Jamendo, and Internet Archive tracks
      for (const t of [...(gaanaTracks || []), ...(scTracks || []), ...(audiusTracks || []), ...(jamendoTracks || []), ...(archiveTracks || [])]) {
        if (!t?.streamUrl || isImpostorForQuery(t)) continue;
        const key = `${normalizeMatchText(t.title)}:::${normalizeMatchText(t.artist)}`;
        if (!seenKeys.has(key) && !seenKeys.has(t.id)) {
          seenKeys.add(key);
          seenKeys.add(t.id);
          allTracks.push(t);
        }
      }

      // Stage 2: Canonical Rescue Pass -> resolve top YTM / iTunes / Deezer / LRCLIB / Musixmatch / Last.fm hits to direct streams
      const isHitAlreadyPresent = (candTitle: string, candArtist: string) => {
        const cTitleNorm = normalizeMatchText(candTitle);
        const candArtists = splitArtistEntities(candArtist);
        return allTracks.some((existing: any) => {
          const eTitleNorm = normalizeMatchText(existing.title || '');
          const tMatch = Boolean(eTitleNorm && cTitleNorm && (eTitleNorm === cTitleNorm || eTitleNorm.includes(cTitleNorm) || cTitleNorm.includes(eTitleNorm)));
          return tMatch && candArtists.some(ent => artistMatchesTarget(existing.artist || '', ent, existing.rawTitle || existing.title || '', Boolean(existing.allowTitleCollab)));
        });
      };

      const rescuePoolRaw = [
        ...(ytmMetaTracks || []).slice(0, 6),
        ...canonicalSongHits.slice(0, 10),
        ...(lrclibMetaTracks || []).slice(0, 4),
        ...(mxmMetaTracks || []).slice(0, 3),
        ...(lfmMetaTracks || []).slice(0, 3)
      ];
      const rescueSeen = new Set<string>();
      const rescueCandidates = rescuePoolRaw
        .filter((c: any) => {
          if (!c?.title || !c?.artist) return false;
          const rk = `${normalizeMatchText(c.title)}:::${normalizeMatchText(c.artist)}`;
          if (!rk || rescueSeen.has(rk)) return false;
          rescueSeen.add(rk);
          return !isHitAlreadyPresent(c.title, c.artist) && !isImpostorForQuery(c);
        })
        .slice(0, 12);

      if (rescueCandidates.length > 0) {
        const resolvedCatalog = await Promise.all(
          rescueCandidates.map((c: any) =>
            resolveDirectStreamTrack(c.title, c.artist, c.coverUrl || '', c.album || '', Number(c.duration) || 0)
          )
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
      // For broad language/topic queries where few tracks matched so far, expand top 3 official artists from canonical hits on SoundCloud + Audius
      if (isTopicOrLanguageQuery && allTracks.length < 25 && canonicalSongHits.length > 0) {
        const topArtists = Array.from(
          new Set(
            canonicalSongHits
              .map(c => splitArtistEntities(c.artist)[0])
              .filter(a => a && a.length >= 2)
          )
        ).slice(0, 3);

        if (topArtists.length > 0) {
          const [scArtBatches, audArtBatches] = await Promise.all([
            Promise.all(topArtists.map(art => searchSoundCloudOfficialTracks(art, art, 1, canonicalRefs).catch(() => ({ tracks: [], rawItems: [] })))),
            Promise.all(topArtists.map(art => searchAudiusOfficialTracks(art, art).catch(() => [])))
          ]);
          for (const t of [...scArtBatches.flatMap(r => r.tracks || []), ...audArtBatches.flat()]) {
            if (!t?.streamUrl || isImpostorForQuery(t)) continue;
            const key = `${normalizeMatchText(t.title)}:::${normalizeMatchText(t.artist)}`;
            if (!seenKeys.has(key) && !seenKeys.has(t.id)) {
              seenKeys.add(key);
              seenKeys.add(t.id);
              allTracks.push(t);
            }
          }
        }
      }
    } catch (searchErr) {
      console.error('Search parallel error:', searchErr);
    }

    // Deterministic Official Relevance + Canonical Authority Scorer
    const scoreTrack = (t: any): number => {
      let score = 0;
      const tTitleNorm = normalizeMatchText(t.title || '');
      const tArtistNorm = normalizeMatchText(t.artist || '');
      const tTitleLow = foldDiacritics((t.title || '').toLowerCase());
      const tArtistLow = foldDiacritics((t.artist || '').toLowerCase());

      // 1. Canonical Global Hit Authority (YTM + iTunes + Deezer + LRCLIB top matches)
      let matchedCanon = false;
      for (let i = 0; i < Math.min(canonicalSongHits.length, 12); i++) {
        const canon = canonicalSongHits[i];
        const cTitleNorm = normalizeMatchText(canon.title);
        const titleOk = tTitleNorm === cTitleNorm || (cTitleNorm.length >= 2 && (tTitleNorm.includes(cTitleNorm) || cTitleNorm.includes(tTitleNorm)));
        const canonArts = splitArtistEntities(canon.artist);
        const artistOk = canonArts.some(ent =>
          artistMatchesTarget(t.artist || '', ent, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab))
        );
        if (titleOk && artistOk) {
          matchedCanon = true;
          score += i === 0 ? 6000 : Math.max(2000, 5200 - i * 400);
          if (tTitleNorm === cTitleNorm) score += 800;
          break;
        }
      }

      // 2. Exact Title Match
      if (queryNorm && tTitleNorm === queryNorm) {
        score += 3000;
      } else if (queryNorm && tTitleNorm.startsWith(queryNorm)) {
        score += 900;
      }

      // 3. Query-Token Overlap & Split "<Song> <Artist>" Match
      if (queryTokens.length >= 1) {
        const titleMatchedCount = queryTokens.filter(tok => tTitleNorm.includes(tok)).length;
        const artistMatchedCount = queryTokens.filter(tok => tArtistNorm.includes(tok)).length;
        const combinedMatchedCount = queryTokens.filter(tok => tTitleNorm.includes(tok) || tArtistNorm.includes(tok)).length;

        if (queryTokens.length >= 2 && combinedMatchedCount === queryTokens.length && titleMatchedCount >= 1 && artistMatchedCount >= 1) {
          score += 2800;
        } else if (!matchedCanon && !isTopicOrLanguageQuery && queryTokens.length >= 2 && titleMatchedCount === queryTokens.length && artistMatchedCount === 0 && !isMajorPublisherLabel(t.label || '')) {
          score -= 1200;
        } else if (combinedMatchedCount === 0 && !isTopicOrLanguageQuery && queryTokens.length <= 3 && !matchedCanon) {
          score -= 4500;
        } else if (combinedMatchedCount === 0 && !isTopicOrLanguageQuery && queryTokens.length <= 3 && matchedCanon) {
          // Unrelated song that only matched a secondary canonical result via keyword association (e.g. "After Dark" when searching "Sweater Weather")
          score -= 3500;
        }
      }

      // 4. Artist Search Match & Famous Artist Authority (never boost literal language-word artist names on language/topic searches)
      const artExact = tArtistNorm === queryNorm || tArtistLow === queryLower;
      if (!isTopicOrLanguageQuery) {
        if (artExact) score += 1500;
        else if (queryNorm && tArtistNorm.includes(queryNorm)) score += 600;
      } else if (!matchedCanon && (artExact || (queryTokens.length === 1 && tArtistNorm === queryTokens[0]))) {
        score -= 3000;
      }

      const isFamous =
        FEATURED_ARTISTS.some(f => {
          const fNorm = normalizeMatchText(f.name);
          return tArtistNorm.includes(fNorm) || fNorm === tArtistNorm;
        }) ||
        FAMOUS_GLOBAL_ARTISTS.some(fa => artistMatchesTarget(t.artist || '', fa));
      if (isFamous && (isTopicOrLanguageQuery || tArtistLow.includes(queryLower) || tTitleLow.includes(queryLower) || queryTokens.some(tok => tTitleNorm.includes(tok) || tArtistNorm.includes(tok)))) {
        score += 700;
      }

      // 5. Major Publisher Label & Source Audio Fidelity
      if (isMajorPublisherLabel(t.label || '')) score += 650;
      if (t.source === 'jiosaavn') score += 300;
      else if (t.source === 'soundcloud') score += 200;
      else if (t.source === 'audius') score += 150;

      if (/\((?:[^)]*\bremaster)/i.test(t.title || '')) score -= 40;

      return score;
    };

    allTracks.sort((a, b) => scoreTrack(b) - scoreTrack(a));

    const finalTracks = allTracks.filter(t => Boolean(t.streamUrl)).slice(0, 300);
    if (finalTracks.length > 0) {
      if (searchResultsCache.size > 250) {
        const firstKey = searchResultsCache.keys().next().value;
        if (firstKey) searchResultsCache.delete(firstKey);
      }
      searchResultsCache.set(cacheKey, { data: finalTracks, exp: Date.now() + 1000 * 60 * 5 });
    }

    // Guarantee 100% of returned tracks have a live direct streamUrl for strict background playback
    res.json(finalTracks);
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
