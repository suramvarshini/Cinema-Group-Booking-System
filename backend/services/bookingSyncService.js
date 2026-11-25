const { getClient } = require('../config/db');

/**
 * DEDICATED BOOKING SYNCHRONIZATION SERVICE
 * 
 * Implements real PostgreSQL transaction-based row locking Mutex:
 * 1. Validates inputs & formats seat IDs deterministically.
 * 2. Starts PostgreSQL transaction (BEGIN).
 * 3. Locks showtime row using SELECT FOR UPDATE (acting as the showtime Mutex).
 * 4. Locks requested seat rows using SELECT FOR UPDATE in ascending seat_id order.
 * 5. Verifies all seats exist and belong to the showtime.
 * 6. Checks availability: if even one seat is booked, ROLLBACK immediately (atomic).
 * 7. If all available, inserts booking record & booking_seats records.
 * 8. Updates showtime_seats status to 'BOOKED'.
 * 9. Commits transaction (COMMIT), which automatically releases the row locks.
 */

async function createAtomicGroupBooking({ customerName, customerEmail, showtimeId, seatIds }) {
  // Step 1: Request Validation
  if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
    throw { status: 400, message: 'Valid customer name is required.' };
  }
  if (!customerEmail || !customerEmail.includes('@')) {
    throw { status: 400, message: 'Valid email address is required.' };
  }
  const sId = parseInt(showtimeId, 10);
  if (!sId || isNaN(sId)) {
    throw { status: 400, message: 'Valid showtime ID is required.' };
  }
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw { status: 400, message: 'At least one seat must be selected for booking.' };
  }

  // Deduplicate and sort seat IDs deterministically to guarantee consistent lock ordering (Deadlock prevention)
  const sortedSeatIds = [...new Set(seatIds.map(id => parseInt(id, 10)))].sort((a, b) => a - b);
  if (sortedSeatIds.some(id => isNaN(id) || id <= 0)) {
    throw { status: 400, message: 'Invalid seat ID provided in selection list.' };
  }

  const client = await getClient();
  const startTime = Date.now();

  try {
    // Step 3: Start a PostgreSQL Transaction
    await client.query('BEGIN');

    // Step 4 & 5: Acquire Row Lock on the Showtime row using SELECT FOR UPDATE
    // This serves as the Cross-Request Mutex for that specific showtime.
    const showtimeRes = await client.query(
      `SELECT st.id, st.movie_id, st.show_date, st.show_time, st.ticket_price, m.title AS movie_title
       FROM showtimes st
       JOIN movies m ON st.movie_id = m.id
       WHERE st.id = $1
       FOR UPDATE`,
      [sId]
    );

    if (showtimeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      throw { status: 404, message: `Showtime #${sId} does not exist.` };
    }
    const showtime = showtimeRes.rows[0];

    // Step 6: Retrieve the selected seat records and lock them in consistent ascending order
    const seatsLockRes = await client.query(
      `SELECT ss.id, ss.showtime_id, ss.seat_id, ss.status, s.row_name, s.seat_number
       FROM showtime_seats ss
       JOIN seats s ON ss.seat_id = s.id
       WHERE ss.showtime_id = $1 AND ss.seat_id = ANY($2::int[])
       ORDER BY ss.seat_id ASC
       FOR UPDATE`,
      [sId, sortedSeatIds]
    );

    const lockedSeats = seatsLockRes.rows;

    // Step 7: Verify that every requested seat belongs to this showtime
    if (lockedSeats.length !== sortedSeatIds.length) {
      const foundSeatIds = new Set(lockedSeats.map(s => s.seat_id));
      const missing = sortedSeatIds.filter(id => !foundSeatIds.has(id));
      await client.query('ROLLBACK');
      throw {
        status: 400,
        message: `Validation failed: Seat IDs [${missing.join(', ')}] are not mapped to showtime #${sId}.`
      };
    }

    // Step 8: Check whether all requested seats are available
    const unavailableSeats = lockedSeats.filter(s => s.status !== 'AVAILABLE');
    if (unavailableSeats.length > 0) {
      const unavailableSeatLabels = unavailableSeats.map(s => `${s.row_name}${s.seat_number}`);
      
      // Roll back the entire transaction. Zero partial booking.
      await client.query('ROLLBACK');
      
      throw {
        status: 409,
        conflict: true,
        message: `Booking failed: Seat(s) [${unavailableSeatLabels.join(', ')}] are already booked or unavailable. The entire group booking has been aborted atomically.`,
        unavailableSeats: unavailableSeatLabels,
        unavailableSeatIds: unavailableSeats.map(s => s.seat_id)
      };
    }

    // Step 9: If all seats are available, calculate total price and insert one booking record
    const ticketPrice = parseFloat(showtime.ticket_price);
    const totalAmount = ticketPrice * sortedSeatIds.length;

    const bookingRes = await client.query(
      `INSERT INTO bookings (customer_name, customer_email, showtime_id, total_amount, booking_status)
       VALUES ($1, $2, $3, $4, 'CONFIRMED')
       RETURNING id, customer_name, customer_email, showtime_id, total_amount, booking_status, created_at`,
      [customerName.trim(), customerEmail.trim().toLowerCase(), sId, totalAmount]
    );
    const booking = bookingRes.rows[0];

    // Step 10: Insert all associated seat records & update status to 'BOOKED'
    for (const seatId of sortedSeatIds) {
      await client.query(
        `INSERT INTO booking_seats (booking_id, showtime_id, seat_id)
         VALUES ($1, $2, $3)`,
        [booking.id, sId, seatId]
      );
    }

    await client.query(
      `UPDATE showtime_seats
       SET status = 'BOOKED'
       WHERE showtime_id = $1 AND seat_id = ANY($2::int[])`,
      [sId, sortedSeatIds]
    );

    // Step 11: Commit the transaction
    await client.query('COMMIT');

    const durationMs = Date.now() - startTime;
    console.log(`[MUTEX] Group booking #${booking.id} committed safely for showtime #${sId} (${sortedSeatIds.length} seats) in ${durationMs}ms`);

    // Step 12: PostgreSQL automatically releases row locks on COMMIT
    return {
      success: true,
      message: 'Group booking confirmed successfully!',
      booking: {
        id: booking.id,
        customerName: booking.customer_name,
        customerEmail: booking.customer_email,
        showtimeId: booking.showtime_id,
        movieTitle: showtime.movie_title,
        showDate: showtime.show_date,
        showTime: showtime.show_time,
        ticketPrice: ticketPrice,
        totalAmount: parseFloat(booking.total_amount),
        bookingStatus: booking.booking_status,
        createdAt: booking.created_at,
        seats: lockedSeats.map(s => ({
          seatId: s.seat_id,
          seatLabel: `${s.row_name}${s.seat_number}`,
          row: s.row_name,
          number: s.seat_number
        }))
      }
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {}

    // Unique constraint violation safety check (database level constraint)
    if (err.code === '23505') {
      throw {
        status: 409,
        conflict: true,
        message: 'Unique constraint triggered: One or more selected seats were booked simultaneously by another transaction. Database integrity preserved.',
        dbError: err.message
      };
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cancel a booking safely and release its seats inside a database transaction
 */
async function cancelBookingSafely(bookingId) {
  const bId = parseInt(bookingId, 10);
  if (!bId || isNaN(bId)) {
    throw { status: 400, message: 'Valid booking ID is required.' };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the booking row
    const bookingRes = await client.query(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
      [bId]
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      throw { status: 404, message: `Booking #${bId} not found.` };
    }

    const booking = bookingRes.rows[0];
    if (booking.booking_status === 'CANCELLED') {
      await client.query('ROLLBACK');
      throw { status: 400, message: `Booking #${bId} has already been cancelled.` };
    }

    // Lock showtime row
    await client.query(
      `SELECT id FROM showtimes WHERE id = $1 FOR UPDATE`,
      [booking.showtime_id]
    );

    // Retrieve associated seats
    const seatsRes = await client.query(
      `SELECT seat_id FROM booking_seats WHERE booking_id = $1 FOR UPDATE`,
      [bId]
    );
    const seatIds = seatsRes.rows.map(r => r.seat_id);

    if (seatIds.length > 0) {
      // Release seats back to 'AVAILABLE'
      await client.query(
        `UPDATE showtime_seats
         SET status = 'AVAILABLE'
         WHERE showtime_id = $1 AND seat_id = ANY($2::int[])`,
        [booking.showtime_id, seatIds]
      );

      // Remove from booking_seats to free unique constraint
      await client.query(
        `DELETE FROM booking_seats WHERE booking_id = $1`,
        [bId]
      );
    }

    // Update status to CANCELLED
    const updateRes = await client.query(
      `UPDATE bookings
       SET booking_status = 'CANCELLED'
       WHERE id = $1
       RETURNING *`,
      [bId]
    );

    await client.query('COMMIT');
    console.log(`[MUTEX] Booking #${bId} cancelled and ${seatIds.length} seat(s) released.`);

    return {
      success: true,
      message: `Booking #${bId} cancelled successfully and seats released.`,
      booking: updateRes.rows[0]
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {}
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createAtomicGroupBooking,
  cancelBookingSafely
};
