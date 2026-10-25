import { db, query } from './db';

const adminChannel = () => 'moped-orders';

export async function tokenRequest(channel?: string) {
  return null;
}

export async function flushOutbox() {
  const pending = await query(db(), 'SELECT id FROM outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 50');
  if (pending.rows.length > 0) {
    const ids = pending.rows.map(r => String(r.id));
    for (const id of ids) {
      await query(db(), 'UPDATE outbox SET published_at=?, attempts=attempts+1 WHERE id=?', [Date.now(), id]);
    }
  }
  return { sent: pending.rows.length, pending: false };
}

export const getAdminChannel = adminChannel;
