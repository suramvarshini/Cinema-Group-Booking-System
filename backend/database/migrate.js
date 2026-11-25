const fs = require('fs');
const path = require('path');
const { initDatabase, getClient } = require('../config/db');

async function runMigrations(customPool = null) {
  let client;
  let shouldRelease = false;

  try {
    if (customPool) {
      client = await customPool.connect();
      shouldRelease = true;
    } else {
      client = await getClient();
      shouldRelease = true;
    }

    console.log('[Migration] Beginning database migration...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');

    console.log('[Migration] Executing schema.sql (tables, indexes, constraints)...');
    await client.query(schemaSql);
    console.log('[Migration] Schema created successfully.');

    console.log('[Migration] Executing seed.sql (movies, showtimes, master seats)...');
    await client.query(seedSql);
    console.log('[Migration] Seed data inserted successfully.');

    const moviesCount = await client.query('SELECT COUNT(*) FROM movies');
    const seatsCount = await client.query('SELECT COUNT(*) FROM seats');
    const showtimesCount = await client.query('SELECT COUNT(*) FROM showtimes');
    const showtimeSeatsCount = await client.query('SELECT COUNT(*) FROM showtime_seats');

    console.log(`[Migration] Stats:
    - Movies: ${moviesCount.rows[0].count}
    - Master Seats: ${seatsCount.rows[0].count}
    - Showtimes: ${showtimesCount.rows[0].count}
    - Showtime Seat Allocations: ${showtimeSeatsCount.rows[0].count}`);

    console.log('[Migration] Database migration completed successfully!');
    return true;
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
    throw err;
  } finally {
    if (client && shouldRelease) {
      client.release();
    }
  }
}

// Allow standalone execution: node database/migrate.js
if (require.main === module) {
  (async () => {
    try {
      await initDatabase();
      await runMigrations();
      console.log('[Migration] Done. Exiting.');
      process.exit(0);
    } catch (err) {
      console.error('[Migration] Error:', err);
      process.exit(1);
    }
  })();
}

module.exports = { runMigrations };
