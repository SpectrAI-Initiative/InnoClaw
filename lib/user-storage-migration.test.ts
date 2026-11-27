import { describe, it, expect, beforeEach } from "vitest";

/** 轻量 localStorage polyfill（node 测试环境无浏览器 API，避免引入 jsdom 依赖）。 */
class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: new MemoryStorage(),
};
const store = (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window.localStorage;

import { migrateLegacyUserStorage } from "@/lib/user-storage-migration";

/**
 * 回归测试：账号数据迁移不得丢数据、不得用旧数据覆盖已存在的新数据。
 *
 * 背景：旧版把会话/消息/文献库写在无归属的全局 key。修复后所有 key 带 scope。
 * 迁移曾有两个 bug：
 *  1) 目标 key 已存在时仍删除旧 key → 旧账号数据永久丢失；
 *  2) 迁移执行晚于消费者渲染期初始化 → 目标被默认会话占位后旧数据被丢弃。
 */
describe("migrateLegacyUserStorage", () => {
  beforeEach(() => {
    store.clear();
  });

  it("把旧 key 迁移到目标 scope，并在成功后删除旧 key", () => {
    store.setItem("agent-sessions:ws1", JSON.stringify([{ id: "s1", name: "旧会话" }]));
    store.setItem("innoscale:library-search-v1", JSON.stringify({ query: "旧检索" }));

    const migrated = migrateLegacyUserStorage("u:userA");

    expect(migrated).toBe(true);
    expect(store.getItem("ib:u:userA:agent-sessions:ws1")).toBe(
      JSON.stringify([{ id: "s1", name: "旧会话" }])
    );
    expect(store.getItem("ib:u:userA:innoscale:library-search-v1")).toBe(
      JSON.stringify({ query: "旧检索" })
    );
    expect(store.getItem("agent-sessions:ws1")).toBeNull();
    expect(store.getItem("innoscale:library-search-v1")).toBeNull();
  });

  it("目标 key 已存在时，保留旧 key 且不覆盖新数据（绝不丢数据）", () => {
    const newData = JSON.stringify([{ id: "new", name: "新会话" }]);
    const oldData = JSON.stringify([{ id: "old", name: "旧会话" }]);
    store.setItem("agent-sessions:ws1", oldData);
    store.setItem("ib:u:userA:agent-sessions:ws1", newData);

    migrateLegacyUserStorage("u:userA");

    expect(store.getItem("ib:u:userA:agent-sessions:ws1")).toBe(newData);
    expect(store.getItem("agent-sessions:ws1")).toBe(oldData);
  });

  it("全局幂等：迁移标记存在后不再重复执行", () => {
    store.setItem("ib:user-scope-migrated:v1", "u:userA");
    store.setItem("agent-messages:ws1:s1", "旧消息");

    const migrated = migrateLegacyUserStorage("u:userA");

    expect(migrated).toBe(false);
    expect(store.getItem("agent-messages:ws1:s1")).toBe("旧消息");
    expect(store.getItem("ib:u:userA:agent-messages:ws1:s1")).toBeNull();
  });

  it("不迁移非用户数据 key（如设备偏好）", () => {
    store.setItem("innobuddy-font-size", "18");

    migrateLegacyUserStorage("u:userA");

    expect(store.getItem("innobuddy-font-size")).toBe("18");
    expect(store.getItem("ib:u:userA:innobuddy-font-size")).toBeNull();
  });
});
