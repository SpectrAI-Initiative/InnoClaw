"use client";

import { useRef } from "react";
import { useAuthUser } from "@/lib/hooks/use-auth";
import { migrateBrandStorageKeys, migrateLegacyUserStorage } from "@/lib/user-storage-migration";

/**
 * 按账号隔离浏览器本地数据。
 *
 * 所有「用户数据」（会话、消息、成本、文献库检索/总结、模型选择等）都必须
 * 使用 scopeKey() 生成 key，避免 A 账号的数据出现在 B 账号界面上。
 * 设备偏好（主题/字号/字体）不属于用户数据，保持全局 key。
 */
export function useStorageScope() {
  const { user, isAuthDisabled, isLoading } = useAuthUser();
  // 登录用户用 user.id；未启用鉴权的单用户演示用固定 scope。
  const userId = user?.id ?? (isAuthDisabled ? "anonymous" : null);
  const scope = userId ? `u:${userId}` : null;

  // 旧版无归属数据必须在任何消费者「渲染期初始化」之前同步迁移完成。
  // useAgentSessions 在渲染期就会写入 scoped key（而非 useEffect），若迁移
  // 放到 useEffect 里会晚于该写入，导致目标已存在、旧数据被丢弃。
  // 这里在 scope 就绪时同步执行；migrateLegacyUserStorage 自带全局幂等标记。
  // 品牌键改名不依赖登录态，尽早执行。
  migrateBrandStorageKeys();
  const migratedRef = useRef<string | null>(null);
  if (scope && !isLoading && migratedRef.current !== scope) {
    migratedRef.current = scope;
    migrateLegacyUserStorage(scope);
  }

  return {
    scope,
    ready: !isLoading && scope !== null,
    isAuthDisabled,
  };
}

export function scopeKey(scope: string, key: string): string {
  return `ib:${scope}:${key}`;
}
