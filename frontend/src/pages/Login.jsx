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

  // Redirect if already authenticated
  useEffect(() => {
    if (authenticated) {
      navigate('/', { replace: true });
    }
  }, [authenticated, navigate]);

  useEffect(() => {
    // Auto-focus first input
    if (inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, []);

  const handleChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    // Auto-advance to next input
    if (value && index < 3) {
      inputRefs[index + 1].current.focus();
    }

    // Auto-submit when all 4 digits entered
    if (value && index === 3) {
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handleSubmit = async (fullPin) => {
    if (!fullPin) fullPin = pin.join('');
    if (fullPin.length !== 4) {
      setError('Please enter 4-digit PIN');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(fullPin);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid PIN. Please try again.');
      setPin(['', '', '', '']);
      inputRefs[0].current.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a237e 0%, #534bae 100%)',
      padding: '16px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '1.5rem', color: '#1a237e', marginBottom: '8px' }}>
            TASMAC POS
          </h1>
          <p style={{ color: '#757575', fontSize: '0.9rem' }}>
            Shop No. 1745 - Alandurai, Coimbatore
          </p>
          <p style={{ color: '#9e9e9e', fontSize: '0.8rem', marginTop: '4px' }}>
            Owner: ANTONYSAMY.A
          </p>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <p style={{ fontSize: '1rem', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
            Enter PIN to Edit/Save
          </p>
          <p style={{ fontSize: '0.8rem', color: '#757575' }}>
            PIN required only for editing. Viewing is free.
          </p>
        </div>

        {error && (
          <div style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* PIN Input Boxes */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={loading}
              style={{
                width: '56px',
                height: '64px',
                textAlign: 'center',
                fontSize: '1.8rem',
                fontWeight: '700',
                borderRadius: '12px',
                border: `2px solid ${error ? '#c62828' : digit ? '#1a237e' : '#e0e0e0'}`,
                outline: 'none',
                transition: 'border-color 0.2s',
                color: '#1a237e'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1a237e'}
              onBlur={(e) => { if (!digit) e.target.style.borderColor = '#e0e0e0'; }}
            />
          ))}
        </div>

        <button
          onClick={() => handleSubmit()}
          disabled={loading || pin.join('').length !== 4}
          className="btn-primary btn-large"
          style={{ 
            width: '100%', 
            opacity: (loading || pin.join('').length !== 4) ? 0.7 : 1,
            padding: '14px',
            fontSize: '1.1rem'
          }}
        >
          {loading ? 'Verifying...' : 'Unlock'}
        </button>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#757575',
              fontSize: '0.85rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Continue without PIN (View Only)
          </button>
        </div>
      </div>
    </div>
  );
}
