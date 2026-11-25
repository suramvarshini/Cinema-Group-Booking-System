import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { api } from '../services/api';

export default function ConcurrencyTestPage() {
  const [showtimes, setShowtimes] = useState([]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(null);
  const [seatsMap, setSeatsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadSetup();
  }, []);

  const loadSetup = async () => {
    try {
      setLoading(true);
      const moviesData = await api.getMovies();
      const firstMovie = moviesData.movies?.[0];
      if (firstMovie && firstMovie.showtimes?.length > 0) {
        setShowtimes(firstMovie.showtimes);
        const stId = firstMovie.showtimes[0].id;
        setSelectedShowtimeId(stId);
        await loadSeatsForShowtime(stId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSeatsForShowtime = async (stId) => {
    try {
      const data = await api.getSeats(stId);
      const map = {};
      (data.seats || []).forEach(s => {
        map[s.seatLabel] = s.seatId;
      });
      setSeatsMap(map);
    } catch (err) {
      console.error(err);
    }
  };

  const addLog = (msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runRaceConditionSimulation = async () => {
    if (!selectedShowtimeId) return;

    setTesting(true);
    setTestResults(null);
    setLogs([]);

    addLog('⚡ Initializing Simultaneous Concurrency Race Condition Test...');
    addLog(`Target Showtime: #${selectedShowtimeId}`);
    addLog('Customer A requested seats: A1, A2, A3');
    addLog('Customer B requested seats: A2, A3, A4 (Overlap on A2, A3)');

    const seatA1 = seatsMap['A1'];
    const seatA2 = seatsMap['A2'];
    const seatA3 = seatsMap['A3'];
    const seatA4 = seatsMap['A4'];

    if (!seatA1 || !seatA2 || !seatA3 || !seatA4) {
      addLog('❌ Error: Seats A1-A4 could not be located for this showtime.');
      setTesting(false);
      return;
    }

    addLog('🚀 Firing both requests simultaneously via Promise.all()...');

    const startTime = performance.now();

    const requestA = axios.post('/api/bookings', {
      customerName: 'Customer A (Race Test)',
      customerEmail: 'alice.test@example.com',
      showtimeId: selectedShowtimeId,
      seatIds: [seatA1, seatA2, seatA3]
    }).then(r => ({ client: 'Customer A', status: r.status, data: r.data, error: null }))
      .catch(err => ({
        client: 'Customer A',
        status: err.response?.status || 500,
        data: err.response?.data || {},
        error: err.response?.data?.message || err.message
      }));

    const requestB = axios.post('/api/bookings', {
      customerName: 'Customer B (Race Test)',
      customerEmail: 'bob.test@example.com',
      showtimeId: selectedShowtimeId,
      seatIds: [seatA2, seatA3, seatA4]
    }).then(r => ({ client: 'Customer B', status: r.status, data: r.data, error: null }))
      .catch(err => ({
        client: 'Customer B',
        status: err.response?.status || 500,
        data: err.response?.data || {},
        error: err.response?.data?.message || err.message
      }));

    const [resA, resB] = await Promise.all([requestA, requestB]);
    const duration = (performance.now() - startTime).toFixed(1);

    addLog(`⏱️ Both requests resolved in ${duration}ms`);
    addLog(`Customer A -> HTTP ${resA.status} (${resA.status === 201 ? 'SUCCESS' : 'BLOCKED'})`);
    addLog(`Customer B -> HTTP ${resB.status} (${resB.status === 201 ? 'SUCCESS' : 'BLOCKED'})`);

    const statuses = [resA.status, resB.status].sort();
    const isSuccess = statuses[0] === 201 && statuses[1] === 409;

    if (isSuccess) {
      addLog('✅ MUTEX TEST VERIFIED: Exactly one request succeeded (201) and the conflicting request failed (409)!');
      addLog('Zero duplicate bookings occurred. Transaction rolled back with complete atomicity.');
    } else {
      addLog(`⚠️ Unexpected test outcome: statuses [${statuses.join(', ')}]`);
    }

    setTestResults({
      success: isSuccess,
      duration,
      resA,
      resB
    });

    setTesting(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚡ Live Mutex Concurrency Race Simulator</h1>
          <p className="page-subtitle">
            Demonstrates real-time PostgreSQL row-level locking (<code>SELECT FOR UPDATE</code>) when two customers overlap seats simultaneously.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem' }}>
        {/* Scenario Explanation Card */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--primary-navy)' }}>
            The Concurrency Problem Statement
          </h2>

          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            When two different customers select overlapping cinema seats at the exact same millisecond:
          </p>

          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <strong>Customer A:</strong> selects seats <span className="seat-badge">A1</span> <span className="seat-badge">A2</span> <span className="seat-badge">A3</span>
            </div>
            <div>
              <strong>Customer B:</strong> selects seats <span className="seat-badge">A2</span> <span className="seat-badge">A3</span> <span className="seat-badge">A4</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.5rem', fontWeight: 600 }}>
              Collision: Seats A2 and A3 overlap!
            </div>
          </div>

          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>How PostgreSQL Mutex Solves It:</h3>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            <li>Backend initiates an explicit database transaction with <code>BEGIN</code>.</li>
            <li>Row-level lock on showtime row is acquired via <code>SELECT FOR UPDATE</code>.</li>
            <li>Seat rows are locked in strict deterministic ascending order.</li>
            <li>The first request to obtain the lock completes its booking and updates seats to <code>BOOKED</code>.</li>
            <li>The competing request detects that seats are unavailable, triggers an instant <code>ROLLBACK</code>, and returns <code>HTTP 409 Conflict</code>.</li>
            <li>No duplicate booking and no partial seats (e.g. A4) are left orphaned!</li>
          </ul>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              disabled={testing || loading}
              onClick={runRaceConditionSimulation}
              style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}
            >
              {testing ? 'Executing Simultaneous Requests...' : '🚀 Simulate Race Condition Now'}
            </button>
          </div>
        </div>

        {/* Live Execution Logs & Results Card */}
        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--primary-navy)' }}>
            Execution Telemetry & Results
          </h2>

          {testResults && (
            <div
              className={`alert ${testResults.success ? 'alert-success' : 'alert-danger'}`}
              style={{ marginBottom: '1rem' }}
            >
              <div>
                <strong>{testResults.success ? '🎉 Mutex Test PASSED!' : '⚠️ Mutex Test FAILED'}</strong>
                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Total round-trip time: {testResults.duration}ms
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              backgroundColor: '#0a1128',
              color: '#38bdf8',
              padding: '1.25rem',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'Consolas, monospace',
              fontSize: '0.825rem',
              lineHeight: 1.5,
              flex: 1,
              minHeight: '280px',
              maxHeight: '400px',
              overflowY: 'auto'
            }}
          >
            {logs.length === 0 ? (
              <span style={{ color: '#64748b' }}>// Click "Simulate Race Condition Now" to execute live test...</span>
            ) : (
              logs.map((log, index) => <div key={index}>{log}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
