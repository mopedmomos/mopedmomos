import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:./development.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

async function clearData() {
  console.log(`Clearing order and test data from ${url}...`);
  const client = createClient({ url, authToken });

  // Delete in foreign key order
  await client.execute('DELETE FROM outbox');
  await client.execute('DELETE FROM order_events');
  await client.execute('DELETE FROM order_items');
  await client.execute('DELETE FROM orders');
  await client.execute('DELETE FROM daily_sequences');

  console.log('Successfully cleared all orders, items, events, and ticket sequences!');
  console.log('Menu, products, categories, and stall settings were kept intact.');
}

clearData().catch(err => {
  console.error('Error clearing data:', err);
  process.exit(1);
});
