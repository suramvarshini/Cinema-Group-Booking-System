import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadMovies();
  }, []);

  const loadMovies = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMovies();
      setMovies(data.movies || []);
    } catch (err) {
      setError(err.message || 'Failed to load movie catalog.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Now Showing</h1>
          <p className="page-subtitle">
            Select a movie and book multiple adjacent seats safely with real backend Mutex synchronization.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadMovies}>
          🔄 Refresh Movies
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Loading cinema movies...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <span>⚠️ {error}</span>
          <button className="btn btn-secondary btn-sm" onClick={loadMovies} style={{ marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && movies.length === 0 && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p>No movies currently scheduled. Please check back later.</p>
        </div>
      )}

      {!loading && !error && movies.length > 0 && (
        <div className="movies-grid">
          {movies.map(movie => {
            const firstShowtime = movie.showtimes?.[0];

            return (
              <div key={movie.id} className="card movie-card">
                <div className="movie-poster-wrap">
                  <img
                    src={movie.image_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80'}
                    alt={movie.title}
                    className="movie-poster"
                  />
                  <div className="movie-duration-badge">⏱️ {movie.duration} min</div>
                </div>

                <div className="movie-card-content">
                  <h3 className="movie-card-title">{movie.title}</h3>
                  <p className="movie-card-desc">{movie.description}</p>

                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      Today's Showtimes:
                    </div>
                    <div className="showtime-pills">
                      {movie.showtimes && movie.showtimes.length > 0 ? (
                        movie.showtimes.slice(0, 3).map(st => (
                          <button
                            key={st.id}
                            className="showtime-pill"
                            onClick={() => navigate(`/book/${st.id}`)}
                            title={`Book for ${st.showTime} ($${parseFloat(st.ticketPrice).toFixed(2)})`}
                          >
                            {st.showTime}
                          </button>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No showtimes today</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={() => {
                          if (firstShowtime) {
                            navigate(`/book/${firstShowtime.id}`);
                          } else {
                            navigate(`/movie/${movie.id}`);
                          }
                        }}
                      >
                        Book Now
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/movie/${movie.id}`)}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
