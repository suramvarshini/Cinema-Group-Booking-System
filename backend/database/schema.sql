-- ==============================================================================
-- CINEMA GROUP TICKET BOOKING SYSTEM - DATABASE SCHEMA
-- ==============================================================================

-- Drop tables in reverse order of foreign key dependency if they exist
DROP TABLE IF EXISTS booking_seats CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS showtime_seats CASCADE;
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS showtimes CASCADE;
DROP TABLE IF EXISTS movies CASCADE;

-- 1. Movies Table
CREATE TABLE movies (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    duration INTEGER NOT NULL, -- duration in minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Showtimes Table
CREATE TABLE showtimes (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    show_date DATE NOT NULL,
    show_time VARCHAR(10) NOT NULL, -- e.g. '10:00 AM', '02:30 PM'
    ticket_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Cinema Master Seats Table
CREATE TABLE seats (
    id SERIAL PRIMARY KEY,
    seat_number INTEGER NOT NULL,
    row_name VARCHAR(10) NOT NULL,
    CONSTRAINT unique_row_seat UNIQUE (row_name, seat_number)
);

-- 4. Showtime Seats (Real-time seat state per showtime)
CREATE TABLE showtime_seats (
    id SERIAL PRIMARY KEY,
    showtime_id INTEGER NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
    seat_id INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BOOKED')),
    CONSTRAINT unique_showtime_seat_status UNIQUE (showtime_id, seat_id)
);

-- 5. Bookings Table
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    showtime_id INTEGER NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
    total_amount NUMERIC(10, 2) NOT NULL,
    booking_status VARCHAR(20) DEFAULT 'CONFIRMED' CHECK (booking_status IN ('CONFIRMED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Booking Seats (Strict unique mapping: a seat in a showtime can only be booked ONCE)
CREATE TABLE booking_seats (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    showtime_id INTEGER NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
    seat_id INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    CONSTRAINT unique_showtime_seat_booking UNIQUE (showtime_id, seat_id)
);

-- Performance Indexes
CREATE INDEX idx_showtimes_movie_id ON showtimes(movie_id);
CREATE INDEX idx_showtime_seats_showtime_id ON showtime_seats(showtime_id);
CREATE INDEX idx_showtime_seats_seat_id ON showtime_seats(seat_id);
CREATE INDEX idx_showtime_seats_lookup ON showtime_seats(showtime_id, status);
CREATE INDEX idx_bookings_showtime_id ON bookings(showtime_id);
CREATE INDEX idx_booking_seats_booking_id ON booking_seats(booking_id);
CREATE INDEX idx_booking_seats_showtime_seat ON booking_seats(showtime_id, seat_id);
