const express = require('express');
const router = express.Router();
const showtimeController = require('../controllers/showtimeController');

// GET /api/showtimes/:movieId
router.get('/:movieId', showtimeController.getShowtimesByMovieId);

// GET /api/showtimes/detail/:showtimeId
router.get('/detail/:showtimeId', showtimeController.getShowtimeById);

module.exports = router;
