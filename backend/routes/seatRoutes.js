const express = require('express');
const router = express.Router();
const seatController = require('../controllers/seatController');

// GET /api/seats/:showtimeId
router.get('/:showtimeId', seatController.getSeatsByShowtimeId);

module.exports = router;
