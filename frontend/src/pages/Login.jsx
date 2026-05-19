import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, authenticated } = useAuth();
  const navigate = useNavigate();
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    if (authenticated) navigate('/', { replace: true });
  }, [authenticated, navigate]);

  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (index === 3 && value) {
      const fullPin = [...newPin.slice(0, 3), value.slice(-1)].join('');
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleSubmit = async (pinStr) => {
    const fullPin = pinStr || pin.join('');
    if (fullPin.length !== 4) return;
    setLoading(true);
    try {
      await login(fullPin);
      navigate('/', { replace: true });
    } catch (err) {
      setError('Invalid PIN');
      setPin(['', '', '', '']);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e1e2d 0%, #2d2d44 50%, #1e1e2d 100%)', padding: 20
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '48px 40px',
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #3699ff, #7239ea)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', color: 'white', fontWeight: 800
        }}>
          T
        </div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#181c32', marginBottom: 4 }}>TASMAC POS</h1>
        <p style={{ color: '#a1a5b7', fontSize: '0.85rem', marginBottom: 32 }}>
          Shop No. 1745 • Alandurai, Coimbatore
        </p>

        <p style={{ fontSize: '0.9rem', color: '#5e6278', marginBottom: 24, fontWeight: 500 }}>
          Enter 4-digit PIN to unlock editing
        </p>

        {/* PIN Inputs */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          {pin.map((digit, idx) => (
            <input
              key={idx}
              ref={inputRefs[idx]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(idx, e.target.value)}
              onKeyDown={e => handleKeyDown(idx, e)}
              style={{
                width: 56, height: 64, textAlign: 'center', fontSize: '1.8rem', fontWeight: 700,
                borderRadius: 12, border: `2px solid ${error ? '#f1416c' : digit ? '#3699ff' : '#e4e6ef'}`,
                background: digit ? '#f1faff' : '#f9fafb',
                outline: 'none', transition: 'all 0.2s',
                color: '#181c32'
              }}
            />
          ))}
        </div>

        {error && (
          <p style={{ color: '#f1416c', fontWeight: 600, fontSize: '0.85rem', marginBottom: 16 }}>{error}</p>
        )}

        {loading && (
          <p style={{ color: '#3699ff', fontSize: '0.85rem' }}>Verifying...</p>
        )}

        <div style={{ marginTop: 32, padding: '16px', background: '#f9fafb', borderRadius: 8 }}>
          <p style={{ fontSize: '0.75rem', color: '#a1a5b7' }}>
            PIN is only needed for saving/editing data.<br/>
            Viewing and exporting does not require PIN.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: 16, padding: '10px 20px', background: 'transparent',
            border: 'none', color: '#3699ff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
          }}
        >
          ← Continue without PIN (view only)
        </button>
      </div>
    </div>
  );
}
