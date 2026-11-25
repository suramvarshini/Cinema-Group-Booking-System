import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import SeatGrid from '../components/SeatGrid';

export default function SeatSelectionPage() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();

  const [showtime, setShowtime] = useState(null);
  const [rows, setRows] = useState({});
  const [stats, setStats] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]); // array of seat objects
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conflictError, setConflictError] = useState(null);

  useEffect(() => {
    loadSeats();
  }, [showtimeId]);

  const loadSeats = async (preserveSelected = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSeats(showtimeId);
      setShowtime(data.showtime);
      setRows(data.rows);
      setStats(data.stats);

      // If refreshing, check if any previously selected seats are now BOOKED
      if (preserveSelected && selectedSeats.length > 0) {
        const flatSeats = data.seats || [];
        const stillAvailable = selectedSeats.filter(sel => {
          const fresh = flatSeats.find(s => s.seatId === sel.seatId);
          return fresh && fresh.status === 'AVAILABLE';
        });
        setSelectedSeats(stillAvailable);
      }
    } catch (err) {
      setError(err.message || 'Failed to load theatre seat map.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSeat = (seat) => {
    setConflictError(null);
    const isSelected = selectedSeats.some(s => s.seatId === seat.seatId);

    if (isSelected) {
      // Deselect
      setSelectedSeats(prev => prev.filter(s => s.seatId !== seat.seatId));
    } else {
      // Select (Deselect not blocked; customers can select multiple adjacent seats)
      setSelectedSeats(prev => [...prev, seat]);
    }
  };

  const handleDeselectAll = () => {
    setSelectedSeats([]);
  };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (selectedSeats.length === 0) {
      setError('Please select at least one seat before confirming booking.');
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      setError('Please enter your full name and email address.');
      return;
    }

    try {
      setBookingLoading(true);
      setError(null);
      setConflictError(null);

      const seatIds = selectedSeats.map(s => s.seatId);
      const response = await api.createBooking({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        showtimeId: parseInt(showtimeId, 10),
        seatIds
      });

      // Booking succeeded! Navigate to Booking Confirmation Page
      navigate(`/confirmation/${response.booking.id}`);
    } catch (err) {
      console.warn('Booking rejected:', err);
      // If error is 409 Conflict (real PostgreSQL Mutex collision)
      if (err.status === 409 || err.data?.conflict) {
        setConflictError(
          err.data?.message ||
          'Concurrency Conflict: One or more selected seats were booked simultaneously by another customer. The transaction was rolled back safely.'
        );
        // Automatically refresh seat layout to reflect newly booked seats
        await loadSeats(true);
      } else {
        setError(err.data?.message || err.message || 'Booking failed.');
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const ticketPrice = showtime ? parseFloat(showtime.ticketPrice) : 0;
  const totalPrice = (selectedSeats.length * ticketPrice).toFixed(2);

  if (loading && !showtime) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.2rem' }}>Loading cinema auditorium layout...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Top Navigation & Movie Header */}
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: '0.5rem' }}>
            ← Back
          </button>
          <h1 className="page-title">{showtime?.movieTitle}</h1>
          <p className="page-subtitle">
            📅 {new Date(showtime?.showDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at{' '}
            <strong>{showtime?.showTime}</strong> • ${ticketPrice.toFixed(2)} per ticket
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={() => loadSeats(true)}>
          🔄 Refresh Seats
        </button>
      </div>

      {/* Mutex Collision Alert Banner */}
      {conflictError && (
        <div className="alert alert-danger" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <span>🔒 Database Mutex Protection Activated:</span>
          </div>
          <div>{conflictError}</div>
          <div style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>
            Seat availability has been re-synchronized with PostgreSQL. Please select available seats to proceed.
          </div>
        </div>
      )}

      {error && !conflictError && (
        <div className="alert alert-danger">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Main Theatre Grid and Sidebar Layout */}
      <div className="theatre-container">
        {/* Left Column: Theatre Seat Grid */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Select Cinema Seats</h2>
            {stats && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong>{stats.availableSeats}</strong> Available / <strong>{stats.bookedSeats}</strong> Booked
              </div>
            )}
          </div>

          <SeatGrid
            rows={rows}
            selectedSeatIds={selectedSeats.map(s => s.seatId)}
            onToggleSeat={handleToggleSeat}
          />
        </div>

        {/* Right Column: Sticky Booking Summary & Customer Form */}
        <div className="booking-sidebar">
          <h3 className="sidebar-title">Booking Summary</h3>

          <div className="summary-row">
            <span className="summary-label">Movie</span>
            <span className="summary-val">{showtime?.movieTitle}</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Showtime</span>
            <span className="summary-val">{showtime?.showTime}</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Ticket Price</span>
            <span className="summary-val">${ticketPrice.toFixed(2)}</span>
          </div>

          <div className="summary-divider"></div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="summary-label">Selected Seats ({selectedSeats.length}):</span>
              {selectedSeats.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            {selectedSeats.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                Click on available green seats to select multiple adjacent seats.
              </div>
            ) : (
              <div className="selected-badges-wrap">
                {selectedSeats
                  .sort((a, b) => a.seatLabel.localeCompare(b.seatLabel))
                  .map(s => (
                    <span key={s.seatId} className="seat-badge">
                      {s.seatLabel}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div className="summary-divider"></div>

          <div className="summary-row" style={{ alignItems: 'baseline' }}>
            <span className="summary-label" style={{ fontWeight: 700 }}>Total Amount:</span>
            <span className="summary-total">${totalPrice}</span>
          </div>

          <form onSubmit={handleConfirmBooking} style={{ marginTop: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="customerName">
                Customer Name *
              </label>
              <input
                id="customerName"
                type="text"
                required
                className="form-control"
                placeholder="e.g. John Doe"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="customerEmail">
                Email Address *
              </label>
              <input
                id="customerEmail"
                type="email"
                required
                className="form-control"
                placeholder="e.g. john@example.com"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={selectedSeats.length === 0 || bookingLoading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '0.5rem' }}
            >
              {bookingLoading ? 'Acquiring Mutex Lock...' : `Confirm Booking ($${totalPrice})`}
            </button>
          </form>

          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.75rem' }}>
            🔒 Protected by PostgreSQL Row-Level Mutex (Atomic Group Booking)
          </div>
        </div>
      </div>
    </div>
  );
}
