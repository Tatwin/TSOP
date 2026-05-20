import React, { useState, useEffect, useMemo } from 'react';
import { CATEGORIES } from '../data/products';
import api from '../utils/api';

function formatINR(num) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
}

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [holidays, setHolidays] = useState({});
  const [salesData, setSalesData] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showMarkHoliday, setShowMarkHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState('Government Holiday');
  const [message, setMessage] = useState('');

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Load holidays and sales data for the current month
  useEffect(() => {
    loadMonthData();
  }, [year, month]);

  const loadMonthData = async () => {
    setLoading(true);
    try {
      const monthStr = String(month + 1).padStart(2, '0');
      const startDate = `${year}-${monthStr}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const [holidayRes, salesRes] = await Promise.all([
        api.get(`/holidays/${year}/${monthStr}`),
        api.get(`/daily-entry/range/${startDate}/${endDate}`)
      ]);

      setHolidays(holidayRes.data.holidays || {});

      // Extract total sales for each day
      const dailySales = {};
      const data = salesRes.data.data || {};
      Object.entries(data).forEach(([date, dayData]) => {
        if (dayData?.entries?.length > 0) {
          let total = 0;
          dayData.entries.forEach(entry => {
            const caseSize = CATEGORIES[entry.category]?.bottlesPerCase || 48;
            const sales = (entry.openingStock || 0) + (entry.purchase || 0) - (entry.stockReturn || 0) -
              ((entry.cases || 0) * caseSize + (entry.bottles || 0));
            total += Math.max(0, sales) * (entry.rate || 0);
          });
          dailySales[date] = total;
        }
      });
      setSalesData(dailySales);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    }
    setLoading(false);
  };

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [year, month]);

  const getDateStr = (day) => {
    if (!day) return '';
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isToday = (day) => {
    if (!day) return false;
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isFutureDate = (day) => {
    if (!day) return false;
    const d = new Date(year, month, day);
    return d > today;
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const dateStr = getDateStr(day);
    setSelectedDate(dateStr);
    setShowMarkHoliday(false);
  };

  const handleMarkHoliday = async () => {
    if (!selectedDate) return;
    if (!window.confirm(`Mark ${selectedDate} as a holiday?\n\nReason: ${holidayReason}\n\nThe previous working day's closing stock will automatically carry forward to the next working day.`)) return;

    try {
      await api.post('/holidays', { date: selectedDate, reason: holidayReason });
      setHolidays(prev => ({
        ...prev,
        [selectedDate]: { reason: holidayReason, markedAt: new Date().toISOString() }
      }));
      setShowMarkHoliday(false);
      setHolidayReason('Government Holiday');
      showMsg('Holiday marked successfully');
    } catch (err) {
      if (err.response?.status === 409) {
        showMsg('This date is already a holiday');
      } else {
        showMsg('Failed to mark holiday');
      }
    }
  };

  const handleRemoveHoliday = async () => {
    if (!selectedDate) return;
    if (!window.confirm(`Remove holiday marking for ${selectedDate}?`)) return;

    try {
      await api.delete(`/holidays/${selectedDate}`);
      setHolidays(prev => {
        const updated = { ...prev };
        delete updated[selectedDate];
        return updated;
      });
      showMsg('Holiday removed');
    } catch {
      showMsg('Failed to remove holiday');
    }
  };

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // Monthly totals
  const monthlyTotal = useMemo(() => {
    return Object.values(salesData).reduce((sum, val) => sum + val, 0);
  }, [salesData]);

  const workingDays = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = getDateStr(d);
      if (!holidays[dateStr] && salesData[dateStr]) count++;
    }
    return count;
  }, [salesData, holidays, year, month]);

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-dark)', margin: 0 }}>Sales Calendar</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#E8F5E9', border: '1px solid #0E6633', display: 'inline-block' }}></span>
            <span>Sales Day</span>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#FEE2E2', border: '1px solid #D92426', display: 'inline-block', marginLeft: 8 }}></span>
            <span>Holiday</span>
          </div>
        </div>
      </div>

      {message && (
        <div style={{ padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', background: '#E8F5E9', color: '#0E6633', fontWeight: '600' }}>
          {message}
        </div>
      )}

      {/* Monthly summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Monthly Sales</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{'\u20B9'}{formatINR(monthlyTotal)}</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Working Days</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)' }}>{workingDays}</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Holidays</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#D92426' }}>{Object.keys(holidays).length}</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Avg/Day</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)' }}>{'\u20B9'}{workingDays > 0 ? formatINR(monthlyTotal / workingDays) : '0'}</div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={prevMonth} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>&larr;</button>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-dark)' }}>{monthNames[month]} {year}</h3>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={goToToday} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--primary)', background: 'white', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Today</button>
          <button onClick={nextMonth} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>&rarr;</button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card" style={{ padding: '12px', overflow: 'auto' }}>
        {loading && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading...</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {/* Day headers */}
          {dayNames.map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 700, fontSize: '0.75rem', color: d === 'Sun' ? '#D92426' : 'var(--text-muted)', borderBottom: '2px solid #F4F6F4' }}>
              {d}
            </div>
          ))}

          {/* Calendar cells */}
          {calendarDays.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} style={{ minHeight: 70 }}></div>;

            const dateStr = getDateStr(day);
            const isHoliday = !!holidays[dateStr];
            const hasSales = !!salesData[dateStr];
            const isTodayCell = isToday(day);
            const isFuture = isFutureDate(day);
            const isSelected = selectedDate === dateStr;
            const isSunday = new Date(year, month, day).getDay() === 0;

            let bgColor = 'white';
            let borderColor = 'transparent';
            if (isHoliday) { bgColor = '#FEE2E2'; borderColor = '#D92426'; }
            else if (hasSales) { bgColor = '#E8F5E9'; borderColor = '#0E6633'; }
            if (isSelected) { borderColor = '#1E291E'; }
            if (isTodayCell) { borderColor = 'var(--primary)'; }

            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                style={{
                  minHeight: 70,
                  padding: '6px',
                  borderRadius: 8,
                  background: bgColor,
                  border: `2px solid ${borderColor}`,
                  cursor: 'pointer',
                  opacity: isFuture ? 0.4 : 1,
                  position: 'relative',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.85rem', fontWeight: isTodayCell ? 800 : 600,
                    color: isHoliday ? '#D92426' : isSunday ? '#D92426' : 'var(--text-dark)',
                    background: isTodayCell ? 'var(--primary)' : 'transparent',
                    color: isTodayCell ? 'white' : isHoliday ? '#D92426' : isSunday ? '#D92426' : 'var(--text-dark)',
                    borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {day}
                  </span>
                </div>
                {isHoliday && (
                  <div style={{ fontSize: '0.6rem', color: '#D92426', fontWeight: 600, marginTop: 2, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {holidays[dateStr].reason}
                  </div>
                )}
                {hasSales && !isHoliday && (
                  <div style={{ fontSize: '0.65rem', color: '#0E6633', fontWeight: 700, marginTop: 4 }}>
                    {'\u20B9'}{formatINR(salesData[dateStr])}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail Panel */}
      {selectedDate && (
        <div className="card" style={{ padding: '16px', marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-dark)' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              {holidays[selectedDate] && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: '#FEE2E2', color: '#D92426', padding: '3px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600 }}>
                    Holiday
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{holidays[selectedDate].reason}</span>
                </div>
              )}
              {salesData[selectedDate] && !holidays[selectedDate] && (
                <div style={{ marginTop: 6, fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>
                  Total Sales: {'\u20B9'}{formatINR(salesData[selectedDate])}
                </div>
              )}
              {!salesData[selectedDate] && !holidays[selectedDate] && !isFutureDate(parseInt(selectedDate.split('-')[2])) && (
                <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--text-muted)' }}>No sales data recorded</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {holidays[selectedDate] ? (
                <button onClick={handleRemoveHoliday}
                  style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#FEE2E2', color: '#D92426', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                  Remove Holiday
                </button>
              ) : (
                <button onClick={() => setShowMarkHoliday(!showMarkHoliday)}
                  style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#D92426', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                  Mark as Holiday
                </button>
              )}
            </div>
          </div>

          {/* Mark Holiday Form */}
          {showMarkHoliday && !holidays[selectedDate] && (
            <div style={{ marginTop: '16px', padding: '12px 16px', background: '#F4F6F4', borderRadius: 8 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: 6 }}>Holiday Reason</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={holidayReason}
                  onChange={(e) => setHolidayReason(e.target.value)}
                  placeholder="e.g. Republic Day, Pongal"
                  style={{ flex: '1 1 200px', padding: '10px', borderRadius: 6, border: '1px solid #ddd' }}
                />
                <button onClick={handleMarkHoliday}
                  style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: '#D92426', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                  Confirm Holiday
                </button>
                <button onClick={() => setShowMarkHoliday(false)}
                  style={{ padding: '10px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: 'var(--text-gray)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
                Marking a holiday means the previous working day's closing stock will carry forward as opening stock to the next working day.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
