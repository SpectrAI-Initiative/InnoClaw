"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildAuthPageHref,
  completeCliBrowserHandoff,
  parseCliHandoffParams,
} from "@/lib/auth/cli-handoff";
import { useAuthUser } from "@/lib/hooks/use-auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isAuthDisabled } = useAuthUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const registerHref = buildAuthPageHref("/register", searchParams);

  useEffect(() => {
    if (isAuthDisabled) {
      router.replace("/");
      router.refresh();
      return;
    }

    if (isLoading || !user) {
      return;
    }

    const handoff = parseCliHandoffParams(searchParams);
    if (handoff) {
      return;
    }

    const next = searchParams.get("next");
    const fallback = user.role === "admin" ? "/admin/users" : "/";
    router.replace(next && next !== "/" ? next : fallback);
    router.refresh();
  }, [isAuthDisabled, isLoading, router, searchParams, user]);

  function resolvePostLoginPath(role: "admin" | "user"): string {
    const next = searchParams.get("next");
    if (next && next !== "/") {
      return next;
    }
    return role === "admin" ? "/admin/users" : "/";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      await completeCliBrowserHandoff(searchParams);
      router.replace(resolvePostLoginPath(data.user?.role === "admin" ? "admin" : "user"));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (isAuthDisabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Authentication is disabled. Redirecting...</p>
      </main>
    );
  }

  if (user && !parseCliHandoffParams(searchParams)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/70 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Sign in to InnoClaw</CardTitle>
            <CardDescription>Use your local account to continue.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full gap-2" type="submit" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link className="font-medium text-primary hover:underline" href={registerHref}>
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
