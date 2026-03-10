"use client";

import { Header } from "@/components/layout/header";
import { ClusterPanel } from "@/components/cluster/cluster-panel";

export default function ClusterPage() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-hidden">
        <ClusterPanel />
      </div>
    </div>
  );
}
