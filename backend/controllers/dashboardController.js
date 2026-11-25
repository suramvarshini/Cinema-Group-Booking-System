const { query } = require('../config/db');

async function getDashboardStats(req, res, next) {
  try {
    // 1. Total Movies
    const moviesCountRes = await query('SELECT COUNT(*) FROM movies');
    const totalMovies = parseInt(moviesCountRes.rows[0].count, 10);

    // 2. Total Bookings (all and active)
    const bookingsCountRes = await query(`
      SELECT 
        COUNT(*) AS total_bookings,
        COUNT(*) FILTER (WHERE booking_status = 'CONFIRMED') AS active_bookings,
        COUNT(*) FILTER (WHERE booking_status = 'CANCELLED') AS cancelled_bookings,
        COALESCE(SUM(total_amount) FILTER (WHERE booking_status = 'CONFIRMED'), 0) AS total_revenue
      FROM bookings
    `);
    const bookingStats = bookingsCountRes.rows[0];

    // 3. Seat Inventory (across showtimes)
    const seatsRes = await query(`
      SELECT 
        COUNT(*) AS total_showtime_seats,
        COUNT(*) FILTER (WHERE status = 'AVAILABLE') AS available_seats,
        COUNT(*) FILTER (WHERE status = 'BOOKED') AS booked_seats
      FROM showtime_seats
    `);
    const seatStats = seatsRes.rows[0];

    // 4. Recent Bookings (top 5)
    const recentRes = await query(`
      SELECT 
        b.id,
        b.customer_name,
        b.customer_email,
        b.total_amount,
        b.booking_status,
        b.created_at,
        st.show_date,
        st.show_time,
        m.title AS movie_title,
        COALESCE(
          string_agg(concat(s.row_name, s.seat_number), ', ' ORDER BY s.row_name, s.seat_number), ''
        ) AS seat_labels
      FROM bookings b
      JOIN showtimes st ON b.showtime_id = st.id
      JOIN movies m ON st.movie_id = m.id
      LEFT JOIN booking_seats bs ON b.id = bs.booking_id
      LEFT JOIN seats s ON bs.seat_id = s.id
      GROUP BY b.id, st.id, m.id
      ORDER BY b.created_at DESC
      LIMIT 6
    `);

    res.json({
      success: true,
      stats: {
        totalMovies,
        totalBookings: parseInt(bookingStats.total_bookings, 10),
        activeBookings: parseInt(bookingStats.active_bookings, 10),
        cancelledBookings: parseInt(bookingStats.cancelled_bookings, 10),
        totalRevenue: parseFloat(bookingStats.total_revenue),
        availableSeats: parseInt(seatStats.available_seats, 10),
        bookedSeats: parseInt(seatStats.booked_seats, 10),
        totalSeats: parseInt(seatStats.total_showtime_seats, 10)
      },
      recentBookings: recentRes.rows.map(r => ({
        id: r.id,
        customerName: r.customer_name,
        customerEmail: r.customer_email,
        movieTitle: r.movie_title,
        showDate: r.show_date,
        showTime: r.show_time,
        seats: r.seat_labels,
        totalAmount: parseFloat(r.total_amount),
        bookingStatus: r.booking_status,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats
};
