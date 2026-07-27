/*
  fetch-subs-remaining51.ts

  Fetches English subtitles for The Mentalist episodes S5E7 through S7E13
  (the last 51 episodes), translates to Ukrainian, saves as .srt files.

  Run: bun run fetch-subs-remaining51.ts
  Output: ./subtitles/5920_S5E7.srt, etc.
*/

import { promises as fs } from "node:fs";
import path from "node:path";

const OPENSUBS_KEY = "NEW_KEY_HERE"; // ← paste your second API key here
const GOOGLE_KEY = "AIzaSyCYrf0rRI8BgNhbfjAw9oAxAu5m5eTMDfA";
const TMDB_KEY = "f39b856d71d391f85967aebf350576b8";
const TMDB_ID = 5920;
const OUT_DIR = path.join(process.cwd(), "subtitles");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const OS_HEADERS: Record<string, string> = {
  "Api-Key": OPENSUBS_KEY,
  "User-Agent": "ReflixSubs v1.0",
};

// ── The last 51 episodes only ──
const EPISODES = [
  { s: 5, e: 7 },  { s: 5, e: 8 },  { s: 5, e: 9 },  { s: 5, e: 10 },
  { s: 5, e: 11 }, { s: 5, e: 12 }, { s: 5, e: 13 }, { s: 5, e: 14 },
  { s: 5, e: 15 }, { s: 5, e: 16 }, { s: 5, e: 17 }, { s: 5, e: 18 },
  { s: 5, e: 19 }, { s: 5, e: 20 }, { s: 5, e: 21 }, { s: 5, e: 22 },
  { s: 6, e: 1 },  { s: 6, e: 2 },  { s: 6, e: 3 },  { s: 6, e: 4 },
  { s: 6, e: 5 },  { s: 6, e: 6 },  { s: 6, e: 7 },  { s: 6, e: 8 },
  { s: 6, e: 9 },  { s: 6, e: 10 }, { s: 6, e: 11 }, { s: 6, e: 12 },
  { s: 6, e: 13 }, { s: 6, e: 14 }, { s: 6, e: 15 }, { s: 6, e: 16 },
  { s: 6, e: 17 }, { s: 6, e: 18 }, { s: 6, e: 19 }, { s: 6, e: 20 },
  { s: 6, e: 21 }, { s: 6, e: 22 },
  { s: 7, e: 1 },  { s: 7, e: 2 },  { s: 7, e: 3 },  { s: 7, e: 4 },
  { s: 7, e: 5 },  { s: 7, e: 6 },  { s: 7, e: 7 },  { s: 7, e: 8 },
  { s: 7, e: 9 },  { s: 7, e: 10 }, { s: 7, e: 11 }, { s: 7, e: 12 },
  { s: 7, e: 13 },
];

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
        } else { await sleep(2000 * (attempt + 1)); }
      } catch { await sleep(2000 * (attempt + 1)); }
    }
    if (!done) out.push(...batch);
    await sleep(200);
  }
  return out;
}

async function fetchJson(url: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...opts, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchSrt(season: number, episode: number): Promise<string | null> {
  const epCode = `S${String(season).padStart(2,"0")}E${String(episode).padStart(2,"0")}`;

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

    if (dlData.message && dlData.message.includes("allowed")) {
      console.log(`\n  ⚠ Quota hit: ${dlData.message}`);
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
  } catch { return null; }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log("Testing OpenSubtitles API…");
  try {
    const test = await fetchJson(
      `https://api.opensubtitles.com/api/v1/subtitles?query=The+Mentalist&languages=en`,
      { headers: OS_HEADERS }
    );
    console.log(`  ✓ API works!\n`);
  } catch (e) {
    console.log(`  ✗ API error: ${e instanceof Error ? e.message : "unknown"}\n`);
    return;
  }

  console.log(`Processing last ${EPISODES.length} episodes (S5E7 → S7E13)…\n`);

  let ok = 0, fail = 0, skip = 0;

  for (const ep of EPISODES) {
    const name = `${TMDB_ID}_S${ep.s}E${ep.e}.srt`;
    const filepath = path.join(OUT_DIR, name);

    try {
      const stat = await fs.stat(filepath);
      if (stat.size > 50) { skip++; continue; }
    } catch {}

    process.stdout.write(`S${ep.s}E${ep.e}: `);
    const srt = await fetchSrt(ep.s, ep.e);

    if (!srt) { console.log("✗ no sub"); fail++; await sleep(500); continue; }

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
}

main().catch(e => { console.error(e); process.exit(1); });
