-- ==============================================================================
-- CINEMA GROUP TICKET BOOKING SYSTEM - SEED DATA
-- ==============================================================================

-- 1. Insert Movies
INSERT INTO movies (title, description, image_url, duration) VALUES
(
    'Inception',
    'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
    148
),
(
    'Interstellar',
    'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft along with a team of researchers to find a new planet for humans.',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    169
),
(
    'The Dark Knight',
    'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    152
),
(
    'Dune: Part Two',
    'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family, facing a choice between love and the fate of the universe.',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    166
),
(
    'Oppenheimer',
    'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II.',
    'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=800&q=80',
    180
);

-- 2. Insert Showtimes
-- Movie 1: Inception
INSERT INTO showtimes (movie_id, show_date, show_time, ticket_price) VALUES
(1, CURRENT_DATE, '10:00 AM', 12.50),
(1, CURRENT_DATE, '02:30 PM', 14.00),
(1, CURRENT_DATE, '07:00 PM', 16.50);

-- Movie 2: Interstellar
INSERT INTO showtimes (movie_id, show_date, show_time, ticket_price) VALUES
(2, CURRENT_DATE, '11:00 AM', 13.00),
(2, CURRENT_DATE, '04:00 PM', 15.00),
(2, CURRENT_DATE + INTERVAL '1 day', '08:00 PM', 16.50);

-- Movie 3: The Dark Knight
INSERT INTO showtimes (movie_id, show_date, show_time, ticket_price) VALUES
(3, CURRENT_DATE, '01:00 PM', 12.00),
(3, CURRENT_DATE, '06:30 PM', 15.50),
(3, CURRENT_DATE + INTERVAL '1 day', '09:00 PM', 15.50);

-- Movie 4: Dune: Part Two
INSERT INTO showtimes (movie_id, show_date, show_time, ticket_price) VALUES
(4, CURRENT_DATE, '12:30 PM', 14.50),
(4, CURRENT_DATE, '05:30 PM', 16.00),
(4, CURRENT_DATE + INTERVAL '1 day', '08:30 PM', 17.00);

-- Movie 5: Oppenheimer
INSERT INTO showtimes (movie_id, show_date, show_time, ticket_price) VALUES
(5, CURRENT_DATE, '11:30 AM', 14.00),
(5, CURRENT_DATE, '03:45 PM', 15.50),
(5, CURRENT_DATE + INTERVAL '1 day', '07:30 PM', 16.50);

-- 3. Insert Seats (5 Rows: A, B, C, D, E with 10 Seats each: 1 to 10)
DO $$
DECLARE
    r VARCHAR(10);
    s INT;
    rows_arr VARCHAR(10)[] := ARRAY['A', 'B', 'C', 'D', 'E'];
BEGIN
    FOREACH r IN ARRAY rows_arr LOOP
        FOR s IN 1..10 LOOP
            INSERT INTO seats (row_name, seat_number)
            VALUES (r, s)
            ON CONFLICT (row_name, seat_number) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 4. Populate Showtime Seats for all showtimes
INSERT INTO showtime_seats (showtime_id, seat_id, status)
SELECT st.id, s.id, 'AVAILABLE'
FROM showtimes st
CROSS JOIN seats s
ON CONFLICT (showtime_id, seat_id) DO NOTHING;

-- 5. Seed a few existing realistic demo bookings for Showtime 1 (Inception 10:00 AM)
-- Let's book C4, C5 as an example group booking
DO $$
DECLARE
    b_id INT;
    st_id INT := 1;
    seat_c4 INT;
    seat_c5 INT;
    price NUMERIC(10, 2);
BEGIN
    SELECT id INTO seat_c4 FROM seats WHERE row_name = 'C' AND seat_number = 4;
    SELECT id INTO seat_c5 FROM seats WHERE row_name = 'C' AND seat_number = 5;
    SELECT ticket_price INTO price FROM showtimes WHERE id = st_id;

    IF seat_c4 IS NOT NULL AND seat_c5 IS NOT NULL THEN
        INSERT INTO bookings (customer_name, customer_email, showtime_id, total_amount, booking_status)
        VALUES ('Sarah Jenkins', 'sarah.j@example.com', st_id, price * 2, 'CONFIRMED')
        RETURNING id INTO b_id;

        INSERT INTO booking_seats (booking_id, showtime_id, seat_id)
        VALUES (b_id, st_id, seat_c4), (b_id, st_id, seat_c5);

        UPDATE showtime_seats
        SET status = 'BOOKED'
        WHERE showtime_id = st_id AND seat_id IN (seat_c4, seat_c5);
    END IF;
END $$;
