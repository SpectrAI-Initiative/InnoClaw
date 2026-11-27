/**
 * 一次性迁移旧版「无用户归属」的 localStorage 键值。
 *
 * 背景：旧版本把会话、消息、文献库检索结果等写在全局 key（无账号前缀），
 * 导致换账号后仍看到旧账号数据。修复后所有 key 都带 scope 前缀，
 * 这里把旧 key 迁到「首次登录的账号」名下，保证旧账号能看到之前的数据，
 * 而之后新建的账号名下没有任何旧数据。
 *
 * 只在每个浏览器执行最多一次（用 MIGRATED_FLAG 标记）。
 */
const MIGRATED_FLAG = "ib:user-scope-migrated:v1";

/** 旧版无归属的用户数据 key（精确匹配）。 */
const LEGACY_EXACT_KEYS = [
  "innoscale:library-search-v1",
  "innoscale:library-summary-v1",
  "innobuddy-agent-model-selection",
] as const;

/** 旧版无归属的用户数据 key 前缀（后面跟 workspaceId / sessionId）。 */
const LEGACY_PREFIXES = [
  "agent-sessions:",
  "agent-active-session:",
  "agent-messages:",
  "agent-cost:",
] as const;

function isLegacyUserKey(key: string): boolean {
  if ((LEGACY_EXACT_KEYS as readonly string[]).includes(key)) return true;
  return LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * 把旧 key 迁移到指定 scope 下。
 * @param scope 形如 `u:<userId>`，由 useStorageScope 提供
 * @returns 是否执行了迁移
 */
export function migrateLegacyUserStorage(scope: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(MIGRATED_FLAG)) return false;
  } catch {
    return false;
  }

  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && isLegacyUserKey(key)) keys.push(key);
    }
    for (const key of keys) {
      const value = window.localStorage.getItem(key);
      if (value === null) continue;
      const scoped = `ib:${scope}:${key}`;
      // 仅当旧数据确实写入目标后才删除旧 key。
      // 若目标已存在（消费者已先行初始化），保留旧 key 不动，绝不丢数据；
      // 也不能用旧数据覆盖目标，否则会冲掉新会话。
      if (window.localStorage.getItem(scoped) === null) {
        window.localStorage.setItem(scoped, value);
        window.localStorage.removeItem(key);
      }
    }
    window.localStorage.setItem(MIGRATED_FLAG, scope);
    return keys.length > 0;
  } catch {
    return false;
  }
}
