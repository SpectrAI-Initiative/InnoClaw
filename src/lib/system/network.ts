import { execSync } from "child_process";
import fs from "fs";
import os from "os";

interface NetworkBytes {
  rx: number;
  tx: number;
}

export interface NetworkSpeed {
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
}

// ---------------------------------------------------------------------------
// Platform-specific cumulative byte readers
// ---------------------------------------------------------------------------

function readNetworkBytesLinux(): NetworkBytes {
  const content = fs.readFileSync("/proc/net/dev", "utf-8");
  let rx = 0;
  let tx = 0;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes(":") || trimmed.startsWith("lo:")) continue;
    const parts = trimmed.split(":")[1]?.trim().split(/\s+/);
    if (parts && parts.length >= 10) {
      rx += Number(parts[0]) || 0;
      tx += Number(parts[8]) || 0;
    }
  }
  return { rx, tx };
}

function readNetworkBytesWindows(): NetworkBytes {
  const output = execSync("netstat -e", {
    encoding: "utf-8",
    timeout: 5000,
  });
  // The Bytes row is the first data row with two numbers, regardless of locale
  for (const line of output.split("\n")) {
    const m = line.trim().match(/(\d[\d,]*)\s+(\d[\d,]*)\s*$/);
    if (m) {
      return {
        rx: Number(m[1].replace(/,/g, "")) || 0,
        tx: Number(m[2].replace(/,/g, "")) || 0,
      };
    }
  }
  return { rx: 0, tx: 0 };
}

function readNetworkBytesDarwin(): NetworkBytes {
  const output = execSync("netstat -ib", {
    encoding: "utf-8",
    timeout: 5000,
  });
  let rx = 0;
  let tx = 0;
  const lines = output.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 10) continue;
    const iface = parts[0];
    if (iface === "lo0" || iface.startsWith("lo")) continue;
    const ibytes = Number(parts[6]) || 0;
    const obytes = Number(parts[9]) || 0;
    if (ibytes > 0 || obytes > 0) {
      rx += ibytes;
      tx += obytes;
    }
  }
  return { rx, tx };
}

function readNetworkBytes(): NetworkBytes {
  const platform = os.platform();
  try {
    if (platform === "linux") return readNetworkBytesLinux();
    if (platform === "win32") return readNetworkBytesWindows();
    if (platform === "darwin") return readNetworkBytesDarwin();
  } catch {
    // Fall through
  }
  return { rx: 0, tx: 0 };
}

// ---------------------------------------------------------------------------
// Stateless speed measurement: two readings with a 1s gap
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads network bytes twice (1 second apart) and returns the delta.
 * Stateless — no globalThis / timer needed.
 */
export async function getNetworkSpeed(): Promise<NetworkSpeed> {
  const s1 = readNetworkBytes();
  const t1 = Date.now();
  await sleep(1000);
  const s2 = readNetworkBytes();
  const elapsed = (Date.now() - t1) / 1000;

  return {
    rxBytesPerSecond: Math.max(0, (s2.rx - s1.rx) / elapsed),
    txBytesPerSecond: Math.max(0, (s2.tx - s1.tx) / elapsed),
  };
}
