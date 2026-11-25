import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function MovieDetailsPage() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMovieDetails();
  }, [movieId]);

  const loadMovieDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const [movieData, showtimesData] = await Promise.all([
        api.getMovieById(movieId),
        api.getShowtimes(movieId)
      ]);
      setMovie(movieData.movie);
      setShowtimes(showtimesData.showtimes || []);
      if (showtimesData.showtimes && showtimesData.showtimes.length > 0) {
        setSelectedShowtimeId(showtimesData.showtimes[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load movie details.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedShowtimeId) return;
    navigate(`/book/${selectedShowtimeId}`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.2rem' }}>Loading movie details...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div>
        <div className="alert alert-danger">
          <span>⚠️ {error || 'Movie not found.'}</span>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Back to Movies
        </button>
      </div>
    );
  }

  const selectedShowtime = showtimes.find(st => st.id === selectedShowtimeId);

  return (
    <div>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => navigate('/')}
        style={{ marginBottom: '1.5rem' }}
      >
        ← Back to Movies
      </button>

      <div className="card" style={{ padding: '2rem', display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 280px', maxWidth: '320px' }}>
          <img
            src={movie.image_url}
            alt={movie.title}
            style={{ width: '100%', borderRadius: 'var(--radius-md)', objectFit: 'cover', boxShadow: 'var(--shadow-md)' }}
          />
        </div>

        <div style={{ flex: '1 1 400px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h1 className="page-title">{movie.title}</h1>
            <span className="movie-duration-badge" style={{ position: 'static' }}>
              ⏱️ {movie.duration} min
            </span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            {movie.description}
          </p>

          <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--primary-navy)' }}>
            Available Showtimes
          </h3>

          {showtimes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No showtimes currently scheduled for this movie.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {showtimes.map(st => {
                  const isSelected = st.id === selectedShowtimeId;
                  const formattedDate = new Date(st.showDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <div
                      key={st.id}
                      onClick={() => setSelectedShowtimeId(st.id)}
                      style={{
                        border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--border-light)',
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.2)' : 'none'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary-navy)' }}>
                        {st.showTime}
                      </div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
                        📅 {formattedDate}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
                          ${st.ticketPrice.toFixed(2)}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: st.availableSeats > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {st.availableSeats} seats left
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedShowtime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '1.5rem' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}
                onClick={handleContinue}
              >
                Continue to Seat Selection →
              </button>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Selected: <strong>{selectedShowtime.showTime}</strong> (${selectedShowtime.ticketPrice.toFixed(2)} / ticket)
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
