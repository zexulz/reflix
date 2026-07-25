"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import type { MovieInput } from "@/lib/types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { user } = await api.me();
      return user;
    },
  });
}

export function useMovies() {
  const search = useApp((s) => s.search);
  // debounce the search so it doesn't fire on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  return useQuery({
    queryKey: ["movies", debouncedSearch],
    queryFn: async () => {
      const { movies } = await api.movies(debouncedSearch || undefined);
      return movies;
    },
  });
}

// Admin hook — fetches ALL movies (no limit) for the catalog table
export function useAllMovies() {
  return useQuery({
    queryKey: ["movies-all"],
    queryFn: async () => {
      const res = await fetch("/api/movies", { credentials: "include" });
      const { movies } = await res.json();
      return movies;
    },
  });
}

export function useProgress() {
  const user = useApp((s) => s.user);
  return useQuery({
    queryKey: ["progress"],
    queryFn: async () => {
      const { progress } = await api.progress();
      return progress;
    },
    enabled: !!user,
  });
}

export function useSignIn() {
  const qc = useQueryClient();
  const setUser = useApp((s) => s.setUser);
  const closeAuth = useApp((s) => s.closeAuth);
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => api.signIn(input),
    onSuccess: ({ user }) => {
      setUser(user);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
      closeAuth();
    },
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  const setUser = useApp((s) => s.setUser);
  const closeAuth = useApp((s) => s.closeAuth);
  return useMutation({
    mutationFn: (input: { email: string; password: string; name?: string }) =>
      api.signUp(input),
    onSuccess: ({ user }) => {
      setUser(user);
      qc.invalidateQueries({ queryKey: ["me"] });
      closeAuth();
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  const setUser = useApp((s) => s.setUser);
  const setView = useApp((s) => s.setView);
  return useMutation({
    mutationFn: () => api.signOut(),
    onSuccess: () => {
      setUser(null);
      setView("browse");
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}

export function useSaveProgress() {
  return useMutation({
    mutationFn: (input: { movieId: string; position: number; duration: number }) =>
      api.saveProgress(input),
  });
}

export function useCreateMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MovieInput) => api.createMovie(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movies"] }),
  });
}

export function useUpdateMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<MovieInput> }) =>
      api.updateMovie(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movies"] }),
  });
}

export function useDeleteMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMovie(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movies"] }),
  });
}

export function useUpload() {
  return useMutation({
    mutationFn: (file: File) => api.upload(file),
  });
}

export function useTmdbSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["tmdb-search", query],
    queryFn: async () => {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      const { results } = await res.json();
      return results as Array<{
        tmdbId: number;
        title: string;
        year: number | null;
        overview: string;
        posterPath: string | null;
        backdropPath: string | null;
        rating: number;
      }>;
    },
    enabled: enabled && query.trim().length >= 2,
  });
}

export function useTmdbImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tmdbId: number) => {
      const res = await fetch("/api/tmdb/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tmdbId }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movies"] }),
  });
}

export function useTmdbTvSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["tmdb-tv-search", query],
    queryFn: async () => {
      const res = await fetch(`/api/tmdb/search-tv?q=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      const { results } = await res.json();
      return results as Array<{
        tmdbId: number;
        name: string;
        year: number | null;
        overview: string;
        posterPath: string | null;
        backdropPath: string | null;
        rating: number;
      }>;
    },
    enabled: enabled && query.trim().length >= 2,
  });
}

export function useTmdbTvImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tmdbId: number) => {
      const res = await fetch("/api/tmdb/import-tv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tmdbId }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movies"] }),
  });
}
