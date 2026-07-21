export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
};

export type Movie = {
  id: string;
  title: string;
  slug: string;
  logline: string;
  description?: string;   // optional in list view; present in single-movie fetch
  posterUrl: string;       // empty string → typographic title-card fallback
  backdropUrl: string | null;
  videoUrl: string | null; // null → "no stream attached" state in the player
  imdbId: string | null;
  tmdbId: number | null;
  imdbRank: number | null;
  duration: number; // minutes
  year: number;
  genre: string;
  director: string;
  cast?: string;           // optional in list view; present in single-movie fetch
  rating: number;
  featured: boolean;
  isNew: boolean;
  isOriginal: boolean;
  isEditorsPick: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProgressRow = {
  id: string;
  userId: string;
  movieId: string;
  position: number; // seconds
  duration: number; // seconds
  updatedAt: string;
};

export type MovieInput = {
  title: string;
  slug?: string;
  logline: string;
  description: string;
  posterUrl: string;
  backdropUrl?: string;
  videoUrl?: string | null;
  duration: number;
  year: number;
  genre: string;
  director: string;
  cast: string;
  rating: number;
  featured: boolean;
  isNew: boolean;
  isOriginal: boolean;
  isEditorsPick: boolean;
};

export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}
