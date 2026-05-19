import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ToastNotification';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './pages/Login';
import DailyEntry from './pages/DailyEntry';
import InvoicePage from './pages/InvoicePage';
import Dashboard from './pages/Dashboard';
import ManageProducts from './pages/ManageProducts';
import Analytics from './pages/Analytics';
import ActivityLogs from './pages/ActivityLogs';
import BackupRestore from './pages/BackupRestore';
import Layout from './components/Layout';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
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
              <Route path="/activity-logs" element={
                <Layout>
                  <ActivityLogs />
                </Layout>
              } />
              <Route path="/backup" element={
                <Layout>
                  <BackupRestore />
                </Layout>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
