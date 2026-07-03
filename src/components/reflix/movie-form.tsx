"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCreateMovie, useUpdateMovie, useUpload } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import type { Movie, MovieInput } from "@/lib/types";

type Props = Record<string, never>;

const EMPTY: MovieInput = {
  title: "",
  slug: "",
  logline: "",
  description: "",
  posterUrl: "",
  backdropUrl: "",
  videoUrl: "",
  duration: 100,
  year: new Date().getFullYear(),
  genre: "",
  director: "",
  cast: "",
  rating: 4.0,
  featured: false,
  isNew: false,
  isOriginal: true,
  isEditorsPick: false,
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function MovieForm(_: Props) {
  const open = useApp((s) => s.adminFormOpen);
  const editing = useApp((s) => s.adminEditing);
  const closeAdminForm = useApp((s) => s.closeAdminForm);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeAdminForm(); }}>
      <DialogContent className="rfx-scroll max-h-[92vh] w-[96vw] max-w-2xl overflow-y-auto rounded-xl border-hairline bg-ink-2 p-0">
        {/* FormBody remounts whenever the target changes or the dialog reopens,
            so local state always starts fresh from `editing`. */}
        <FormBody
          key={editing?.id ?? "new"}
          editing={editing}
          onDone={closeAdminForm}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  editing,
  onDone,
}: {
  editing: Movie | null;
  onDone: () => void;
}) {
  const [form, setForm] = useState<MovieInput>(() =>
    editing ? toInput(editing) : EMPTY
  );
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const create = useCreateMovie();
  const update = useUpdateMovie();
  const upload = useUpload();
  const posterInput = useRef<HTMLInputElement>(null);
  const backdropInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof MovieInput>(k: K, v: MovieInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onTitle = (v: string) => {
    set("title", v);
    if (!slugTouched) set("slug", slugify(v));
  };

  const doUpload = async (
    file: File,
    field: "posterUrl" | "backdropUrl"
  ) => {
    try {
      setError(null);
      const { url } = await upload.mutateAsync(file);
      set(field, url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("Title is required.");
    // videoUrl is optional — the film can be cataloged before a stream is attached

    const payload: MovieInput = {
      ...form,
      slug: form.slug.trim() || slugify(form.title),
      // empty string → null so the player correctly shows "no stream attached"
      videoUrl: form.videoUrl && form.videoUrl.trim() ? form.videoUrl.trim() : null,
    };

    const mut = editing
      ? update.mutateAsync({ id: editing.id, input: payload })
      : create.mutateAsync(payload);

    mut
      .then(() => onDone())
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not save film.")
      );
  };

  const pending = create.isPending || update.isPending;

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-hairline bg-ink-2/95 px-6 py-4 backdrop-blur">
        <DialogTitle className="font-display text-2xl tracking-tight text-bone">
          {editing ? "Edit film" : "Add a new film"}
        </DialogTitle>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          Curator's Desk · Catalog entry
        </p>
      </div>

        <form onSubmit={submit} className="space-y-5 px-6 py-6">
          {/* title + slug */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" required>
              <Input
                value={form.title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="The Long Dark"
                className="border-hairline bg-ink text-bone placeholder:text-ash/50 focus-visible:ring-glow/40"
              />
            </Field>
            <Field label="Slug">
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
                placeholder="the-long-dark"
                className="border-hairline bg-ink font-mono text-sm text-bone placeholder:text-ash/50 focus-visible:ring-glow/40"
              />
            </Field>
          </div>

          {/* logline */}
          <Field label="Logline">
            <Input
              value={form.logline}
              onChange={(e) => set("logline", e.target.value)}
              placeholder="A lone lighthouse keeper intercepts a signal that should not exist."
              className="border-hairline bg-ink text-bone placeholder:text-ash/50 focus-visible:ring-glow/40"
            />
          </Field>

          {/* description */}
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              placeholder="Full synopsis, themes, festival notes…"
              className="resize-none border-hairline bg-ink text-bone placeholder:text-ash/50 focus-visible:ring-glow/40"
            />
          </Field>

          {/* images */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageField
              label="Poster"
              required
              value={form.posterUrl}
              onChange={(v) => set("posterUrl", v)}
              onPick={(f) => doUpload(f, "posterUrl")}
              onUploadClick={() => posterInput.current?.click()}
              uploading={upload.isPending}
              ratio="2 / 3"
              inputRef={posterInput}
            />
            <ImageField
              label="Backdrop"
              value={form.backdropUrl || ""}
              onChange={(v) => set("backdropUrl", v)}
              onPick={(f) => doUpload(f, "backdropUrl")}
              onUploadClick={() => backdropInput.current?.click()}
              uploading={upload.isPending}
              ratio="16 / 9"
              inputRef={backdropInput}
            />
          </div>

          {/* video url — the licensed stream slot. Optional: the film is
              cataloged and browseable without it; the player shows a
              "no stream attached" state until a URL is pasted here.
              Works with direct video files (.mp4) AND embed URLs (YouTube,
              Vimeo, or any embed service). */}
          <Field label="Stream URL (video file or embed)">
            <Input
              value={form.videoUrl || ""}
              onChange={(e) => set("videoUrl", e.target.value)}
              placeholder="https://your-host.com/278 or https://your-embed.com/movie/278"
              className="border-hairline bg-ink font-mono text-sm text-bone placeholder:text-ash/50 focus-visible:ring-glow/40"
            />
            <p className="mt-1.5 font-sans text-[11px] leading-relaxed text-ash">
              Paste a direct video file URL (`.mp4`, `.webm`) or an embed URL
              (YouTube, Vimeo, or any embed service). Leave empty until you have
              one — the film stays in the catalog and the player waits for a stream.
            </p>
          </Field>

          {/* numeric row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Year">
              <Input
                type="number"
                value={form.year}
                onChange={(e) => set("year", Number(e.target.value))}
                className="border-hairline bg-ink text-bone focus-visible:ring-glow/40"
              />
            </Field>
            <Field label="Runtime (min)">
              <Input
                type="number"
                value={form.duration}
                onChange={(e) => set("duration", Number(e.target.value))}
                className="border-hairline bg-ink text-bone focus-visible:ring-glow/40"
              />
            </Field>
            <Field label="Rating">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.rating}
                onChange={(e) => set("rating", Number(e.target.value))}
                className="border-hairline bg-ink text-bone focus-visible:ring-glow/40"
              />
            </Field>
            <Field label="Genre">
              <Input
                value={form.genre}
                onChange={(e) => set("genre", e.target.value)}
                placeholder="Drama"
                className="border-hairline bg-ink text-bone placeholder:text-ash/50 focus-visible:ring-glow/40"
              />
            </Field>
          </div>

          {/* credits */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Director">
              <Input
                value={form.director}
                onChange={(e) => set("director", e.target.value)}
                placeholder="Mara Voss"
                className="border-hairline bg-ink text-bone placeholder:text-ash/50 focus-visible:ring-glow/40"
              />
            </Field>
            <Field label="Cast">
              <Input
                value={form.cast}
                onChange={(e) => set("cast", e.target.value)}
                placeholder="Idris Kaine, Lena Ostrava"
                className="border-hairline bg-ink text-bone placeholder:text-ash/50 focus-visible:ring-glow/40"
              />
            </Field>
          </div>

          {/* flags */}
          <div className="rounded-lg border border-hairline bg-ink p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              Programming flags
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <FlagSwitch label="Featured" checked={form.featured} onChange={(v) => set("featured", v)} />
              <FlagSwitch label="New" checked={form.isNew} onChange={(v) => set("isNew", v)} />
              <FlagSwitch label="Original" checked={form.isOriginal} onChange={(v) => set("isOriginal", v)} />
              <FlagSwitch label="Editor's Pick" checked={form.isEditorsPick} onChange={(v) => set("isEditorsPick", v)} />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-oxblood/40 bg-oxblood/15 px-3 py-2 font-sans text-xs text-bone/90">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDone()}
              className="text-ash hover:text-bone hover:bg-ink-3"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={submit}
              className="gap-2 rounded-full bg-glow px-6 text-ink hover:bg-glow-soft"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add film"}
            </Button>
          </div>
        </form>
    </>
  );
}

function toInput(m: Movie): MovieInput {
  return {
    title: m.title,
    slug: m.slug,
    logline: m.logline,
    description: m.description,
    posterUrl: m.posterUrl,
    backdropUrl: m.backdropUrl || "",
    videoUrl: m.videoUrl,
    duration: m.duration,
    year: m.year,
    genre: m.genre,
    director: m.director,
    cast: m.cast,
    rating: m.rating,
    featured: m.featured,
    isNew: m.isNew,
    isOriginal: m.isOriginal,
    isEditorsPick: m.isEditorsPick,
  };
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
        {label}
        {required && <span className="ml-1 text-glow">*</span>}
      </Label>
      {children}
    </div>
  );
}

function FlagSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span className="font-sans text-sm text-bone/85">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-glow" />
    </label>
  );
}

function ImageField({
  label,
  required,
  value,
  onChange,
  onPick,
  onUploadClick,
  uploading,
  ratio,
  inputRef,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  onPick: (f: File) => void;
  onUploadClick: () => void;
  uploading: boolean;
  ratio: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <Field label={label} required={required}>
      <div className="flex gap-3">
        <div
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-hairline bg-ink"
          style={{ aspectRatio: ratio }}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Star className="h-4 w-4 text-hairline" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/images/… or upload"
            className="border-hairline bg-ink font-mono text-xs text-bone placeholder:text-ash/50 focus-visible:ring-glow/40"
          />
          <button
            type="button"
            onClick={onUploadClick}
            disabled={uploading}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ash transition-colors hover:text-glow-soft disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Upload file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </Field>
  );
}
