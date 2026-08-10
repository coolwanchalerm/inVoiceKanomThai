import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminApp from './AdminApp';
import OrderWizard from './components/CustomerOrder/OrderWizard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AdminApp />} />
        <Route path="/order" element={<OrderWizard />} />
      </Routes>
    </BrowserRouter>
  );
}
