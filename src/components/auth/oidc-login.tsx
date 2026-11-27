"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OidcLogin() {
  const [enabled, setEnabled] = useState(false);
  const params = useSearchParams();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/oidc/config", { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null).then((data) => setEnabled(data?.enabled === true)).catch(() => {});
    return () => controller.abort();
  }, []);
  return <>
    {params.get("oidc_unavailable") && <p role="alert" className="mb-4 text-sm text-destructive">
      OneID sign-in is unavailable on this server right now. Use your local account.
    </p>}
    {params.get("oidc_error") && <p role="alert" className="mb-4 text-sm text-destructive">
      OneID sign-in failed. Retry or use your local account. New OneID users need a verified email that is not already registered locally.
    </p>}
    {enabled && <Button asChild variant="outline" className="mb-4 w-full">
      <a href={`/api/auth/oidc/start?${new URLSearchParams({ next: params.has("cliCallback") ? `/login?${params.toString()}` : params.get("next") || "/" })}`}>
        Continue with OneID
      </a>
    </Button>}
  </>;
}
