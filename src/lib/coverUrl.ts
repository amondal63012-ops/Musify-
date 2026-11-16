export function upgradeArtworkUrl(url?: string | null): string {
  if (!url) return '';
  let next = url.trim();
  if (!next || next.startsWith('data:') || next.startsWith('blob:') || next.startsWith('/')) {
    return next;
  }

  // JioSaavn CDN thumbnails (-150x150.webp, -50x50.jpg, _150x150.webp, etc. -> 500x500)
  if (next.includes('saavncdn.com')) {
    next = next.replace(/([-_])(?:50x50|150x150)\.(jpg|jpeg|webp|png)(?=$|\?)/gi, '$1500x500.$2');
  }

  // SoundCloud CDN thumbnails (-large, -badge, -small, -tiny, -t67x67, etc. -> -t500x500)
  if (next.includes('sndcdn.com')) {
    next = next.replace(
      /-(?:large|badge|small|tiny|mini|crop|t67x67|t120x120|t200x200|t300x300)(?=\.[a-z0-9]+(?:$|\?))/i,
      '-t500x500'
    );
  }

  // Apple / iTunes mzstatic artwork
  if (next.includes('mzstatic.com')) {
    next = next.replace(/\d+x\d+bb/, '600x600bb');
  }

  // YouTube Music / Googleusercontent thumbnails
  if (next.includes('googleusercontent.com')) {
    if (/=w\d+-h\d+/.test(next)) {
      next = next.replace(/=w\d+-h\d+[^&]*/, '=w600-h600-l90-rj');
    } else if (/=s\d+/.test(next)) {
      next = next.replace(/=s\d+[^&]*/, '=w600-h600-l90-rj');
    }
  }

  // Deezer CDN thumbnails
  if (next.includes('dzcdn.net')) {
    next = next.replace(/\/(?:56x56|120x120|250x250|264x264)-/, '/1000x1000-');
  }

  // Gaana CDN thumbnails
  if (next.includes('gaanacdn.com')) {
    next = next.replace(/(?:size_xs|size_s|size_m|175x175|50x50)\.(jpg|jpeg|webp)/i, 'size_l.$1');
  }

  // Jamendo artwork query size
  if (next.includes('jamendo.com') && /([?&]width=)(?:50|100|150|200|300)\b/.test(next)) {
    next = next.replace(/([?&]width=)\d+\b/, '$1500');
  }

  return next;
}

export function getCrispCoverUrl(url?: string | null, fallback = ''): string {
  const upgraded = upgradeArtworkUrl(url);
  return upgraded || fallback;
}
