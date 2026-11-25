const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// POST /api/bookings - Atomic group booking with row-lock Mutex
router.post('/', bookingController.createBooking);

// GET /api/bookings - Fetch booking history
router.get('/', bookingController.getAllBookings);

// GET /api/bookings/:bookingId - Fetch booking details
router.get('/:bookingId', bookingController.getBookingById);

// DELETE /api/bookings/:bookingId - Safely cancel booking and release seats
router.delete('/:bookingId', bookingController.cancelBooking);

module.exports = router;
