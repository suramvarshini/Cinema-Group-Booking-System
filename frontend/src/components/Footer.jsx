import React from 'react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <strong>Cinema Group Ticket Booking System</strong> — High-Performance Concurrency Protected
        </div>
        <div>
          Powered by Node.js, Express, React & PostgreSQL Row-Level Mutex Locking (<code>SELECT FOR UPDATE</code>)
        </div>
      </div>
    </footer>
  );
}
