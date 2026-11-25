import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAllBookings();
      setBookings(data.bookings || []);
    } catch (err) {
      setError(err.message || 'Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    const confirmed = window.confirm(`Are you sure you want to cancel Booking #${bookingId}? The seats will be released back to the auditorium immediately.`);
    if (!confirmed) return;

    try {
      setCancellingId(bookingId);
      setError(null);
      setSuccessMsg(null);
      const res = await api.cancelBooking(bookingId);
      setSuccessMsg(res.message || `Booking #${bookingId} successfully cancelled.`);
      await loadBookings();
    } catch (err) {
      setError(err.data?.message || err.message || 'Failed to cancel booking.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Booking History</h1>
          <p className="page-subtitle">
            Review past reservations or safely cancel and release seats with database transaction synchronization.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadBookings}>
            🔄 Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>
            + Book New Tickets
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success">
          <span>✅ {successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.2rem' }}>Loading booking records...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎟️</div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No Bookings Found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            You haven't booked any cinema tickets yet. Select a movie to get started!
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Browse Movies Now
          </button>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Booking Ref</th>
                <th>Movie</th>
                <th>Showtime</th>
                <th>Customer</th>
                <th>Selected Seats</th>
                <th>Total Paid</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                const isConfirmed = b.bookingStatus === 'CONFIRMED';
                const formattedDate = new Date(b.showDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <tr key={b.id}>
                    <td>
                      <strong style={{ color: 'var(--primary-navy)' }}>#{b.id}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(b.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--primary-navy)' }}>
                        {b.movieTitle}
                      </div>
                    </td>
                    <td>
                      <div>{b.showTime}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formattedDate}</div>
                    </td>
                    <td>
                      <div>{b.customerName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.customerEmail}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', maxWidth: '200px' }}>
                        {b.seats && b.seats.length > 0 ? (
                          b.seats.map(s => (
                            <span key={s.seatId} className="seat-badge">
                              {s.seatLabel}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Released</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--accent-blue)' }}>
                        ${b.totalAmount.toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <span className={`status-badge ${isConfirmed ? 'confirmed' : 'cancelled'}`}>
                        ● {b.bookingStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/confirmation/${b.id}`)}
                          title="View Ticket Details"
                        >
                          View
                        </button>
                        {isConfirmed && (
                          <button
                            className="btn btn-outline-danger btn-sm"
                            disabled={cancellingId === b.id}
                            onClick={() => handleCancelBooking(b.id)}
                            title="Cancel Booking & Release Seats"
                          >
                            {cancellingId === b.id ? 'Releasing...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
