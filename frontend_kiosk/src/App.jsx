import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import CameraView from './pages/CameraView';
import PortalPage from './pages/PortalPage';

function App() {
  return (
    <Router>
      <div className="flex h-screen w-full bg-[#0a0b0d] text-[#f8fafc] overflow-hidden">
        <Navigation />
        <Routes>
          <Route path="/" element={<CameraView />} />
          <Route path="/portal" element={<PortalPage />} />
        </Routes>
      </div>
    </Router>
  );
}
export default App;
