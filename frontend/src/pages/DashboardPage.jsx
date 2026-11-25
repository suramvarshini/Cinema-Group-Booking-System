import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboardStats();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.2rem' }}>Loading Cinema Dashboard...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentBookings = data?.recentBookings || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cinema Overview Dashboard</h1>
          <p className="page-subtitle">
            Real-time cinema operational metrics and database synchronization status.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadDashboard}>
            🔄 Refresh Metrics
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>
            🍿 View Movies
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">Total Movies</div>
          <div className="stat-value">{stats.totalMovies || 0}</div>
          <div className="stat-footer">Active in catalogue</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Total Bookings</div>
          <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>
            {stats.totalBookings || 0}
          </div>
          <div className="stat-footer">
            {stats.activeBookings || 0} confirmed • {stats.cancelledBookings || 0} cancelled
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Available Seats</div>
          <div className="stat-value" style={{ color: 'var(--seat-available)' }}>
            {stats.availableSeats || 0}
          </div>
          <div className="stat-footer">Across all scheduled showtimes</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Booked Seats</div>
          <div className="stat-value" style={{ color: '#e11d48' }}>
            {stats.bookedSeats || 0}
          </div>
          <div className="stat-footer">Safely locked & assigned</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">Total Revenue</div>
          <div className="stat-value" style={{ color: '#047857' }}>
            ${(stats.totalRevenue || 0).toFixed(2)}
          </div>
          <div className="stat-footer">From confirmed reservations</div>
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Recent Cinema Bookings</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/my-bookings')}>
            View All ({stats.totalBookings || 0}) →
          </button>
        </div>

        {recentBookings.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            No bookings recorded yet.
          </p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref #</th>
                  <th>Movie</th>
                  <th>Customer</th>
                  <th>Showtime</th>
                  <th>Seats</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map(b => (
                  <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/confirmation/${b.id}`)}>
                    <td>
                      <strong>#{b.id}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{b.movieTitle}</span>
                    </td>
                    <td>{b.customerName}</td>
                    <td>
                      {b.showTime} ({new Date(b.showDate).toLocaleDateString()})
                    </td>
                    <td>
                      <span className="seat-badge">{b.seats || 'None'}</span>
                    </td>
                    <td>
                      <strong>${b.totalAmount.toFixed(2)}</strong>
                    </td>
                    <td>
                      <span className={`status-badge ${b.bookingStatus === 'CONFIRMED' ? 'confirmed' : 'cancelled'}`}>
                        ● {b.bookingStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
