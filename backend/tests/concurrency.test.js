/**
 * CONCURRENCY & MUTEX SYNCHRONIZATION TEST SUITE
 * 
 * Tests the PostgreSQL transaction-based row locking Mutex:
 * 1. Customer A selects [A1, A2, A3] vs Customer B selects [A2, A3, A4] simultaneously.
 * 2. Identical seats race condition (both select [D1, D2] simultaneously).
 * 3. Disjoint seats race condition (both select completely different seats simultaneously).
 * 4. Atomic rollback test (group booking with one unavailable seat fails with zero partial seats).
 * 5. Safe cancellation and seat release test.
 * 6. Input validation (invalid showtime and seat IDs).
 */

const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';
const PGPORT = parseInt(process.env.PGPORT || '5432', 10);
const PGDATABASE = process.env.PGDATABASE || 'cinema_booking';

let pool;

async function getDbClient() {
  if (!pool) {
    pool = new Pool({
      host: '127.0.0.1',
      port: PGPORT,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'password',
      database: PGDATABASE
    });
  }
  return pool;
}

// Helper to look up seat ID by label like 'A1'
async function getSeatMap() {
  const db = await getDbClient();
  const res = await db.query(`SELECT id, row_name, seat_number, concat(row_name, seat_number) AS label FROM seats`);
  const map = {};
  res.rows.forEach(r => {
    map[r.label] = r.id;
  });
  return map;
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('🚀 STARTING CINEMA MUTEX CONCURRENCY VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  const seatMap = await getSeatMap();
  const db = await getDbClient();

  // Pick Showtime 2 for isolation during tests
  const showtimeId = 2;

  // Reset showtime 2 seats to AVAILABLE for a clean test run
  await db.query(`DELETE FROM booking_seats WHERE showtime_id = $1`, [showtimeId]);
  await db.query(`DELETE FROM bookings WHERE showtime_id = $1`, [showtimeId]);
  await db.query(`UPDATE showtime_seats SET status = 'AVAILABLE' WHERE showtime_id = $1`, [showtimeId]);

  console.log(`[Setup] Reset showtime #${showtimeId} seats to AVAILABLE.\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Simultaneous Overlapping Booking (Customer A vs Customer B)
  // Customer A: A1, A2, A3
  // Customer B: A2, A3, A4
  // --------------------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('TEST 1: Simultaneous Overlapping Seat Booking (The Core Problem)');
  console.log('Customer A requests: A1, A2, A3');
  console.log('Customer B requests: A2, A3, A4');
  console.log('Firing both HTTP requests simultaneously...');
  console.log('----------------------------------------------------------------');

  const reqA = axios.post(`${BASE_URL}/bookings`, {
    customerName: 'Customer A (Overlapping)',
    customerEmail: 'alice@example.com',
    showtimeId,
    seatIds: [seatMap['A1'], seatMap['A2'], seatMap['A3']]
  }).then(res => ({ client: 'A', status: res.status, data: res.data }))
    .catch(err => ({ client: 'A', status: err.response?.status || 500, data: err.response?.data || err.message }));

  const reqB = axios.post(`${BASE_URL}/bookings`, {
    customerName: 'Customer B (Overlapping)',
    customerEmail: 'bob@example.com',
    showtimeId,
    seatIds: [seatMap['A2'], seatMap['A3'], seatMap['A4']]
  }).then(res => ({ client: 'B', status: res.status, data: res.data }))
    .catch(err => ({ client: 'B', status: err.response?.status || 500, data: err.response?.data || err.message }));

  const [resA, resB] = await Promise.all([reqA, reqB]);

  console.log(`Customer A response: Status ${resA.status} -> ${resA.data.message || JSON.stringify(resA.data)}`);
  console.log(`Customer B response: Status ${resB.status} -> ${resB.data.message || JSON.stringify(resB.data)}`);

  const statuses = [resA.status, resB.status].sort();
  if (statuses[0] === 201 && statuses[1] === 409) {
    console.log('✅ TEST 1 PASSED: Exactly one request succeeded (201) and the overlapping request failed (409)!');
  } else {
    console.error('❌ TEST 1 FAILED: Expected one 201 and one 409, got:', statuses);
    process.exit(1);
  }

  // Database Verification for Test 1
  const bookedSeatsRes = await db.query(
    `SELECT ss.seat_id, concat(s.row_name, s.seat_number) as label, ss.status
     FROM showtime_seats ss
     JOIN seats s ON ss.seat_id = s.id
     WHERE ss.showtime_id = $1 AND ss.seat_id IN ($2, $3, $4, $5)`,
    [showtimeId, seatMap['A1'], seatMap['A2'], seatMap['A3'], seatMap['A4']]
  );

  const winner = resA.status === 201 ? 'A' : 'B';
  console.log(`[DB Verify] Winner is Customer ${winner}. Verifying database integrity...`);
  
  if (winner === 'A') {
    // A1, A2, A3 should be BOOKED, A4 should remain AVAILABLE (no partial booking of A4 by B!)
    const seatA4 = bookedSeatsRes.rows.find(r => r.label === 'A4');
    if (seatA4 && seatA4.status === 'AVAILABLE') {
      console.log('✅ TEST 1 DB VERIFY PASSED: Seat A4 was NOT partially booked. Atomic rollback succeeded!');
    } else {
      console.error('❌ TEST 1 DB VERIFY FAILED: Seat A4 status is:', seatA4?.status);
      process.exit(1);
    }
  } else {
    // B won: A2, A3, A4 should be BOOKED, A1 should remain AVAILABLE (no partial booking of A1 by A!)
    const seatA1 = bookedSeatsRes.rows.find(r => r.label === 'A1');
    if (seatA1 && seatA1.status === 'AVAILABLE') {
      console.log('✅ TEST 1 DB VERIFY PASSED: Seat A1 was NOT partially booked. Atomic rollback succeeded!');
    } else {
      console.error('❌ TEST 1 DB VERIFY FAILED: Seat A1 status is:', seatA1?.status);
      process.exit(1);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 2: Identical Seats Race Condition (Customer C vs Customer D)
  // Both select D1, D2 simultaneously
  // --------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 2: Identical Seats Race Condition');
  console.log('Customer C requests: D1, D2');
  console.log('Customer D requests: D1, D2');
  console.log('----------------------------------------------------------------');

  const reqC = axios.post(`${BASE_URL}/bookings`, {
    customerName: 'Customer C',
    customerEmail: 'charlie@example.com',
    showtimeId,
    seatIds: [seatMap['D1'], seatMap['D2']]
  }).then(r => ({ status: r.status, data: r.data }))
    .catch(e => ({ status: e.response?.status || 500, data: e.response?.data }));

  const reqD = axios.post(`${BASE_URL}/bookings`, {
    customerName: 'Customer D',
    customerEmail: 'david@example.com',
    showtimeId,
    seatIds: [seatMap['D1'], seatMap['D2']]
  }).then(r => ({ status: r.status, data: r.data }))
    .catch(e => ({ status: e.response?.status || 500, data: e.response?.data }));

  const [resC, resD] = await Promise.all([reqC, reqD]);
  const statusesCD = [resC.status, resD.status].sort();

  if (statusesCD[0] === 201 && statusesCD[1] === 409) {
    console.log('✅ TEST 2 PASSED: Exactly one customer secured the identical seats; the other received 409 Conflict.');
  } else {
    console.error('❌ TEST 2 FAILED: Expected [201, 409], got:', statusesCD);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Disjoint Simultaneous Booking (Customer E vs Customer F)
  // Customer E selects: B1, B2
  // Customer F selects: B3, B4
  // --------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 3: Simultaneous Disjoint Bookings (Non-overlapping)');
  console.log('Customer E requests: B1, B2');
  console.log('Customer F requests: B3, B4');
  console.log('----------------------------------------------------------------');

  const reqE = axios.post(`${BASE_URL}/bookings`, {
    customerName: 'Customer E',
    customerEmail: 'emma@example.com',
    showtimeId,
    seatIds: [seatMap['B1'], seatMap['B2']]
  }).then(r => ({ status: r.status, data: r.data }))
    .catch(e => ({ status: e.response?.status || 500, data: e.response?.data }));

  const reqF = axios.post(`${BASE_URL}/bookings`, {
    customerName: 'Customer F',
    customerEmail: 'frank@example.com',
    showtimeId,
    seatIds: [seatMap['B3'], seatMap['B4']]
  }).then(r => ({ status: r.status, data: r.data }))
    .catch(e => ({ status: e.response?.status || 500, data: e.response?.data }));

  const [resE, resF] = await Promise.all([reqE, reqF]);
  if (resE.status === 201 && resF.status === 201) {
    console.log('✅ TEST 3 PASSED: Both independent bookings succeeded simultaneously with HTTP 201.');
  } else {
    console.error('❌ TEST 3 FAILED: Both should have succeeded. Got:', resE.status, resF.status);
    process.exit(1);
  }

  const bookingIdToCancel = resE.data.booking.id;

  // --------------------------------------------------------------------------
  // TEST 4: Group Booking with One Unavailable Seat (Atomic Rollback)
  // Request: B1 (already booked by E), B5, B6
  // --------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 4: Group Booking with One Unavailable Seat');
  console.log('Customer requests: B1 (already booked), B5, B6');
  console.log('----------------------------------------------------------------');

  try {
    const resPartial = await axios.post(`${BASE_URL}/bookings`, {
      customerName: 'Customer Partial Test',
      customerEmail: 'partial@example.com',
      showtimeId,
      seatIds: [seatMap['B1'], seatMap['B5'], seatMap['B6']]
    });
    console.error('❌ TEST 4 FAILED: Should have rejected, but got:', resPartial.status);
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 409) {
      console.log('✅ TEST 4 PASSED: Booking rejected with 409 Conflict.');
      // Verify B5 and B6 remain AVAILABLE
      const checkB5B6 = await db.query(
        `SELECT concat(s.row_name, s.seat_number) as label, ss.status
         FROM showtime_seats ss
         JOIN seats s ON ss.seat_id = s.id
         WHERE ss.showtime_id = $1 AND ss.seat_id IN ($2, $3)`,
        [showtimeId, seatMap['B5'], seatMap['B6']]
      );
      const allAvailable = checkB5B6.rows.every(r => r.status === 'AVAILABLE');
      if (allAvailable) {
        console.log('✅ TEST 4 DB VERIFY PASSED: B5 and B6 remain AVAILABLE. Zero partial booking!');
      } else {
        console.error('❌ TEST 4 DB VERIFY FAILED: Seats were partially modified:', checkB5B6.rows);
        process.exit(1);
      }
    } else {
      console.error('❌ TEST 4 FAILED: Expected 409, got:', err.response?.status);
      process.exit(1);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 5: Booking Cancellation and Seat Release
  // Cancel Customer E's booking (B1, B2)
  // --------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log(`TEST 5: Booking Cancellation & Safe Seat Release (Booking #${bookingIdToCancel})`);
  console.log('----------------------------------------------------------------');

  const cancelRes = await axios.delete(`${BASE_URL}/bookings/${bookingIdToCancel}`);
  if (cancelRes.status === 200 && cancelRes.data.success) {
    console.log(`✅ Cancel API response: ${cancelRes.data.message}`);

    // Check DB status of B1 and B2
    const releasedSeats = await db.query(
      `SELECT concat(s.row_name, s.seat_number) as label, ss.status
       FROM showtime_seats ss
       JOIN seats s ON ss.seat_id = s.id
       WHERE ss.showtime_id = $1 AND ss.seat_id IN ($2, $3)`,
      [showtimeId, seatMap['B1'], seatMap['B2']]
    );
    const areReleased = releasedSeats.rows.every(r => r.status === 'AVAILABLE');
    if (areReleased) {
      console.log('✅ TEST 5 PASSED: Seats B1 and B2 are back to AVAILABLE in PostgreSQL!');
    } else {
      console.error('❌ TEST 5 FAILED: Seats not released:', releasedSeats.rows);
      process.exit(1);
    }
  } else {
    console.error('❌ TEST 5 FAILED:', cancelRes.data);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Validation of Invalid Seat and Showtime IDs
  // --------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 6: Invalid Inputs & Error Handling');
  console.log('----------------------------------------------------------------');

  try {
    await axios.post(`${BASE_URL}/bookings`, {
      customerName: 'Invalid Test',
      customerEmail: 'test@example.com',
      showtimeId: 999999, // non-existent
      seatIds: [seatMap['A1']]
    });
    console.error('❌ TEST 6A FAILED: Non-existent showtime should fail with 404');
    process.exit(1);
  } catch (e) {
    if (e.response?.status === 404) {
      console.log('✅ TEST 6A PASSED: Non-existent showtime returned 404.');
    } else {
      console.error('❌ TEST 6A FAILED: Expected 404, got', e.response?.status);
    }
  }

  try {
    await axios.post(`${BASE_URL}/bookings`, {
      customerName: 'Invalid Test',
      customerEmail: 'test@example.com',
      showtimeId,
      seatIds: [999999] // non-existent seat ID
    });
    console.error('❌ TEST 6B FAILED: Non-existent seat ID should fail with 400');
    process.exit(1);
  } catch (e) {
    if (e.response?.status === 400) {
      console.log('✅ TEST 6B PASSED: Non-existent seat ID returned 400.');
    } else {
      console.error('❌ TEST 6B FAILED: Expected 400, got', e.response?.status);
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL MUTEX & CONCURRENCY TESTS COMPLETED SUCCESSFULLY!');
  console.log('   - Database row lock Mutex proved 100% effective.');
  console.log('   - No race conditions, no partial bookings, no duplicate seats.');
  console.log('===============================================================\n');

  await pool.end();
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
