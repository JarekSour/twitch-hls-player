// Quita los segmentos de anuncio de una media playlist de Twitch. Al quitarlos hay que
// renumerar la playlist: hls.js usa la posición para identificar cada segmento.
(() => {
  const AD_TITLE = /^Amazon\b/;
  const DROPPED_TAG = /^#EXT-X-(MEDIA-SEQUENCE|DISCONTINUITY-SEQUENCE|START|TWITCH-)/;

  function parseAdRange(line) {
    if (!line.includes('CLASS="twitch-stitched-ad"')) return null;
    const start = Date.parse((line.match(/START-DATE="([^"]+)"/) || [])[1]);
    const duration = Number((line.match(/DURATION=([\d.]+)/) || [])[1]);
    if (Number.isNaN(start) || Number.isNaN(duration)) return null;
    return { start, end: start + duration * 1000 };
  }

  function parse(text) {
    const head = [];
    const segments = [];
    const adRanges = [];
    let map = null;
    let segment = {};

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF')) {
        segment.inf = line;
        segment.title = line.slice(line.indexOf(',') + 1);
      } else if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME')) {
        segment.pdt = line;
        segment.time = Date.parse(line.slice(line.indexOf(':') + 1));
      } else if (line.startsWith('#EXT-X-MAP')) {
        map = line;
      } else if (line === '#EXT-X-DISCONTINUITY') {
        segment.discontinuity = true;
      } else if (line.startsWith('#EXT-X-DATERANGE')) {
        const range = parseAdRange(line);
        if (range) adRanges.push(range);
      } else if (DROPPED_TAG.test(line)) {
        continue;
      } else if (line.startsWith('#')) {
        if (!segments.length) head.push(line);
      } else {
        segment.uri = line;
        segment.map = map;
        segments.push(segment);
        segment = {};
      }
    }

    for (const seg of segments) {
      seg.ad = AD_TITLE.test(seg.title || '')
        || adRanges.some((range) => seg.time >= range.start && seg.time < range.end);
    }
    return { head, segments };
  }

  function hasContent(text) {
    return parse(text).segments.some((seg) => !seg.ad);
  }

  function render(head, kept) {
    const lines = [...head];
    if (kept.length) {
      lines.push(`#EXT-X-MEDIA-SEQUENCE:${kept[0].sn}`);
      lines.push(`#EXT-X-DISCONTINUITY-SEQUENCE:${kept[0].cc}`);
    }

    let previous = null;
    for (const seg of kept) {
      if (previous && previous.cc !== seg.cc) lines.push('#EXT-X-DISCONTINUITY');
      if (seg.map && (!previous || previous.map !== seg.map)) lines.push(seg.map);
      if (seg.pdt) lines.push(seg.pdt);
      lines.push(seg.inf, seg.uri);
      previous = seg;
    }
    return lines.join('\n') + '\n';
  }

  // Cada playlist de cada calidad necesita su propio filtro: guarda la numeración entre recargas.
  function createFilter() {
    let seen = new Map();
    let nextSn = 0;
    let cc = 0;
    let gapPending = false;
    let lastOutput = null;

    return (text) => {
      const { head, segments } = parse(text);
      const current = new Map();
      const kept = [];

      for (const seg of segments) {
        const key = seg.pdt || seg.uri;
        let entry = seen.get(key);
        if (!entry) {
          gapPending = gapPending || seg.ad || Boolean(seg.discontinuity);
          if (seg.ad) {
            entry = { ad: true };
          } else {
            if (gapPending && nextSn > 0) cc += 1;
            gapPending = false;
            entry = { sn: nextSn, cc };
            nextSn += 1;
          }
        }
        current.set(key, entry);
        if (!entry.ad) kept.push({ ...seg, sn: entry.sn, cc: entry.cc });
      }
      seen = current;

      // Durante un anuncio se repite la última playlist: hls.js la ve sin novedades y espera.
      if (kept.length) lastOutput = render(head, kept);
      return lastOutput || render(head, kept);
    };
  }

  globalThis.TwitchPlaylist = { createFilter, hasContent };
})();
