import {db,query} from '../src/server/db';
import {saveOption} from '../src/server/store';
import {seedMenu} from '../tests/fixtures/menu';

const existing = await query(db(), 'SELECT COUNT(*) as count FROM menu_options');
if (Number(existing.rows[0]?.count ?? 0) === 0) {
  for (const item of seedMenu) {
    await saveOption(item);
  }
  console.log(`Seeded ${seedMenu.length} menu items into local database.`);
} else {
  console.log('Menu already has items, skipping seed.');
}
db().close();
