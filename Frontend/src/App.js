import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Help from './pages/Help';

function App() {
  // Dynamic basename for local dev vs GitHub Pages production
  const basename = process.env.NODE_ENV === 'production' 
    ? '/Glass-Defect-Detection-Prototype/' 
    : '/';

  return (
    <div>
      <Router basename={basename}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
