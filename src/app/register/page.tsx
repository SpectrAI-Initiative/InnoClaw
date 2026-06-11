"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildAuthPageHref,
  completeCliBrowserHandoff,
  parseCliHandoffParams,
} from "@/lib/auth/cli-handoff";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const loginHref = buildAuthPageHref("/login", searchParams);

  useEffect(() => {
    let cancelled = false;

    async function resumeCliSession() {
      if (!parseCliHandoffParams(searchParams)) {
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          return;
        }
        await completeCliBrowserHandoff(searchParams);
        if (cancelled) {
          return;
        }
        router.replace(searchParams.get("next") || "/");
        router.refresh();
      } catch (resumeError) {
        if (!cancelled) {
          setError(resumeError instanceof Error ? resumeError.message : "Failed to resume CLI session");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void resumeCliSession();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      await completeCliBrowserHandoff(searchParams);

      const next = searchParams.get("next") || (data.requiresSetup ? "/settings" : "/");
      router.replace(next);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/70 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Create account</CardTitle>
            <CardDescription>Open registration is enabled on this system.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full gap-2" type="submit" disabled={loading}>
              <UserPlus className="h-4 w-4" />
              {loading ? "Creating..." : "Create account"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-medium text-primary hover:underline" href={loginHref}>
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
