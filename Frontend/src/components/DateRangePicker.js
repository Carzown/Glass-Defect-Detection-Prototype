import React, { useState, useRef, useEffect } from 'react';
import './DateRangePicker.css';

const getBackendURL = () => {
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  if (window.location.hostname !== 'localhost') {
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

const BACKEND_URL = getBackendURL();

function DateRangePicker({ onApply, initialFrom = '', initialTo = '' }) {
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [preset, setPreset] = useState('30days');
  const [showDropdown, setShowDropdown] = useState(false);
  const [availableDates, setAvailableDates] = useState(new Set());
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Fetch available dates when dropdown opens or custom section is shown
  useEffect(() => {
    if (showDropdown && preset === 'custom') {
      fetchAvailableDates();
    }
  }, [showDropdown, preset]);

  const fetchAvailableDates = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/defects?limit=10000&offset=0`);
      if (!res.ok) return;
      const json = await res.json();
      const dates = new Set();
      if (json.data && Array.isArray(json.data)) {
        json.data.forEach((defect) => {
          if (defect.detected_at) {
            const dateStr = defect.detected_at.split('T')[0];
            dates.add(dateStr);
          }
        });
      }
      setAvailableDates(dates);
    } catch (error) {
      console.error('[DateRangePicker] Error fetching available dates:', error);
    }
  };

  const getPresetDates = (presetType) => {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (presetType) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case '7days':
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case '30days':
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        return null;
    }

    return {
      from: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
      to: end.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
    };
  };

  const handlePresetClick = (presetType) => {
    if (presetType === 'custom') {
      setPreset('custom');
      // Keep dropdown open for custom to show date inputs
      return;
    }
    setPreset(presetType);
    const dates = getPresetDates(presetType);
    if (dates) {
      setFromDate(dates.from);
      setToDate(dates.to);
      onApply({ from: dates.from, to: dates.to, preset: presetType });
      setShowDropdown(false);
    }
  };

  const handleApply = () => {
    if (fromDate && toDate) {
      onApply({ from: fromDate, to: toDate, preset });
      setShowDropdown(false);
    }
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const hasDataOnDate = (dateStr) => {
    return availableDates.has(dateStr);
  };

  const rangeDisplay = fromDate && toDate
    ? `${formatDisplayDate(fromDate)} — ${formatDisplayDate(toDate)}`
    : 'Select date range';

  return (
    <div className="drp-container" ref={containerRef}>
      <div
        className="drp-trigger"
        onClick={() => setShowDropdown(!showDropdown)}
        title={rangeDisplay}
      >
        📅 {rangeDisplay}
      </div>

      {showDropdown && (
        <div className="drp-dropdown">
          {/* Presets List */}
          <div className="drp-presets-list">
            <button
              className={`drp-preset-option ${preset === 'today' ? 'active' : ''}`}
              onClick={() => handlePresetClick('today')}
            >
              Today
            </button>
            <button
              className={`drp-preset-option ${preset === '7days' ? 'active' : ''}`}
              onClick={() => handlePresetClick('7days')}
            >
              Last 7 days
            </button>
            <button
              className={`drp-preset-option ${preset === '30days' ? 'active' : ''}`}
              onClick={() => handlePresetClick('30days')}
            >
              Last 30 days
            </button>
            <div className="drp-divider" />
            <button
              className={`drp-preset-option ${preset === 'custom' ? 'active' : ''}`}
              onClick={() => handlePresetClick('custom')}
            >
              Custom Range
            </button>
          </div>

          {/* Custom Date Range Section - Only show when custom is selected */}
          {preset === 'custom' && (
            <div className="drp-custom-section">
              <div className="drp-range-display">
                <div className="drp-input-group">
                  <label>From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="drp-input"
                  />
                </div>
                <div className="drp-arrow">→</div>
                <div className="drp-input-group">
                  <label>To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="drp-input"
                  />
                </div>
              </div>

              {/* Calendar Preview */}
              <div className="drp-calendar-preview">
                {fromDate && (
                  <div className="drp-month">
                    <div className="drp-month-name">
                      {new Date(fromDate + 'T00:00:00').toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                      })}
                    </div>
                    <div className="drp-selected-date">
                      {new Date(fromDate + 'T00:00:00').toLocaleDateString('en-US', {
                        day: 'numeric',
                      })}
                    </div>
                    {hasDataOnDate(fromDate) && <div className="drp-data-indicator" title="Data available">●</div>}
                  </div>
                )}
                <div className="drp-range-line" />
                {toDate && (
                  <div className="drp-month">
                    <div className="drp-month-name">
                      {new Date(toDate + 'T00:00:00').toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                      })}
                    </div>
                    <div className="drp-selected-date">
                      {new Date(toDate + 'T00:00:00').toLocaleDateString('en-US', {
                        day: 'numeric',
                      })}
                    </div>
                    {hasDataOnDate(toDate) && <div className="drp-data-indicator" title="Data available">●</div>}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="drp-footer">
                <button
                  className="drp-btn drp-btn-cancel"
                  onClick={() => setShowDropdown(false)}
                >
                  Cancel
                </button>
                <button
                  className="drp-btn drp-btn-apply"
                  onClick={handleApply}
                  disabled={!fromDate || !toDate}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;
