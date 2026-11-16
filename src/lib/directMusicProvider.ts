import CryptoJS from 'crypto-js';
import { Artist, Track } from '../types';
import { isNativeAndroid } from './apiConfig';
import { AuraMedia3 } from './nativeAudioBridge';

const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';

const SAAVN_HEADERS: Record<string, string> = {
  'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 13)',
  Accept: 'application/json, text/plain, */*',
  'X-Forwarded-For': '49.36.120.10',
};

const SAAVN_WEB_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'X-Forwarded-For': '49.36.120.10',
};

const saavnJsonCache = new Map<string, { data: any; exp: number }>();

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
  options: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string; timeoutMs?: number } = {}
): Promise<any> {
  const res = await nativeAwareFetchText(url, options);
  if (!res || res.status < 200 || res.status >= 300 || !res.body) return null;
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

async function fetchSaavnJson(url: string, timeoutMs: number = 5000): Promise<any> {
  const now = Date.now();
  const cached = saavnJsonCache.get(url);
  if (cached && cached.exp > now) return cached.data;

  const androidUrl = url.replace(/ctx=web6dot0/g, 'ctx=android');
  let res = await nativeAwareFetchText(androidUrl, { headers: SAAVN_HEADERS, timeoutMs });
  if (!res || res.status === 403 || res.status === 429) {
    res = await nativeAwareFetchText(url, { headers: SAAVN_WEB_HEADERS, timeoutMs });
  }
  if (!res || res.status < 200 || res.status >= 300 || !res.body) return null;
  try {
    const data = JSON.parse(res.body);
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
    .filter((tok) => {
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

function splitArtistEntities(artistStr: string): string[] {
  return cleanText(artistStr || '')
    .split(/[,&/+×]|(?:\s+(?:feat\.?|ft\.?|featuring|with|vs\.?|x)\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleHasArtistCredit(title: string, targetArtist: string): boolean {
  const tClean = foldDiacritics(cleanText(title || '')).toLowerCase();
  const target = foldDiacritics(cleanText(targetArtist || '')).toLowerCase();
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
  const targetClean = foldDiacritics(cleanText(targetArtist || '')).toLowerCase();
  const targetCompact = targetClean.replace(/[^\p{L}\p{N}]/gu, '');
  const targetSpaced = targetClean.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!targetCompact) return false;

  if (trackArtist) {
    for (const ent of splitArtistEntities(trackArtist)) {
      const entLower = foldDiacritics(ent).toLowerCase();
      if (
        entLower.replace(/[^\p{L}\p{N}]/gu, '') === targetCompact ||
        entLower.replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === targetSpaced
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
  'silent records', 'big beat records', 'dj snake music',
];

function isMajorPublisherLabel(labelOrChannel: string): boolean {
  const low = foldDiacritics(cleanText(labelOrChannel || '')).toLowerCase();
  return Boolean(low && OFFICIAL_MAJOR_PUBLISHERS.some((pub) => low.includes(pub)));
}

const VERIFIED_OFFICIAL_DJS = new Set([
  'dj snake', 'dj khaled', 'dj premier', 'dj shadow', 'dj mustard', 'dj drama',
  'dj tiesto', 'dj fresh', 'dj jazzy jeff', 'dj luian', 'dj maphorisa', 'dj chetas',
  'dj cassette', 'dj spinall', 'dj kentaro', 'dj krush', 'dj koze', 'dj seinfeld',
  'djoko', 'dj boring', 'dj rashad',
]);

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
  'leonie carter', 'tiffany mason', 'the braids', 'musical mania', 'wonderoos', 'xooos',
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
  'wiz khalifa', 'chappell roan', 'djo', 'the killers', 'vance joy',
];

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
    'leonie carter', 'tiffany mason', 'the braids', 'musical mania', 'wonderoos', 'xooos',
  ];
  if (strictBadSubstrings.some((p) => fullText.includes(p))) return true;

  if (/\bmixtape\b/i.test(trackText)) return true;
  const queryWantsLofi = /\blo-?fi\b/i.test(qLower);
  if (!queryWantsLofi && /\blo-?fi\b|\blofi\b|\bphonk\b/i.test(fullText)) return true;

  if (/\s+x\s+[^-]+\s+x\s+/i.test(tCombined) || (!isMajorPublisherLabel(label) && /\b(?:after dark|sweater weather|perfect girl)\s+x\s+/i.test(tCombined))) {
    return true;
  }
  if (albLower === 'fart' || albLower === 'test') return true;

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
    /\((?:[^)]*\bextended\b[^)]*)\)|\[(?:[^\]]*\bextended\b[^\]]*)\]|\bextended\s+(?:mix|version|edit|cut)\b/i,
  ];
  if (titleRegexes.some((rx) => rx.test(tCombined))) return true;

  for (const m of tCombined.matchAll(/\(([^)]*\bedit\b[^)]*)\)|\[([^\]]*\bedit\b[^\]]*)\]/gi)) {
    const inner = (m[1] || m[2] || '').toLowerCase();
    const isOfficialEdit = /\b(?:radio|single|album|video|clean|explicit|main|original|short|uk|us|international)\s+edit\b/.test(inner);
    if (!isOfficialEdit) return true;
  }

  if (!queryWantsAcoustic && /\((?:[^)]*\bacoustic\b[^)]*)\)|\[(?:[^\]]*\bacoustic\b[^\]]*)\]|\bacoustic\s+(?:version|cover|mix|edit|session)\b/i.test(tCombined)) {
    return true;
  }

  if (/\b(?:karaoke|tribute|cover|arcade|sleep|study|meditation|instrumental|violinist|pianist|guitarist|cellist|8-bit|16-bit)\b/i.test(aLower)) {
    return true;
  }
  if (!queryWantsLofi && /\b(?:lofi|lo-fi)\b/i.test(aLower)) {
    return true;
  }
  if (/\bdj\b/i.test(aLower)) {
    const artistEnts = splitArtistEntities(aLower).map((e) => foldDiacritics(e).trim());
    const hasLegitDj = artistEnts.some((e) => VERIFIED_OFFICIAL_DJS.has(e)) || isMajorPublisherLabel(label);
    if (!hasLegitDj && /\b(?:dj\s*(?:mix|remix|nedo|johal)|dance\s+dj|club\s+dj)\b/i.test(aLower)) {
      return true;
    }
  }
  return false;
}

function hasUnauthorizedFamousAttribution(title: string, rawTitle: string, artist: string, label: string = ''): boolean {
  const combined = foldDiacritics(`${title} ${rawTitle}`).toLowerCase();
  if (!combined || isMajorPublisherLabel(label)) return false;
  for (const fa of FAMOUS_GLOBAL_ARTISTS) {
    const esc = escapeRegExp(fa);
    const rx = new RegExp(`(?:^|\\s-\\s*|\\bby\\s+|[,&×]\\s*|\\s)${esc}(?:\\s*-|\\s*$|\\s*\\(|\\s*\\[|[,&×])`, 'i');
    if (rx.test(combined) && !artistMatchesTarget(artist, fa, '', false) && !artistMatchesTarget(label, fa, '', false)) {
      return true;
    }
  }
  return false;
}

function isOfficialPublisherTrack(track: any, query: string = '', strictArtistTarget: string = ''): boolean {
  if (!track || !track.title) return false;
  if (isUnofficialOrRemix(track.title, track.artist, track.album, track.rawTitle || '', track.label || '', query)) {
    return false;
  }
  const dur = Number(track.duration) || 0;
  if (dur > 0 && (dur < 60000 || dur > 900000)) return false;

  const aLower = foldDiacritics((track.artist || '').toLowerCase());
  const entities = splitArtistEntities(track.artist || '').map((e) => foldDiacritics(e.toLowerCase()));
  if (IMPOSTOR_STUDIOS.some((imp) => aLower === imp || entities.includes(imp) || (imp.length >= 5 && aLower.includes(imp)))) {
    return false;
  }

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

interface CanonicalTrackMeta {
  title: string;
  artist: string;
  duration?: number;
}

function mapSoundCloudTrackMeta(
  t: any,
  query: string = '',
  strictArtistTarget: string = '',
  canonicalRefs: CanonicalTrackMeta[] = []
): any | null {
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
  const isOfficialLabelOrArtist = isVerifiedUser || isMajorPublisherLabel(labelName) || isMajorPublisherLabel(userChannel);

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

  if (!isVerifiedUser && !isOfficialLabelOrArtist && !matchesCanonicalMaster) return null;

  const rawAlbum = cleanText(t.publisher_metadata?.album_title || '');
  const albumName =
    rawAlbum && !['fart', 'test', 'none', 'na'].includes(rawAlbum.toLowerCase()) && rawAlbum.length > 1
      ? rawAlbum
      : cleanText(t.label_name || '') || 'Official Release';

  for (const fa of FAMOUS_GLOBAL_ARTISTS) {
    if (artistMatchesTarget(artistName, fa, rawTitle, true)) {
      const channelIsRealArtist = artistMatchesTarget(userChannel, fa) || artistMatchesTarget(userFullName, fa);
      const isAuthorizedPublisher =
        isMajorPublisherLabel(userChannel) || isMajorPublisherLabel(labelName) || followers >= 200000 || matchesCanonicalMaster;
      if (!channelIsRealArtist && !isAuthorizedPublisher) {
        return null;
      }
    }
  }

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
  const coverUrl = rawCover
    ? rawCover.replace(/-(?:large|badge|small|tiny|mini|crop|t67x67|t120x120|t200x200|t300x300)(?=\.[a-z0-9]+(?:$|\?))/i, '-t500x500')
    : DEFAULT_COVER;
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

async function resolveScTrackBatch(items: any[], limit: number = 24): Promise<any[]> {
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
    `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&limit=40&app_name=AuraMusic`,
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
      label: cleanArt,
      coverUrl: t.artwork?.['1000x1000'] || t.artwork?.['480x480'] || DEFAULT_COVER,
      streamUrl,
      previewUrl: streamUrl,
      duration: durationMs,
      source: 'audius',
    });
  }
  return out;
}

async function searchSoundCloudRawItems(query: string, pages: number = 2): Promise<any[]> {
  const cid = await getSoundCloudClientId();
  const offsets = pages >= 2 ? [0, 50] : [0];
  const pagesData = await Promise.all(
    offsets.map((offset) =>
      fetchJson(
        `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${cid}&limit=50&offset=${offset}`,
        { timeoutMs: 4500 }
      )
    )
  );
  return pagesData.flatMap((d) => d?.collection || []);
}

async function fetchSaavnAutocompleteTracks(query: string): Promise<any[]> {
  const ac = await fetchSaavnJson(
    `https://www.jiosaavn.com/api.php?__call=autocomplete.get&api_version=4&_format=json&_marker=0&ctx=web6dot0&query=${encodeURIComponent(query)}`,
    4000
  );
  const ids = (ac?.songs?.data || []).map((s: any) => s?.id).filter(Boolean).slice(0, 6);
  if (ids.length === 0) return [];
  const det = await fetchSaavnJson(
    `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${encodeURIComponent(ids.join(','))}&api_version=4&_format=json&_marker=0&ctx=web6dot0`,
    4000
  );
  return (det?.songs || []).map(mapJioSaavnSong).filter((t: any) => Boolean(t.streamUrl));
}

function detectRegionalItunesStores(query: string): string[] {
  const q = (query || '').toLowerCase();
  const stores = new Set<string>(['us']);
  if (/[\u3040-\u30ff]|\b(?:japanese|j-?pop|anime|yoasobi|ado|kenshi|fujii|official hige|radwimps)\b/i.test(query)) stores.add('jp');
  if (/[\uac00-\ud7af]|\b(?:korean|k-?pop|bts|blackpink|newjeans|stray kids|twice|ive|aespa|psy|gangnam)\b/i.test(query)) stores.add('kr');
  if (/[\u4e00-\u9faf]|\b(?:chinese|mandopop|cantopop|c-?pop|jay chou|eason chan|jolin|mayday)\b/i.test(query)) {
    stores.add('tw');
    stores.add('hk');
  }
  if (/[\u0900-\u0d7f]|\b(?:hindi|punjabi|tamil|telugu|bollywood|malayalam|kannada|marathi|desi|arijit|diljit|karan aujla|sidhu|shubh|ap dhillon)\b/i.test(query)) {
    stores.add('in');
  }
  if (/\b(?:spanish|latin|reggaeton|corridos|bachata|salsa|bad bunny|karol g|feid|peso pluma|grupo frontera|shakira|rosalia|enrique|despacito|bailando)\b/i.test(q)) {
    stores.add('es');
    stores.add('mx');
  }
  if (/\b(?:french|français|francais|stromae|indila|aya nakamura|gims|alors on danse)\b/i.test(q)) stores.add('fr');
  if (/\b(?:german|deutsch|rammstein|nena|luftballons|apache 207|cro)\b/i.test(q)) stores.add('de');
  if (/\b(?:italian|italiano|maneskin|eros ramazzotti|laura pausini|mahmood)\b/i.test(q)) stores.add('it');
  if (/\b(?:portuguese|brazil|brazilian|sertanejo|anitta|bossa nova)\b/i.test(q)) stores.add('br');
  if (/[\u0600-\u06ff]|\b(?:arabic|habibi|amr diab|nancy ajram|fairuz|tamally)\b/i.test(query)) stores.add('ae');
  if (/\b(?:turkish|türkçe|turkce|tarkan)\b/i.test(q)) stores.add('tr');
  return Array.from(stores).slice(0, 3);
}

async function searchItunesMetadataTracks(query: string): Promise<any[]> {
  try {
    const stores = detectRegionalItunesStores(query);
    const nonUsStore = stores.find((s) => s !== 'us');
    const isPureLanguageQuery = /^(?:japanese|korean|chinese|mandopop|cantopop|j-?pop|k-?pop|c-?pop|french|german|italian|portuguese|arabic|turkish|spanish|latin)(?:\s+(?:songs?|hits?|music|top))?$/i.test(query.trim());

    const [responses, regionalRssJson] = await Promise.all([
      Promise.all(
        stores.map((country) =>
          fetchJson(
            `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=${country}&media=music&entity=song&limit=25`,
            { timeoutMs: 3800 }
          )
        )
      ),
      isPureLanguageQuery && nonUsStore
        ? fetchJson(`https://itunes.apple.com/${nonUsStore}/rss/topsongs/limit=15/json`, { timeoutMs: 3800 })
        : Promise.resolve(null),
    ]);

    const out: any[] = [];
    const seen = new Set<string>();

    const rssEntries = regionalRssJson?.feed?.entry || [];
    for (let i = 0; i < rssEntries.length; i++) {
      const entry = rssEntries[i];
      const rawTitle = cleanText(entry?.['im:name']?.label || '');
      const artistName = cleanText(entry?.['im:artist']?.label || '');
      const albumName = cleanText(entry?.['im:collection']?.['im:name']?.label || 'Regional Top Hits');
      if (!rawTitle || !artistName) continue;
      const cleanT = cleanSongTitle(rawTitle, artistName) || rawTitle;
      if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName }, query)) continue;
      const k = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
      if (!k || k === ':::' || seen.has(k)) continue;
      seen.add(k);
      const imgs = entry?.['im:image'] || [];
      const coverRaw = imgs[imgs.length - 1]?.label || '';
      out.push({
        title: cleanT,
        rawTitle,
        artist: artistName,
        album: albumName,
        coverUrl: coverRaw ? coverRaw.replace(/\d+x\d+bb/, '600x600bb') : '',
        duration: 0,
        rank: Math.max(600000, 950000 - i * 18000),
      });
    }

    for (const json of responses) {
      const results = json?.results || [];
      for (let i = 0; i < results.length; i++) {
        const t = results[i];
        if (!t?.trackName || !t?.artistName) continue;
        const rawTitle = cleanText(t.trackName);
        const cleanT = cleanSongTitle(rawTitle, t.artistName) || rawTitle;
        const artistName = cleanText(t.artistName);
        const albumName = cleanText(t.collectionName || 'Official Release');
        const durationMs = Number(t.trackTimeMillis) || 0;
        if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName, duration: durationMs }, query)) continue;
        const k = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
        if (!k || k === ':::' || seen.has(k)) continue;
        seen.add(k);
        const coverRaw = t.artworkUrl100 || '';
        out.push({
          title: cleanT,
          rawTitle,
          artist: artistName,
          album: albumName,
          coverUrl: coverRaw ? coverRaw.replace(/\d+x\d+bb/, '600x600bb') : '',
          duration: durationMs,
          rank: Math.max(250000, (isPureLanguageQuery ? 720000 : 900000) - i * 32000),
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function searchDeezerMetadataTracks(query: string): Promise<any[]> {
  if (typeof window !== 'undefined' && !isNativeAndroid()) {
    return [];
  }
  const p1 = await fetchJson(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=40&index=0`, { timeoutMs: 4000 });
  const out: any[] = [];
  const seen = new Set<string>();
  for (const t of p1?.data || []) {
    if (!t?.title || !t?.artist?.name) continue;
    const rawTitle = cleanText(t.title || t.title_short);
    const cleanT = cleanText(t.title_short || t.title);
    const artistName = cleanText(t.artist.name);
    const albumName = cleanText(t.album?.title || 'Official Release');
    const durationMs = (Number(t.duration) || 0) * 1000;
    if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName, duration: durationMs }, query)) continue;
    const k = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
    if (!k || k === ':::' || seen.has(k)) continue;
    seen.add(k);
    out.push({
      title: cleanT,
      rawTitle,
      artist: artistName,
      album: albumName,
      coverUrl: t.album?.cover_xl || t.album?.cover_big || '',
      duration: durationMs,
      rank: Number(t.rank) || 0,
    });
  }
  return out;
}

async function searchYouTubeMusicMetadata(query: string): Promise<any[]> {
  if (!query || !isNativeAndroid()) return [];
  const data = await fetchJson('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240724.00.00', hl: 'en', gl: 'US' } },
      query,
      params: 'EgWKAQIIAWoMEAMQBBAJEAoQBRAV',
    }),
    timeoutMs: 4200,
  });
  const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs || [];
  const sections = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  const shelf = sections.find((s: any) => s.musicShelfRenderer)?.musicShelfRenderer;
  const contents = shelf?.contents || [];
  const out: any[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < Math.min(contents.length, 25); i++) {
    const r = contents[i]?.musicResponsiveListItemRenderer;
    if (!r) continue;
    const cols = r.flexColumns || [];
    const rawTitle = cleanText((cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []).map((x: any) => x.text).join(''));
    if (!rawTitle) continue;
    const metaRuns = (cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []).map((x: any) => x.text || '');
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
    const nonDurSegs = segments.filter(
      (s) => !/^(?:Song|Video|Single|EP|Album)$/i.test(s) && !/^(?:\d+:)?\d{1,2}:\d{2}$/.test(s) && !/plays|views/i.test(s)
    );
    const artistName = cleanText(nonDurSegs[0] || '');
    const albumName = cleanText(nonDurSegs[1] || 'Official Release');
    if (!artistName) continue;
    const cleanT = cleanSongTitle(rawTitle, artistName) || rawTitle;
    if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName }, query)) continue;
    const k = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
    if (!k || k === ':::' || seen.has(k)) continue;
    seen.add(k);
    const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    const rawThumb = thumbs[thumbs.length - 1]?.url || '';
    out.push({
      title: cleanT,
      rawTitle,
      artist: artistName,
      album: albumName,
      coverUrl: rawThumb
        ? rawThumb
            .replace(/=w\d+-h\d+[^&]*/, '=w600-h600-l90-rj')
            .replace(/=s\d+[^&]*/, '=w600-h600-l90-rj')
        : '',
      duration: 0,
      rank: Math.max(400000, 960000 - i * 35000),
    });
  }
  return out;
}

async function searchLrclibMetadataTracks(query: string): Promise<any[]> {
  if (!query || query.length < 3) return [];
  const list = await fetchJson(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, { timeoutMs: 3800 });
  if (!Array.isArray(list)) return [];
  const out: any[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < Math.min(list.length, 15); i++) {
    const item = list[i];
    const rawTitle = cleanText(item?.trackName || item?.name || '');
    const artistName = cleanText(item?.artistName || '');
    const albumName = cleanText(item?.albumName || 'Official Release');
    const durationMs = (Number(item?.duration) || 0) * 1000;
    if (!rawTitle || !artistName) continue;
    const cleanT = cleanSongTitle(rawTitle, artistName) || rawTitle;
    if (!isOfficialPublisherTrack({ title: cleanT, rawTitle, artist: artistName, album: albumName, duration: durationMs }, query)) continue;
    const k = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(artistName)}`;
    if (!k || k === ':::' || seen.has(k)) continue;
    seen.add(k);
    out.push({
      title: cleanT,
      rawTitle,
      artist: artistName,
      album: albumName,
      coverUrl: '',
      duration: durationMs,
      rank: Math.max(200000, 650000 - i * 25000),
    });
  }
  return out;
}

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

  const canonicalRef: CanonicalTrackMeta[] = artistEntities.map((ent) => ({ title: cleanTitle, artist: ent, duration: targetDurationMs }));
  const matchesTrack = (t: any) => {
    if (!t?.streamUrl) return false;
    const candNorm = normalizeMatchText(t.title || '');
    if (!candNorm || !(candNorm === targetTitleNorm || candNorm.includes(targetTitleNorm) || targetTitleNorm.includes(candNorm))) {
      return false;
    }
    if (artistEntities.length > 0) {
      return artistEntities.some((ent) =>
        artistMatchesTarget(t.artist || '', ent, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab))
      );
    }
    return true;
  };

  const [saavnRes, scRaw, audiusTracks] = await Promise.all([
    fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=10&p=1`, 4000),
    searchSoundCloudRawItems(query, 1).catch(() => []),
    searchAudiusTracks(query, primaryArtist).catch(() => []),
  ]);

  let saavnCandidates = (saavnRes?.results || [])
    .map(mapJioSaavnSong)
    .filter((t: any) => t.streamUrl && isOfficialPublisherTrack(t, query, primaryArtist));

  if (!saavnCandidates.some(matchesTrack) && asciiTitle && asciiTitle.toLowerCase() !== query.toLowerCase()) {
    const saavnTitleRes = await fetchSaavnJson(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(asciiTitle)}&n=10&p=1`,
      3800
    );
    const titleCandidates = (saavnTitleRes?.results || [])
      .map(mapJioSaavnSong)
      .filter((t: any) => t.streamUrl && isOfficialPublisherTrack(t, query, primaryArtist));
    saavnCandidates = [...saavnCandidates, ...titleCandidates];
  }

  const directMatch = saavnCandidates.find(matchesTrack) || audiusTracks.find(matchesTrack);
  if (directMatch) {
    return {
      ...directMatch,
      title: cleanTitle,
      coverUrl: coverOverride || directMatch.coverUrl,
      album: albumOverride || directMatch.album,
    };
  }

  const scMetas = scRaw
    .map((raw) => mapSoundCloudTrackMeta(raw, query, primaryArtist, canonicalRef))
    .filter((m) => m && matchesTrack(m));
  if (scMetas.length > 0) {
    const resolvedSc = await resolveScTrackBatch(scMetas, 1);
    if (resolvedSc[0]) {
      return {
        ...resolvedSc[0],
        title: cleanTitle,
        coverUrl: coverOverride || resolvedSc[0].coverUrl,
        album: albumOverride || resolvedSc[0].album,
      };
    }
  }
  return null;
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

const directSearchCache = new Map<string, { data: Track[]; exp: number }>();

export async function directSearchTracks(query: string): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = normalizeMatchText(trimmed) || trimmed.toLowerCase();
  const cached = directSearchCache.get(cacheKey);
  if (cached && cached.exp > Date.now() && cached.data.length > 0) {
    return cached.data;
  }

  const qLower = foldDiacritics(trimmed).toLowerCase();
  const queryNorm = normalizeMatchText(trimmed);
  const queryTokens = extractQueryTokens(queryNorm);
  const isTopicOrLanguageQuery = /\b(?:songs?|hits?|music|playlist|mix|vibes?|chill|sad|love|romantic|party|workout|rock|pop|hip\s*hop|rap|jazz|classical|japanese|korean|chinese|mandopop|cantopop|hindi|punjabi|tamil|telugu|malayalam|spanish|latin|reggaeton|french|german|italian|portuguese|arabic|turkish|k-?pop|j-?pop|c-?pop|bollywood)\b/i.test(qLower);

  if (/^(?:global top hits(?:\s+official|\s+english)?|top global|global hits)$/i.test(qLower)) {
    const [englishPl, trendPl] = await Promise.all([
      fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=1081991857&api_version=4&_format=json&_marker=0&ctx=web6dot0'),
      fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=110858205&api_version=4&_format=json&_marker=0&ctx=web6dot0'),
    ]);
    const songs = [...(englishPl?.list || []), ...(trendPl?.list || [])]
      .map(mapJioSaavnSong)
      .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t));
    if (songs.length > 0) return songs;
  }

  const asciiQuery = foldDiacritics(trimmed).replace(/[!?'".]/g, ' ').replace(/\s+/g, ' ').trim();
  const saavnQuery = asciiQuery || trimmed;

  const [
    saavnP1,
    saavnP2,
    artSearch,
    plSearch,
    scRawItems,
    ytmMeta,
    itunesMeta,
    deezerMeta,
    lrclibMeta,
    audiusTracks,
  ] = await Promise.all([
    fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(saavnQuery)}&n=50&p=1`),
    fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(saavnQuery)}&n=50&p=2`),
    fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(saavnQuery)}&n=2&p=1`),
    fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(saavnQuery)}&n=3&p=1`),
    searchSoundCloudRawItems(saavnQuery, 2).catch(() => []),
    searchYouTubeMusicMetadata(trimmed).catch(() => []),
    searchItunesMetadataTracks(trimmed).catch(() => []),
    searchDeezerMetadataTracks(trimmed).catch(() => []),
    searchLrclibMetadataTracks(trimmed).catch(() => []),
    searchAudiusTracks(trimmed).catch(() => []),
  ]);

  const saavnRawCount = (saavnP1?.results?.length || 0) + (saavnP2?.results?.length || 0);
  const saavnAc = saavnRawCount < 10 ? await fetchSaavnAutocompleteTracks(saavnQuery).catch(() => []) : [];

  const canonicalMap = new Map<string, any>();
  for (const c of [...ytmMeta, ...itunesMeta, ...deezerMeta, ...lrclibMeta]) {
    const tn = normalizeMatchText(c.title || '');
    const an = normalizeMatchText(c.artist || '');
    if (!tn || !an) continue;
    const ck = `${tn}:::${an}`;
    const existing = canonicalMap.get(ck);
    const w = Number(c.rank) || 350000;
    if (!existing) {
      canonicalMap.set(ck, { ...c, rank: w });
    } else {
      if (w > existing.rank) existing.rank = w;
      if (!existing.coverUrl && c.coverUrl) existing.coverUrl = c.coverUrl;
      if (!existing.duration && c.duration) existing.duration = c.duration;
    }
  }
  const canonicalSongHits = Array.from(canonicalMap.values()).sort((a, b) => (b.rank || 0) - (a.rank || 0));

  const canonicalRefs: CanonicalTrackMeta[] = canonicalSongHits.slice(0, 14).map((c) => ({
    title: c.title,
    artist: c.artist,
    duration: c.duration || 0,
  }));

  const isFeaturedArtistQuery = DIRECT_FEATURED_ARTISTS.some((f) => foldDiacritics(f.name).toLowerCase() === qLower);
  const verifiedArtistMatchCount = [...ytmMeta, ...itunesMeta, ...deezerMeta].filter((t) => artistMatchesTarget(t.artist, trimmed)).length;
  const hasDominantSongTitleMatch = canonicalSongHits.some(
    (c) => normalizeMatchText(c.title) === queryNorm && !artistMatchesTarget(c.artist, trimmed) && (c.rank || 0) >= 450000
  );
  const isArtistQuery = isFeaturedArtistQuery || (!isTopicOrLanguageQuery && verifiedArtistMatchCount >= 3 && !hasDominantSongTitleMatch);

  let artistTopTracks: any[] = [];
  if (isArtistQuery) {
    const exactArt = (artSearch?.results || []).find((a: any) => artistMatchesTarget(a?.name || '', trimmed));
    if (exactArt?.id) {
      const artPage = await fetchSaavnJson(
        `https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&artistId=${exactArt.id}&api_version=4&_format=json&_marker=0&ctx=web6dot0&n_song=80`
      );
      artistTopTracks = (artPage?.topSongs || [])
        .map(mapJioSaavnSong)
        .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, trimmed, cleanText(exactArt.name || trimmed)));
    }
  }

  const scMetas = scRawItems
    .map((raw) => mapSoundCloudTrackMeta(raw, trimmed, '', canonicalRefs))
    .filter(Boolean);
  const scTracks = await resolveScTrackBatch(scMetas, 22);

  let playlistTracks: any[] = [];
  if ((isTopicOrLanguageQuery || !hasDominantSongTitleMatch) && Array.isArray(plSearch?.results) && plSearch.results.length > 0) {
    const plBatches = await Promise.all(
      plSearch.results.slice(0, 2).map((pl: any) =>
        fetchSaavnJson(`https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${pl.id}&api_version=4&_format=json&_marker=0&ctx=web6dot0`)
      )
    );
    playlistTracks = plBatches
      .flatMap((d) => d?.list || [])
      .map(mapJioSaavnSong)
      .filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, trimmed))
      .slice(0, 40);
  }

  const allSaavn = [
    ...artistTopTracks,
    ...saavnAc,
    ...((saavnP1?.results || []).map(mapJioSaavnSong)),
    ...((saavnP2?.results || []).map(mapJioSaavnSong)),
    ...playlistTracks,
  ].filter((t: any) => Boolean(t.streamUrl) && isOfficialPublisherTrack(t, trimmed));

  const seen = new Set<string>();
  const collected: any[] = [];
  for (const item of [...allSaavn, ...scTracks, ...audiusTracks]) {
    const cleanT = item.source === 'jiosaavn' ? cleanSongTitle(item.title, item.artist) : item.title;
    if (!item.streamUrl || !cleanT) continue;
    const key = `${normalizeMatchText(cleanT)}:::${normalizeMatchText(item.artist)}`;
    if (seen.has(key) || seen.has(item.id)) continue;
    seen.add(key);
    seen.add(item.id);
    collected.push({ ...item, title: cleanT });
  }

  const missingCanon = canonicalSongHits
    .filter((c) => {
      const ctn = normalizeMatchText(c.title);
      const ents = splitArtistEntities(c.artist);
      return !collected.some(
        (ex) =>
          (normalizeMatchText(ex.title) === ctn || normalizeMatchText(ex.title).includes(ctn)) &&
          ents.some((e) => artistMatchesTarget(ex.artist, e, ex.rawTitle || ex.title || '', Boolean(ex.allowTitleCollab)))
      );
    })
    .slice(0, 8);

  if (missingCanon.length > 0) {
    const rescued = await Promise.all(
      missingCanon.map((c) => resolveDirectStreamTrack(c.title, c.artist, c.coverUrl || '', c.album || '', c.duration || 0))
    );
    for (const r of rescued) {
      if (!r?.streamUrl) continue;
      const key = `${normalizeMatchText(r.title)}:::${normalizeMatchText(r.artist)}`;
      if (!seen.has(key) && !seen.has(r.id)) {
        seen.add(key);
        seen.add(r.id);
        collected.push(r);
      }
    }
  }

  if (isTopicOrLanguageQuery && collected.length < 25 && canonicalSongHits.length > 0) {
    const topArtists = Array.from(
      new Set(canonicalSongHits.map((c) => splitArtistEntities(c.artist)[0]).filter((a) => a && a.length >= 2))
    ).slice(0, 3);
    if (topArtists.length > 0) {
      const [scRawBatches, audBatches] = await Promise.all([
        Promise.all(topArtists.map((art) => searchSoundCloudRawItems(art, 1).then((raws) => raws.map((r) => mapSoundCloudTrackMeta(r, art, art, canonicalRefs)).filter(Boolean)).catch(() => []))),
        Promise.all(topArtists.map((art) => searchAudiusTracks(art, art).catch(() => []))),
      ]);
      const scExtra = await resolveScTrackBatch(scRawBatches.flat(), 12);
      for (const r of [...scExtra, ...audBatches.flat()]) {
        if (!r?.streamUrl) continue;
        const key = `${normalizeMatchText(r.title)}:::${normalizeMatchText(r.artist)}`;
        if (!seen.has(key) && !seen.has(r.id)) {
          seen.add(key);
          seen.add(r.id);
          collected.push(r);
        }
      }
    }
  }

  const scoreTrack = (t: any): number => {
    let score = 0;
    const tTitleNorm = normalizeMatchText(t.title || '');
    const tArtistNorm = normalizeMatchText(t.artist || '');
    let matchedCanon = false;
    for (let i = 0; i < Math.min(canonicalSongHits.length, 12); i++) {
      const canon = canonicalSongHits[i];
      const cTitleNorm = normalizeMatchText(canon.title);
      const titleOk = tTitleNorm === cTitleNorm || (cTitleNorm.length >= 2 && (tTitleNorm.includes(cTitleNorm) || cTitleNorm.includes(tTitleNorm)));
      const artistOk = splitArtistEntities(canon.artist).some((ent) =>
        artistMatchesTarget(t.artist || '', ent, t.rawTitle || t.title || '', Boolean(t.allowTitleCollab))
      );
      if (titleOk && artistOk) {
        matchedCanon = true;
        score += i === 0 ? 6000 : Math.max(2000, 5200 - i * 400);
        if (tTitleNorm === cTitleNorm) score += 800;
        break;
      }
    }
    if (queryNorm && tTitleNorm === queryNorm) score += 3000;
    else if (queryNorm && tTitleNorm.startsWith(queryNorm)) score += 900;

    if (queryTokens.length >= 1) {
      const titleM = queryTokens.filter((tok) => tTitleNorm.includes(tok)).length;
      const artM = queryTokens.filter((tok) => tArtistNorm.includes(tok)).length;
      const combinedM = queryTokens.filter((tok) => tTitleNorm.includes(tok) || tArtistNorm.includes(tok)).length;
      if (queryTokens.length >= 2 && combinedM === queryTokens.length && titleM >= 1 && artM >= 1) score += 2800;
      else if (!matchedCanon && !isTopicOrLanguageQuery && queryTokens.length >= 2 && titleM === queryTokens.length && artM === 0 && !isMajorPublisherLabel(t.label || '')) score -= 1200;
      else if (combinedM === 0 && !isTopicOrLanguageQuery && queryTokens.length <= 3 && !matchedCanon) score -= 4500;
      else if (combinedM === 0 && !isTopicOrLanguageQuery && queryTokens.length <= 3 && matchedCanon) score -= 3500;
    }
    if (!isTopicOrLanguageQuery) {
      if (queryNorm && tArtistNorm === queryNorm) score += 1500;
      else if (queryNorm && tArtistNorm.includes(queryNorm)) score += 600;
    } else if (!matchedCanon && (tArtistNorm === queryNorm || (queryTokens.length === 1 && tArtistNorm === queryTokens[0]))) {
      score -= 3000;
    }
    if (FAMOUS_GLOBAL_ARTISTS.some((fa) => artistMatchesTarget(t.artist || '', fa)) && (isTopicOrLanguageQuery || tArtistNorm.includes(queryNorm) || queryTokens.some((tok) => tTitleNorm.includes(tok) || tArtistNorm.includes(tok)))) {
      score += 700;
    }
    if (isMajorPublisherLabel(t.label || '')) score += 650;
    if (t.source === 'jiosaavn') score += 300;
    else if (t.source === 'soundcloud') score += 200;
    return score;
  };

  collected.sort((a, b) => scoreTrack(b) - scoreTrack(a));

  const finalResults: Track[] = collected.slice(0, 300).map((item) => ({
    id: item.id,
    title: item.title,
    artist: item.artist,
    album: item.album || 'Single',
    coverUrl: item.coverUrl || DEFAULT_COVER,
    previewUrl: item.streamUrl,
    streamUrl: item.streamUrl,
    duration: item.duration || 0,
    label: item.label || '',
    source: item.source,
  }));

  if (finalResults.length > 0) {
    if (directSearchCache.size > 200) {
      const fk = directSearchCache.keys().next().value;
      if (fk) directSearchCache.delete(fk);
    }
    directSearchCache.set(cacheKey, { data: finalResults, exp: Date.now() + 1000 * 60 * 5 });
  }
  return finalResults;
}

export async function directGetCharts(): Promise<any[]> {
  const [chartsList, englishPl, audiusTrendingJson] = await Promise.all([
    fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=content.getCharts&api_version=4&_format=json&_marker=0&ctx=web6dot0'),
    fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=1081991857&api_version=4&_format=json&_marker=0&ctx=web6dot0'),
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
      const det = await fetchSaavnJson(
        `https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${listId}&api_version=4&_format=json&_marker=0&ctx=web6dot0`
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
      coverUrl: t.artwork?.['1000x1000'] || t.artwork?.['480x480'] || DEFAULT_COVER,
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
    fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=1081991857&api_version=4&_format=json&_marker=0&ctx=web6dot0'),
    fetchSaavnJson('https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=110858205&api_version=4&_format=json&_marker=0&ctx=web6dot0'),
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
    fetchSaavnJson(
      `https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}&n=20&p=1`
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
    const ar = await fetchSaavnJson(
      `https://www.jiosaavn.com/api.php?__call=search.getArtistResults&api_version=4&_format=json&_marker=0&ctx=web6dot0&q=${encodeURIComponent(artistObj.name)}&n=3&p=1`
    );
    const match = (ar?.results || []).find((a: any) => artistMatchesTarget(a?.name || '', artistObj!.name));
    if (match?.id) saavnId = String(match.id);
  }

  let discogTracks: Track[] = [];
  if (saavnId) {
    const pageData = await fetchSaavnJson(
      `https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&artistId=${saavnId}&api_version=4&_format=json&_marker=0&ctx=web6dot0&n_song=80&n_album=10`
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
