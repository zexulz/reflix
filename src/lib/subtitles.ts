/*
  Subtitle parser + overlay utilities
  Parses .srt files into timed cues for overlay rendering.
*/

export type SubtitleCue = {
  start: number; // seconds
  end: number;   // seconds
  text: string;
};

// Parse .srt content into an array of cues
export function parseSrt(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = content.replace(/\r/g, "").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length < 2) continue;

    // Find the timestamp line (contains -->)
    const tsLine = lines.find((l) => l.includes("-->"));
    if (!tsLine) continue;

    const match = tsLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) continue;

    const start =
      parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
    const end =
      parseInt(match[5]) * 3600 + parseInt(match[6]) * 60 + parseInt(match[7]) + parseInt(match[8]) / 1000;

    // Text is everything after the timestamp line
    const tsIdx = lines.indexOf(tsLine);
    const text = lines.slice(tsIdx + 1).join("\n").trim();

    if (text) {
      cues.push({ start, end, text });
    }
  }

  return cues;
}

// Find the active cue at a given time (seconds)
export function findActiveCue(cues: SubtitleCue[], time: number): SubtitleCue | null {
  for (const cue of cues) {
    if (time >= cue.start && time <= cue.end) {
      return cue;
    }
  }
  return null;
}
