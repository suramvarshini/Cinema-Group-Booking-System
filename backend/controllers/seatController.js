const { query } = require('../config/db');

async function getSeatsByShowtimeId(req, res, next) {
  try {
    const showtimeId = parseInt(req.params.showtimeId, 10);
    if (!showtimeId || isNaN(showtimeId)) {
      return res.status(400).json({ success: false, message: 'Valid showtime ID is required' });
    }

    // Verify showtime existence
    const showtimeRes = await query(
      `SELECT st.id, st.movie_id, st.show_date, st.show_time, st.ticket_price,
              m.title AS movie_title, m.image_url, m.duration
       FROM showtimes st
       JOIN movies m ON st.movie_id = m.id
       WHERE st.id = $1`,
      [showtimeId]
    );

    if (showtimeRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Showtime #${showtimeId} not found` });
    }

    const showtime = showtimeRes.rows[0];

    // Fetch all seats for this showtime ordered by row and seat_number
    const seatsRes = await query(
      `SELECT 
         ss.id AS showtime_seat_id,
         ss.seat_id,
         ss.status,
         s.row_name,
         s.seat_number
       FROM showtime_seats ss
       JOIN seats s ON ss.seat_id = s.id
       WHERE ss.showtime_id = $1
       ORDER BY s.row_name ASC, s.seat_number ASC`,
      [showtimeId]
    );

    // Group seats by row for clean frontend grid rendering
    const rowsMap = {};
    let availableCount = 0;
    let bookedCount = 0;

    seatsRes.rows.forEach(seat => {
      if (!rowsMap[seat.row_name]) {
        rowsMap[seat.row_name] = [];
      }
      if (seat.status === 'AVAILABLE') {
        availableCount++;
      } else {
        bookedCount++;
      }
      rowsMap[seat.row_name].push({
        seatId: seat.seat_id,
        seatLabel: `${seat.row_name}${seat.seat_number}`,
        row: seat.row_name,
        seatNumber: seat.seat_number,
        status: seat.status // 'AVAILABLE' or 'BOOKED'
      });
    });

    res.json({
      success: true,
      showtime: {
        id: showtime.id,
        movieId: showtime.movie_id,
        movieTitle: showtime.movie_title,
        showDate: showtime.show_date,
        showTime: showtime.show_time,
        ticketPrice: parseFloat(showtime.ticket_price),
        imageUrl: showtime.image_url,
        duration: showtime.duration
      },
      stats: {
        totalSeats: seatsRes.rows.length,
        availableSeats: availableCount,
        bookedSeats: bookedCount
      },
      rows: rowsMap,
      seats: seatsRes.rows.map(s => ({
        seatId: s.seat_id,
        seatLabel: `${s.row_name}${s.seat_number}`,
        row: s.row_name,
        seatNumber: s.seat_number,
        status: s.status
      }))
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSeatsByShowtimeId
};
