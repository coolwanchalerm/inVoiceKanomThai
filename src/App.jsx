import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminApp from './AdminApp';
import OrderWizard from './components/CustomerOrder/OrderWizard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/order" element={<OrderWizard />} />
      </Routes>
    </BrowserRouter>
  );
}
