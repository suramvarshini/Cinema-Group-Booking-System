import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function BookingConfirmationPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getBooking(bookingId);
      setBooking(data.booking);
    } catch (err) {
      setError(err.message || 'Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.2rem' }}>Retrieving your booking confirmation...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
        <div className="alert alert-danger">
          <span>⚠️ {error || 'Booking not found.'}</span>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Back to Movies
        </button>
      </div>
    );
  }

  const isConfirmed = booking.bookingStatus === 'CONFIRMED';
  const formattedDate = new Date(booking.showDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div>
      <div className="ticket-receipt">
        {/* Ticket Header & Status Banner */}
        <div className="ticket-header">
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
            {isConfirmed ? '🎉' : '❌'}
          </div>
          <h1 style={{ fontSize: '1.75rem', color: 'var(--primary-navy)', marginBottom: '0.25rem' }}>
            {isConfirmed ? 'Booking Confirmed!' : 'Booking Cancelled'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isConfirmed
              ? 'Your tickets have been safely secured in PostgreSQL database.'
              : 'This booking has been cancelled and seats were released.'}
          </p>

          <div style={{ marginTop: '0.75rem' }}>
            <span className={`status-badge ${isConfirmed ? 'confirmed' : 'cancelled'}`}>
              ● {booking.bookingStatus}
            </span>
          </div>
        </div>

        {/* Ticket Meta Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Booking Reference
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-navy)' }}>
              #{booking.id}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Booking Date
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {new Date(booking.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Movie Info */}
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {booking.movieImageUrl && (
            <img
              src={booking.movieImageUrl}
              alt={booking.movieTitle}
              style={{ width: '60px', height: '80px', objectFit: 'cover', borderRadius: '4px' }}
            />
          )}
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary-navy)' }}>
              {booking.movieTitle}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              📅 {formattedDate} • ⏰ {booking.showTime}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Duration: {booking.duration} mins
            </div>
          </div>
        </div>

        {/* Customer & Seats Details */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="summary-row">
            <span className="summary-label">Customer:</span>
            <span className="summary-val">{booking.customerName}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Email:</span>
            <span className="summary-val">{booking.customerEmail}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Selected Seats:</span>
            <span className="summary-val">
              {booking.seats && booking.seats.length > 0 ? (
                <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {booking.seats.map(s => (
                    <span key={s.seatId} className="seat-badge">
                      {s.seatLabel}
                    </span>
                  ))}
                </span>
              ) : (
                'None'
              )}
            </span>
          </div>
        </div>

        <div className="summary-divider"></div>

        {/* Price Breakdown */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="summary-row">
            <span className="summary-label">Ticket Count:</span>
            <span className="summary-val">{booking.seats?.length || 0} tickets</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Price per Ticket:</span>
            <span className="summary-val">${parseFloat(booking.ticketPrice).toFixed(2)}</span>
          </div>
          <div className="summary-row" style={{ marginTop: '0.75rem', fontSize: '1.1rem' }}>
            <span className="summary-label" style={{ fontWeight: 700, color: 'var(--primary-navy)' }}>Total Paid:</span>
            <span className="summary-total">${parseFloat(booking.totalAmount).toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/my-bookings')}>
            View My Bookings →
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/')}>
              Book Another Movie
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handlePrint}>
              🖨️ Print Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
