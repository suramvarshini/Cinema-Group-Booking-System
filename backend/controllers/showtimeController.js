const { query } = require('../config/db');

async function getShowtimesByMovieId(req, res, next) {
  try {
    const movieId = parseInt(req.params.movieId, 10);
    if (!movieId || isNaN(movieId)) {
      return res.status(400).json({ success: false, message: 'Invalid movie ID' });
    }

    const showtimesRes = await query(
      `SELECT st.id, st.movie_id, st.show_date, st.show_time, st.ticket_price,
              m.title AS movie_title, m.image_url, m.duration,
              COUNT(ss.id) FILTER (WHERE ss.status = 'AVAILABLE') AS available_seats,
              COUNT(ss.id) FILTER (WHERE ss.status = 'BOOKED') AS booked_seats,
              COUNT(ss.id) AS total_seats
       FROM showtimes st
       JOIN movies m ON st.movie_id = m.id
       LEFT JOIN showtime_seats ss ON st.id = ss.showtime_id
       WHERE st.movie_id = $1
       GROUP BY st.id, m.title, m.image_url, m.duration
       ORDER BY st.show_date ASC, st.show_time ASC`,
      [movieId]
    );

    res.json({
      success: true,
      count: showtimesRes.rows.length,
      showtimes: showtimesRes.rows.map(st => ({
        id: st.id,
        movieId: st.movie_id,
        movieTitle: st.movie_title,
        showDate: st.show_date,
        showTime: st.show_time,
        ticketPrice: parseFloat(st.ticket_price),
        availableSeats: parseInt(st.available_seats || 0, 10),
        bookedSeats: parseInt(st.booked_seats || 0, 10),
        totalSeats: parseInt(st.total_seats || 0, 10)
      }))
    });
  } catch (err) {
    next(err);
  }
}

async function getShowtimeById(req, res, next) {
  try {
    const showtimeId = parseInt(req.params.showtimeId, 10);
    if (!showtimeId || isNaN(showtimeId)) {
      return res.status(400).json({ success: false, message: 'Invalid showtime ID' });
    }

    const showtimeRes = await query(
      `SELECT st.id, st.movie_id, st.show_date, st.show_time, st.ticket_price,
              m.title AS movie_title, m.image_url, m.duration, m.description
       FROM showtimes st
       JOIN movies m ON st.movie_id = m.id
       WHERE st.id = $1`,
      [showtimeId]
    );

    if (showtimeRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Showtime not found' });
    }

    const st = showtimeRes.rows[0];
    res.json({
      success: true,
      showtime: {
        id: st.id,
        movieId: st.movie_id,
        movieTitle: st.movie_title,
        movieDescription: st.description,
        movieImageUrl: st.image_url,
        duration: st.duration,
        showDate: st.show_date,
        showTime: st.show_time,
        ticketPrice: parseFloat(st.ticket_price)
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getShowtimesByMovieId,
  getShowtimeById
};
