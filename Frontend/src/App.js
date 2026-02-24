import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Detection from './pages/Detection';
import DetectionHistory from './pages/DetectionHistory';
import Help from './pages/Help';
import HowToUse from './pages/HowToUse';
import AdminDashboard from './pages/AdminDashboard';
import AdminDetection from './pages/AdminDetection';
import AdminDetectionHistory from './pages/AdminDetectionHistory';
import AdminHowToUse from './pages/AdminHowToUse';

function App() {
  // GitHub Pages requires basename in production
  const basename = process.env.NODE_ENV === 'production' 
    ? '/Glass-Defect-Detection-Prototype/' 
    : '/';

  return (
    <div>
      <Router basename={basename}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/detection" element={<Detection />} />
          <Route path="/detection-history" element={<DetectionHistory />} />
          <Route path="/help" element={<Help />} />
          <Route path="/how-to-use" element={<HowToUse />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin-detection" element={<AdminDetection />} />
          <Route path="/admin-detection-history" element={<AdminDetectionHistory />} />
          <Route path="/admin-how-to-use" element={<AdminHowToUse />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
