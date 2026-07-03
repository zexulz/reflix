import type { Movie, MovieInput, SessionUser } from "@/lib/types";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data && String(data.error)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

const base = (p: string) => p;

export const api = {
  async me(): Promise<{ user: SessionUser | null }> {
    const res = await fetch(base("/api/auth/me"), { credentials: "include" });
    return json(res);
  },

  async signUp(input: {
    email: string;
    password: string;
    name?: string;
  }): Promise<{ user: SessionUser }> {
    const res = await fetch(base("/api/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return json(res);
  },

  async signIn(input: {
    email: string;
    password: string;
  }): Promise<{ user: SessionUser }> {
    const res = await fetch(base("/api/auth/signin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return json(res);
  },

  async signOut(): Promise<{ ok: boolean }> {
    const res = await fetch(base("/api/auth/signout"), {
      method: "POST",
      credentials: "include",
    });
    return json(res);
  },

  async movies(q?: string): Promise<{ movies: Movie[] }> {
    const url = q ? `/api/movies?q=${encodeURIComponent(q)}` : "/api/movies";
    const res = await fetch(base(url), { credentials: "include" });
    return json(res);
  },

  async createMovie(input: MovieInput): Promise<{ movie: Movie }> {
    const res = await fetch(base("/api/movies"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return json(res);
  },

  async updateMovie(id: string, input: Partial<MovieInput>): Promise<{ movie: Movie }> {
    const res = await fetch(base(`/api/movies/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return json(res);
  },

  async deleteMovie(id: string): Promise<{ ok: boolean }> {
    const res = await fetch(base(`/api/movies/${id}`), {
      method: "DELETE",
      credentials: "include",
    });
    return json(res);
  },

  async progress(): Promise<{ progress: { id: string; movieId: string; position: number; duration: number; updatedAt: string }[] }> {
    const res = await fetch(base("/api/progress"), { credentials: "include" });
    return json(res);
  },

  async saveProgress(input: {
    movieId: string;
    position: number;
    duration: number;
  }): Promise<{ progress: unknown }> {
    const res = await fetch(base("/api/progress"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return json(res);
  },

  async upload(file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(base("/api/upload"), {
      method: "POST",
      credentials: "include",
      body: form,
    });
    return json(res);
  },
};
