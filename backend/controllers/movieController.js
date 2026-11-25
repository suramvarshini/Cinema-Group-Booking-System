const { query } = require('../config/db');

async function getAllMovies(req, res, next) {
  try {
    const moviesRes = await query(`
      SELECT 
        m.id, 
        m.title, 
        m.description, 
        m.image_url, 
        m.duration, 
        m.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', st.id,
              'showDate', st.show_date,
              'showTime', st.show_time,
              'ticketPrice', st.ticket_price
            ) ORDER BY st.show_date ASC, st.show_time ASC
          ) FILTER (WHERE st.id IS NOT NULL), '[]'
        ) AS showtimes
      FROM movies m
      LEFT JOIN showtimes st ON m.id = st.movie_id
      GROUP BY m.id
      ORDER BY m.id ASC
    `);

    res.json({
      success: true,
      count: moviesRes.rows.length,
      movies: moviesRes.rows
    });
  } catch (err) {
    next(err);
  }
}

async function getMovieById(req, res, next) {
  try {
    const movieId = parseInt(req.params.movieId, 10);
    if (!movieId || isNaN(movieId)) {
      return res.status(400).json({ success: false, message: 'Invalid movie ID' });
    }

    const movieRes = await query(
      `SELECT id, title, description, image_url, duration, created_at FROM movies WHERE id = $1`,
      [movieId]
    );

    if (movieRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    const showtimesRes = await query(
      `SELECT id, show_date, show_time, ticket_price 
       FROM showtimes 
       WHERE movie_id = $1 
       ORDER BY show_date ASC, show_time ASC`,
      [movieId]
    );

    res.json({
      success: true,
      movie: {
        ...movieRes.rows[0],
        showtimes: showtimesRes.rows.map(st => ({
          id: st.id,
          showDate: st.show_date,
          showTime: st.show_time,
          ticketPrice: parseFloat(st.ticket_price)
        }))
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllMovies,
  getMovieById
};
