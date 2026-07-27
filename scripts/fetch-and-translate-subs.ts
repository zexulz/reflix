/*
  fetch-and-translate-subs.ts

  Fetches English subtitles for The Mentalist, translates to Ukrainian,
  saves as .srt files. Skips episodes that already have .srt files.

  Run: bun run fetch-and-translate-subs.ts
  Output: ./subtitles/5920_S1E1.srt, etc.
*/

import { promises as fs } from "node:fs";
import path from "node:path";

// ── CONFIG — change OPENSUBS_KEY when you get a new one ──
const OPENSUBS_KEY = "NEW_KEY_HERE"; // ← paste your new key here
const GOOGLE_KEY = "AIzaSyCYrf0rRI8BgNhbfjAw9oAxAu5m5eTMDfA";
const TMDB_KEY = "f39b856d71d391f85967aebf350576b8";
const TMDB_ID = 5920;
const OUT_DIR = path.join(process.cwd(), "subtitles");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const OS_HEADERS: Record<string, string> = {
  "Api-Key": OPENSUBS_KEY,
  "User-Agent": "ReflixSubs v1.0",
};

function extractTexts(srt: string): string[] {
  const texts: string[] = [];
  for (const line of srt.split("\n")) {
    const t = line.trim();
    if (!t || /^\d+$/.test(t) || /^\d{2}:\d{2}:\d{2}/.test(t) || t.includes("-->")) continue;
    texts.push(t);
  }
  return texts;
}

function replaceTexts(srt: string, translations: string[]): string {
  let idx = 0;
  return srt.split("\n").map(line => {
    const t = line.trim();
    if (!t || /^\d+$/.test(t) || /^\d{2}:\d{2}:\d{2}/.test(t) || t.includes("-->")) return line;
    return translations[idx++] ?? line;
  }).join("\n");
}

async function translateBatch(texts: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < texts.length; i += 50) {
    const batch = texts.slice(i, i + 50);
    let done = false;
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: batch, source: "en", target: "uk", format: "text" }),
        });
        if (res.ok) {
          const d = await res.json();
          out.push(...(d.data?.translations?.map((t: any) => t.translatedText) || batch));
          done = true;
        } else {
          await sleep(2000 * (attempt + 1));
        }
      } catch { await sleep(2000 * (attempt + 1)); }
    }
    if (!done) out.push(...batch);
    await sleep(200);
  }
  return out;
}

async function getEpisodes() {
  const show = await (await fetch(`https://api.themoviedb.org/3/tv/${TMDB_ID}?api_key=${TMDB_KEY}`)).json();
  const eps: { season: number; episode: number }[] = [];
  for (const s of show.seasons) {
    if (s.season_number === 0) continue;
    const season = await (await fetch(`https://api.themoviedb.org/3/tv/${TMDB_ID}/season/${s.season_number}?api_key=${TMDB_KEY}`)).json();
    for (const ep of season.episodes) {
      eps.push({ season: ep.season_number, episode: ep.episode_number });
    }
    await sleep(50);
  }
  return eps;
}

async function fetchJson(url: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...opts, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchSrt(season: number, episode: number): Promise<string | null> {
  const epCode = `S${String(season).padStart(2,"0")}E${String(episode).padStart(2,"0")}`;

  // Strategy 1: "The Mentalist S01E01"
  // Strategy 2: TMDB ID with season/episode
  // Strategy 3: just episode code
  const searches = [
    `https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent("The Mentalist " + epCode)}&languages=en`,
    `https://api.opensubtitles.com/api/v1/subtitles?tmdb_id=${TMDB_ID}&season=${season}&episode=${episode}&languages=en`,
    `https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(epCode)}&languages=en`,
  ];

  for (const url of searches) {
    try {
      const data = await fetchJson(url, { headers: OS_HEADERS });
      const subs = data.data || [];
      if (subs.length === 0) continue;

      for (const sub of subs.slice(0, 5)) {
        const fileId = sub.attributes?.files?.[0]?.file_id;
        if (!fileId) continue;
        const srt = await downloadSub(fileId);
        if (srt && srt.length > 50) return srt;
      }
    } catch {}
    await sleep(300);
  }

  return null;
}

async function downloadSub(fileId: number): Promise<string | null> {
  try {
    const dlData = await fetchJson("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: { ...OS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });

    // Check for quota limit
    if (dlData.message && dlData.message.includes("allowed")) {
      console.log(`\n  ⚠ OpenSubtitles quota hit: ${dlData.message}`);
      return null;
    }

    const link = dlData.link;
    if (!link) return null;

    const fileRes = await fetch(link, { redirect: "follow" });
    if (!fileRes.ok) return null;

    const buf = Buffer.from(await fileRes.arrayBuffer());

    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      const zlib = await import("node:zlib");
      return zlib.gunzipSync(buf).toString("utf-8");
    }

    return buf.toString("utf-8");
  } catch {
    return null;
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Test API
  console.log("Testing OpenSubtitles API…");
  try {
    const test = await fetchJson(
      `https://api.opensubtitles.com/api/v1/subtitles?query=The+Mentalist&languages=en`,
      { headers: OS_HEADERS }
    );
    console.log(`  ✓ API works! ${test.total_count || 0} subtitles found.\n`);
  } catch (e) {
    console.log(`  ✗ API error: ${e instanceof Error ? e.message : "unknown"}\n`);
    return;
  }

  console.log("Fetching episode list…");
  const episodes = await getEpisodes();
  console.log(`${episodes.length} episodes found.\n`);

  let ok = 0, fail = 0, skip = 0;

  for (const ep of episodes) {
    const name = `${TMDB_ID}_S${ep.season}E${ep.episode}.srt`;
    const filepath = path.join(OUT_DIR, name);

    // Skip existing files
    try {
      const stat = await fs.stat(filepath);
      if (stat.size > 50) { skip++; continue; }
    } catch {}

    process.stdout.write(`S${ep.season}E${ep.episode}: `);
    const srt = await fetchSrt(ep.season, ep.episode);

    if (!srt) {
      console.log("✗ no sub");
      fail++;
      await sleep(500);
      continue;
    }

    const texts = extractTexts(srt);
    if (!texts.length) { console.log("✗ empty"); fail++; continue; }

    process.stdout.write(`translate (${texts.length})… `);
    const translated = await translateBatch(texts);
    await fs.writeFile(filepath, replaceTexts(srt, translated), "utf-8");
    console.log("✓");
    ok++;
    await sleep(500);
  }

  console.log(`\nDone. ${ok} translated, ${skip} skipped, ${fail} failed.`);
  if (fail > 0) console.log("Re-run the script with a new API key to retry failed episodes.");
}

main().catch(e => { console.error(e); process.exit(1); });
