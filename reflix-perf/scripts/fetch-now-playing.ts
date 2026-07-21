/*
  Fetch recent English-language movies currently in cinema or just out,
  from TMDB's /movie/now_playing endpoint. Outputs just the TMDB IDs.
*/

const TMDB_KEY = process.env.TMDB_API_KEY!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ids: number[] = [];
const seen = new Set<number>();

// now_playing returns ~20 per page across ~5-8 pages; grab all of them
for (let page = 1; page <= 8; page++) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&page=${page}&region=US`
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!data.results || data.results.length === 0) break;
    for (const m of data.results) {
      // filter to English-language films (original_language === "en")
      if (m.original_language === "en" && !seen.has(m.id)) {
        seen.add(m.id);
        ids.push(m.id);
      }
    }
    process.stdout.write(`page ${page}: ${ids.length} en films so far\r`);
  } catch {
    break;
  }
  await sleep(40);
}

console.log(`\n\n=== ${ids.length} recent English cinema movies ===`);
console.log(ids.join(", "));
