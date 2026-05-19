import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tasmac_token'));
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token
      api.get('/auth/me')
        .then(res => {
          setUser(res.data.user);
          setAuthenticated(true);
          setLoading(false);
        })
        .catch(() => {
          // Token expired or invalid - clear it but allow viewing
          logout();
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (pin) => {
    const res = await api.post('/auth/login', { pin });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('tasmac_token', newToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    setAuthenticated(true);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('tasmac_token');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, authenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
