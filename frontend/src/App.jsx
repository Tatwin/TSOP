import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import DailyEntry from './pages/DailyEntry';
import InvoicePage from './pages/InvoicePage';
import Dashboard from './pages/Dashboard';
import ManageProducts from './pages/ManageProducts';
import Analytics from './pages/Analytics';
import Layout from './components/Layout';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <Layout>
              <DailyEntry />
            </Layout>
          } />
          <Route path="/invoice" element={
            <Layout>
              <InvoicePage />
            </Layout>
          } />
          <Route path="/dashboard" element={
            <Layout>
              <Dashboard />
            </Layout>
          } />
          <Route path="/manage-products" element={
            <Layout>
              <ManageProducts />
            </Layout>
          } />
          <Route path="/analytics" element={
            <Layout>
              <Analytics />
            </Layout>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
