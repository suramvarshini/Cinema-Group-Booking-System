import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <NavLink to="/" className="nav-brand">
          <span style={{ fontSize: '1.6rem' }}>🍿</span>
          <span>Cinema Booking System</span>
          <span className="brand-badge">Mutex Protected</span>
        </NavLink>

        <ul className="nav-links">
          <li>
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              Home / Movies
            </NavLink>
          </li>
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/my-bookings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              My Bookings
            </NavLink>
          </li>
          <li>
            <NavLink to="/concurrency-test" className={({ isActive }) => `nav-link test-tab ${isActive ? 'active' : ''}`}>
              ⚡ Mutex Race Simulator
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  );
}
