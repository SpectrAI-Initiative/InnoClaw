import { nanoid } from "nanoid";
import { digest, type Identity, type Transaction } from "./protocol";
import type { OidcRepository } from "./repository";

// Structural interfaces accept a mysql2/promise pool without importing a second
// database driver into the SQLite branch. Pass getPool() after the MySQL merge.
interface Connection {
  query(sql: string, values?: unknown[]): Promise<unknown>;
  beginTransaction(): Promise<unknown>;
  commit(): Promise<unknown>;
  rollback(): Promise<unknown>;
  release(): void;
}
interface Pool { getConnection(): Promise<Connection> }
interface IdentityRow { id: string; role: "admin" | "user"; is_active: number; issuer: string; subject: string }

async function rows<T>(connection: Connection, sql: string, args: unknown[]): Promise<T[]> {
  const result = await connection.query(sql, args) as [T[], unknown];
  return result[0];
}

export function createMysqlOidcRepository(pool: Pool): OidcRepository {
  async function transaction<T>(action: (connection: Connection) => Promise<T>): Promise<T> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const value = await action(connection);
      await connection.commit();
      return value;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
  async function findIdentity(connection: Connection, identity: Identity) {
    const [row] = await rows<IdentityRow>(connection,
      `SELECT u.id,u.role,u.is_active,i.issuer,i.subject FROM oidc_identities i
       INNER JOIN users u ON u.id=i.user_id WHERE i.id=? FOR UPDATE`,
      [digest(JSON.stringify([identity.issuer, identity.subject]))]);
    if (!row) return null;
    if (!row.is_active || row.issuer !== identity.issuer || row.subject !== identity.subject) throw new Error("Identity is unavailable");
    const now = new Date().toISOString();
    await connection.query("UPDATE users SET last_login_at=?,updated_at=? WHERE id=?", [now, now, row.id]);
    return { id: row.id, role: row.role };
  }
  return {
    async save(tx) {
      await transaction(async (connection) => {
        await connection.query("DELETE FROM oidc_transactions WHERE expires_at < ?", [Date.now()]);
        await connection.query(`INSERT INTO oidc_transactions
          (state_hash,binding_hash,nonce,verifier,return_to,expires_at) VALUES (?,?,?,?,?,?)`,
          [tx.stateHash, tx.bindingHash, tx.nonce, tx.verifier, tx.returnTo, tx.expiresAt]);
      });
    },
    async consume(stateHash, bindingHash) {
      return transaction(async (connection) => {
        const [row] = await rows<{ state_hash: string; binding_hash: string; nonce: string; verifier: string; return_to: string; expires_at: number }>(connection,
          "SELECT * FROM oidc_transactions WHERE state_hash=? AND binding_hash=? AND expires_at>? FOR UPDATE",
          [stateHash, bindingHash, Date.now()]);
        if (!row) return null;
        await connection.query("DELETE FROM oidc_transactions WHERE state_hash=?", [stateHash]);
        const tx: Transaction = { stateHash: row.state_hash, bindingHash: row.binding_hash, nonce: row.nonce,
          verifier: row.verifier, returnTo: row.return_to, expiresAt: Number(row.expires_at) };
        return tx;
      });
    },
    async resolve(identity) {
      try {
        return await transaction(async (connection) => {
          const existing = await findIdentity(connection, identity);
          if (existing) return existing;
          const [owner] = await rows<{ id: string }>(connection, "SELECT id FROM users WHERE email=?", [identity.email]);
          if (owner) throw new Error("Email already belongs to an account; automatic linking is disabled");
          const id = nanoid(); const now = new Date().toISOString();
          await connection.query(`INSERT INTO users
            (id,email,name,password_hash,role,is_active,last_login_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
            [id, identity.email, identity.name, "oidc-only", "user", true, now, now, now]);
          await connection.query("INSERT INTO oidc_identities (id,user_id,issuer,subject,created_at) VALUES (?,?,?,?,?)",
            [digest(JSON.stringify([identity.issuer, identity.subject])), id, identity.issuer, identity.subject, now]);
          return { id, role: "user" as const };
        });
      } catch (error) {
        // Concurrent first logins can race on unique indexes or deadlock. Only
        // reuse an exact identity committed by the other transaction, never email.
        const code = (error as { code?: string }).code;
        if (code === "ER_DUP_ENTRY" || code === "ER_LOCK_DEADLOCK") {
          const existing = await transaction((connection) => findIdentity(connection, identity));
          if (existing) return existing;
        }
        throw error;
      }
    },
  };
}
