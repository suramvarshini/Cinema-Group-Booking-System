import React from 'react';

export default function SeatGrid({ rows, selectedSeatIds, onToggleSeat }) {
  const rowKeys = Object.keys(rows || {}).sort();

  return (
    <div>
      {/* Curved Screen Banner */}
      <div className="theatre-screen-wrap">
        <div className="theatre-screen"></div>
        <div className="theatre-screen-label">🎬 Cinema Screen — All Eyes Here 🎬</div>
      </div>

      {/* Seat Color Legend */}
      <div className="seat-legend">
        <div className="legend-item">
          <div className="legend-swatch available"></div>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch selected"></div>
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <div className="legend-swatch booked"></div>
          <span>Booked</span>
        </div>
      </div>

      {/* Seat Matrix */}
      <div className="seat-grid-container">
        {rowKeys.map(rowLetter => {
          const seatList = rows[rowLetter] || [];
          return (
            <div key={rowLetter} className="seat-row">
              <span className="row-label">{rowLetter}</span>
              {seatList.map(seat => {
                const isSelected = selectedSeatIds.includes(seat.seatId);
                const isBooked = seat.status === 'BOOKED';

                let stateClass = 'available';
                if (isBooked) stateClass = 'booked';
                else if (isSelected) stateClass = 'selected';

                return (
                  <button
                    key={seat.seatId}
                    type="button"
                    disabled={isBooked}
                    className={`seat-item ${stateClass}`}
                    onClick={() => !isBooked && onToggleSeat(seat)}
                    title={`Seat ${seat.seatLabel} (${seat.status})`}
                  >
                    {seat.seatNumber}
                  </button>
                );
              })}
              <span className="row-label">{rowLetter}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
