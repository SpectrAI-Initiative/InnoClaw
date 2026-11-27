/**
 * 一次性迁移旧版「无用户归属」的 localStorage 键值，以及品牌改名后的旧键。
 *
 * 背景：旧版本把会话、消息、文献库检索结果等写在全局 key（无账号前缀），
 * 导致换账号后仍看到旧账号数据。修复后所有 key 都带 scope 前缀，
 * 这里把旧 key 迁到「首次登录的账号」名下，保证旧账号能看到之前的数据，
 * 而之后新建的账号名下没有任何旧数据。
 *
 * 品牌：InnoBuddy / InnoClaw → InnoScale 后，旧键名前缀也会一并改写。
 *
 * 只在每个浏览器执行最多一次（用各自的 MIGRATED_FLAG 标记）。
 */
const SCOPE_MIGRATED_FLAG = "ib:user-scope-migrated:v1";
const BRAND_MIGRATED_FLAG = "innoscale:brand-key-migrated:v1";

/** 旧版无归属的用户数据 key（精确匹配）。 */
const LEGACY_EXACT_KEYS = [
  "innoscale:library-search-v1",
  "innoscale:library-summary-v1",
  "innoscale-agent-model-selection",
  // 品牌改名之前遗留的无归属键
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

function renameBrandInKey(key: string): string {
  return key
    .replaceAll("innobuddy", "innoscale")
    .replaceAll("INNOBUDDY", "INNOSCALE")
    .replaceAll("Innobuddy", "InnoScale")
    .replaceAll("InnoBuddy", "InnoScale")
    .replaceAll("innoclaw", "innoscale")
    .replaceAll("INNOCLAW", "INNOSCALE")
    .replaceAll("Innoclaw", "InnoScale")
    .replaceAll("InnoClaw", "InnoScale");
}

/**
 * 把 localStorage 里仍带旧品牌名的 key 改写成 InnoScale。
 * 可在 hydration 前同步调用；自带幂等标记。
 */
export function migrateBrandStorageKeys(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(BRAND_MIGRATED_FLAG)) return false;
  } catch {
    return false;
  }

  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) keys.push(key);
    }

    let moved = 0;
    for (const key of keys) {
      const next = renameBrandInKey(key);
      if (next === key) continue;
      const value = window.localStorage.getItem(key);
      if (value === null) continue;
      if (window.localStorage.getItem(next) === null) {
        window.localStorage.setItem(next, value);
        window.localStorage.removeItem(key);
        moved += 1;
      }
    }

    window.localStorage.setItem(BRAND_MIGRATED_FLAG, "1");
    return moved > 0;
  } catch {
    return false;
  }
}

/**
 * 把旧 key 迁移到指定 scope 下。
 * @param scope 形如 `u:<userId>`，由 useStorageScope 提供
 * @returns 是否执行了迁移
 */
export function migrateLegacyUserStorage(scope: string): boolean {
  if (typeof window === "undefined") return false;

  // 先处理品牌改名，避免 scope 迁移漏掉仍叫 innobuddy-* 的键。
  migrateBrandStorageKeys();

  try {
    if (window.localStorage.getItem(SCOPE_MIGRATED_FLAG)) return false;
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
    window.localStorage.setItem(SCOPE_MIGRATED_FLAG, scope);
    return keys.length > 0;
  } catch {
    return false;
  }
}
