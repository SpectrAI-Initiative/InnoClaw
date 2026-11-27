import { and, eq, gt, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { oidcIdentities, oidcTransactions, users } from "@/lib/db/schema";
import { digest, type Identity, type Transaction } from "./protocol";

export interface OidcRepository {
  save(tx: Transaction): Promise<void>;
  consume(stateHash: string, bindingHash: string): Promise<Transaction | null>;
  resolve(identity: Identity): Promise<{ id: string; role: "user" | "admin" }>;
}

// SQLite adapter for the current branch. All protocol/HTTP code depends only on
// OidcRepository. See docs/oneid.md for the MySQL transaction adaptation.
export const oidcRepository: OidcRepository = {
  async save(tx) {
    await db.delete(oidcTransactions).where(lt(oidcTransactions.expiresAt, Date.now()));
    await db.insert(oidcTransactions).values(tx);
  },
  async consume(stateHash, bindingHash) {
    const [tx] = await db.delete(oidcTransactions).where(and(
      eq(oidcTransactions.stateHash, stateHash), eq(oidcTransactions.bindingHash, bindingHash),
      gt(oidcTransactions.expiresAt, Date.now()),
    )).returning();
    return tx ?? null;
  },
  async resolve(identity) {
    const key = digest(JSON.stringify([identity.issuer, identity.subject]));
    return db.transaction((transaction) => {
      const existing = transaction.select({ identity: oidcIdentities, user: users }).from(oidcIdentities)
        .innerJoin(users, eq(oidcIdentities.userId, users.id)).where(eq(oidcIdentities.id, key)).get();
      if (existing) {
        if (existing.identity.issuer !== identity.issuer || existing.identity.subject !== identity.subject || !existing.user.isActive) {
          throw new Error("Identity is unavailable");
        }
        const now = new Date().toISOString();
        transaction.update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, existing.user.id)).run();
        return { id: existing.user.id, role: existing.user.role };
      }
      const emailOwner = transaction.select({ id: users.id }).from(users).where(eq(users.email, identity.email)).get();
      if (emailOwner) throw new Error("Email already belongs to an account; automatic linking is disabled");
      const id = nanoid();
      const now = new Date().toISOString();
      transaction.insert(users).values({ id, email: identity.email, name: identity.name,
        passwordHash: "oidc-only", role: "user", isActive: true, lastLoginAt: now, createdAt: now, updatedAt: now }).run();
      transaction.insert(oidcIdentities).values({ id: key, userId: id, issuer: identity.issuer,
        subject: identity.subject, createdAt: now }).run();
      return { id, role: "user" as const };
    });
  },
};
