"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/store";
import { useSignIn, useSignUp } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function AuthModal() {
  const open = useApp((s) => s.authOpen);
  const mode = useApp((s) => s.authMode);
  const openAuth = useApp((s) => s.openAuth);
  const closeAuth = useApp((s) => s.closeAuth);
  const [tab, setTab] = useState<"signin" | "signup">(mode);

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signIn = useSignIn();
  const signUp = useSignUp();
  const pending = signIn.isPending || signUp.isPending;

  // keep tab synced when opened via header/footer
  const handleOpenChange = (o: boolean) => {
    if (o) setTab(mode);
    else closeAuth();
    if (!o) {
      setError(null);
      setEmail("");
      setPassword("");
      setName("");
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tab === "signin") {
      signIn.mutate(
        { email, password },
        {
          onError: (err) => setError(err.message),
          onSuccess: () => handleOpenChange(false),
        }
      );
    } else {
      signUp.mutate(
        { email, password, name: name || undefined },
        {
          onError: (err) => setError(err.message),
          onSuccess: () => handleOpenChange(false),
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[94vw] max-w-md overflow-hidden rounded-xl border-hairline bg-ink-2 p-0">
        <DialogTitle className="sr-only">Sign in to Reflix</DialogTitle>

        {/* header band */}
        <div className="relative border-b border-hairline px-6 pb-5 pt-7">
          <div className="flex items-center gap-2.5">
            <span className="flex flex-col gap-[3px]" aria-hidden>
              <span className="h-[3px] w-5 rounded-[1px] bg-glow" />
              <span className="h-[3px] w-5 rounded-[1px] bg-glow/55" />
            </span>
            <span className="font-display text-2xl tracking-[0.16em] text-bone">REFLIX</span>
          </div>
          <p className="mt-3 font-sans text-sm text-ash">
            {tab === "signin"
              ? "Sign in to resume your films."
              : "Create an account to start your list."}
          </p>
        </div>

        <div className="px-6 pb-7 pt-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 rounded-full border border-hairline bg-ink p-1">
              <TabsTrigger
                value="signin"
                className="rounded-full data-[state=active]:bg-glow data-[state=active]:text-ink"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-full data-[state=active]:bg-glow data-[state=active]:text-ink"
              >
                Create account
              </TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="mt-5 space-y-4">
              {tab === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                    Name (optional)
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="border-hairline bg-ink text-bone placeholder:text-ash/60 focus-visible:ring-glow/40"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@cinema.com"
                  className="border-hairline bg-ink text-bone placeholder:text-ash/60 focus-visible:ring-glow/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="border-hairline bg-ink text-bone placeholder:text-ash/60 focus-visible:ring-glow/40"
                />
              </div>

              {error && (
                <div className="rounded-md border border-oxblood/40 bg-oxblood/15 px-3 py-2 font-sans text-xs text-bone/90">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-full bg-glow px-6 py-2.5 font-sans text-sm font-semibold text-ink transition-all hover:bg-glow-soft disabled:opacity-60"
                )}
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tab === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          </Tabs>

        </div>
      </DialogContent>
    </Dialog>
  );
}
