const { query } = require('../config/db');
const { createAtomicGroupBooking, cancelBookingSafely } = require('../services/bookingSyncService');

/**
 * POST /api/bookings
 * Create atomic group booking with Mutex row-locking
 */
async function createBooking(req, res, next) {
  try {
    const { customerName, customerEmail, showtimeId, seatIds } = req.body;

    const result = await createAtomicGroupBooking({
      customerName,
      customerEmail,
      showtimeId,
      seatIds
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        conflict: !!err.conflict,
        message: err.message,
        unavailableSeats: err.unavailableSeats || [],
        unavailableSeatIds: err.unavailableSeatIds || []
      });
    }
    next(err);
  }
}

/**
 * GET /api/bookings/:bookingId
 * Fetch single booking details
 */
async function getBookingById(req, res, next) {
  try {
    const bookingId = parseInt(req.params.bookingId, 10);
    if (!bookingId || isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const bookingRes = await query(
      `SELECT 
         b.id,
         b.customer_name,
         b.customer_email,
         b.showtime_id,
         b.total_amount,
         b.booking_status,
         b.created_at,
         st.show_date,
         st.show_time,
         st.ticket_price,
         m.id AS movie_id,
         m.title AS movie_title,
         m.image_url,
         m.duration,
         COALESCE(
           json_agg(
             json_build_object(
               'seatId', s.id,
               'seatLabel', concat(s.row_name, s.seat_number),
               'row', s.row_name,
               'number', s.seat_number
             ) ORDER BY s.row_name ASC, s.seat_number ASC
           ) FILTER (WHERE s.id IS NOT NULL), '[]'
         ) AS seats
       FROM bookings b
       JOIN showtimes st ON b.showtime_id = st.id
       JOIN movies m ON st.movie_id = m.id
       LEFT JOIN booking_seats bs ON b.id = bs.booking_id
       LEFT JOIN seats s ON bs.seat_id = s.id
       WHERE b.id = $1
       GROUP BY b.id, st.id, m.id`,
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Booking #${bookingId} not found` });
    }

    const b = bookingRes.rows[0];
    res.json({
      success: true,
      booking: {
        id: b.id,
        customerName: b.customer_name,
        customerEmail: b.customer_email,
        showtimeId: b.showtime_id,
        movieTitle: b.movie_title,
        movieImageUrl: b.image_url,
        duration: b.duration,
        showDate: b.show_date,
        showTime: b.show_time,
        ticketPrice: parseFloat(b.ticket_price),
        totalAmount: parseFloat(b.total_amount),
        bookingStatus: b.booking_status,
        createdAt: b.created_at,
        seats: b.seats
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bookings
 * Fetch all previous bookings
 */
async function getAllBookings(req, res, next) {
  try {
    const bookingsRes = await query(
      `SELECT 
         b.id,
         b.customer_name,
         b.customer_email,
         b.showtime_id,
         b.total_amount,
         b.booking_status,
         b.created_at,
         st.show_date,
         st.show_time,
         st.ticket_price,
         m.title AS movie_title,
         m.image_url,
         COALESCE(
           json_agg(
             json_build_object(
               'seatId', s.id,
               'seatLabel', concat(s.row_name, s.seat_number),
               'row', s.row_name,
               'number', s.seat_number
             ) ORDER BY s.row_name ASC, s.seat_number ASC
           ) FILTER (WHERE s.id IS NOT NULL), '[]'
         ) AS seats
       FROM bookings b
       JOIN showtimes st ON b.showtime_id = st.id
       JOIN movies m ON st.movie_id = m.id
       LEFT JOIN booking_seats bs ON b.id = bs.booking_id
       LEFT JOIN seats s ON bs.seat_id = s.id
       GROUP BY b.id, st.id, m.id
       ORDER BY b.created_at DESC`
    );

    res.json({
      success: true,
      count: bookingsRes.rows.length,
      bookings: bookingsRes.rows.map(b => ({
        id: b.id,
        customerName: b.customer_name,
        customerEmail: b.customer_email,
        showtimeId: b.showtime_id,
        movieTitle: b.movie_title,
        movieImageUrl: b.image_url,
        showDate: b.show_date,
        showTime: b.show_time,
        ticketPrice: parseFloat(b.ticket_price),
        totalAmount: parseFloat(b.total_amount),
        bookingStatus: b.booking_status,
        createdAt: b.created_at,
        seats: b.seats
      }))
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/bookings/:bookingId
 * Cancel booking safely and release seats
 */
async function cancelBooking(req, res, next) {
  try {
    const bookingId = parseInt(req.params.bookingId, 10);
    const result = await cancelBookingSafely(bookingId);
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message
      });
    }
    next(err);
  }
}

module.exports = {
  createBooking,
  getBookingById,
  getAllBookings,
  cancelBooking
};
