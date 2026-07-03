/*
  Fetch the top 5000 most popular movies from TMDB and output their IDs.
  Uses the /movie/top_rated endpoint (pages 1-250, 20 per page = 5000).
  Outputs just the IDs, one per line — ready to paste.
*/

const TMDB_KEY = process.env.TMDB_API_KEY!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ids: number[] = [];

// top_rated gives 500 pages of 20 = 10,000; we take the first 250 pages = 5000
for (let page = 1; page <= 250; page++) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_KEY}&page=${page}`
    );
    if (!res.ok) {
      console.error(`page ${page} failed: ${res.status}`);
      continue;
    }
    const data = await res.json();
    for (const m of data.results) {
      ids.push(m.id);
    }
    process.stdout.write(`page ${page}/250 (${ids.length} ids)\r`);
  } catch (e) {
    console.error(`page ${page} error`);
  }
  await sleep(40); // be polite to the API
}

// output just the IDs, comma-separated on one line for easy copy
console.log("\n\n=== COPY BELOW ===");
console.log(ids.join(", "));
console.log(`\nTotal: ${ids.length} IDs`);
