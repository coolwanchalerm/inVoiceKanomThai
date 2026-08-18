import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminApp from './AdminApp';
import OrderWizard from './components/CustomerOrder/OrderWizard';
import { AuthPinProvider, useAuthPin } from './context/AuthPinContext';
import PinLockScreen from './components/PinLockScreen';

function AppRoutes() {
  const { isUnlocked } = useAuthPin();

  if (!isUnlocked) {
    return <PinLockScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AdminApp />} />
        <Route path="/order" element={<OrderWizard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthPinProvider>
      <AppRoutes />
    </AuthPinProvider>
  );
}
