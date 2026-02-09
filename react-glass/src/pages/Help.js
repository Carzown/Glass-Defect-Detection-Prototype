import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { signOutUser } from '../supabase';
import './Dashboard.css';

function Help() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      // Sign out from Supabase
      await signOutUser();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear session storage
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('userId');
    
    // If "Remember me" is not enabled, clear the email too
    const remembered = localStorage.getItem('rememberMe') === 'true';
    if (!remembered) {
      localStorage.removeItem('email');
    }
    
    navigate('/');
  }

  return (
    <div className="machine-container">
      <Sidebar
        onLogout={handleLogout}
        mainItems={[
          { key: 'dashboard', label: 'Dashboard', onClick: () => navigate('/dashboard') },
          { key: 'help', label: 'Help', onClick: () => navigate('/help') },
        ]}
        bottomItems={[]}
        activeKey="help"
      />
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <h1>Help & Documentation</h1>
        
        <section style={{ marginTop: '20px' }}>
          <h2>Getting Started</h2>
          <p>
            Welcome to the Glass Defect Detection System. This application allows you to monitor 
            and track glass defects in real-time using a Jetson-based inference engine.
          </p>
        </section>

        <section style={{ marginTop: '20px' }}>
          <h2>Features</h2>
          <ul>
            <li><strong>Live Detection:</strong> Real-time glass defect detection with live video feed</li>
            <li><strong>Defect Tracking:</strong> Detailed information about detected defects including location and type</li>
            <li><strong>Session Management:</strong> Track defects during detection sessions</li>
            <li><strong>Role-Based Access:</strong> Different permissions for Admin and Employee roles</li>
          </ul>
        </section>

        <section style={{ marginTop: '20px' }}>
          <h2>Dashboard Guide</h2>
          <h3>Start Detection</h3>
          <p>
            Click the "Start Detection" button to begin monitoring for glass defects. 
            The system will connect to the Jetson device and start streaming video.
          </p>
          
          <h3>Pause/Resume</h3>
          <p>
            Use the Pause button to temporarily halt defect detection without stopping the video stream.
            Click Resume to continue detecting defects.
          </p>
          
          <h3>Defect List</h3>
          <p>
            The defect list shows all detected defects in the current session with:
            <ul>
              <li>Defect type and confidence score</li>
              <li>Bounding box coordinates</li>
              <li>Timestamp of detection</li>
            </ul>
          </p>
          
          <h3>Export Data</h3>
          <p>
            Export options (CSV import/export) were removed from the dashboard. Use the Supabase dashboard or API to export defect data if needed.
          </p>
        </section>

        <section style={{ marginTop: '20px' }}>
          <h2>Admin Features</h2>
          <p>
            Admins have access to user management features including:
          </p>
          <ul>
            <li>View all users and their roles</li>
            <li>Manage user passwords</li>
            <li>Control system settings</li>
          </ul>
        </section>

        <section style={{ marginTop: '20px' }}>
          <h2>Troubleshooting</h2>
          <h3>Cannot Connect to Device</h3>
          <p>
            Ensure the Jetson device is powered on and connected to the network.
            Verify the backend server is running on port 5000.
          </p>
          
          <h3>No Video Feed</h3>
          <p>
            Check that the camera is properly connected to the Jetson device.
            Verify camera permissions are enabled.
          </p>
          
          <h3>Authentication Issues</h3>
          <p>
            Clear your browser cache and try logging in again.
            Ensure you are using the correct email and password.
          </p>
        </section>

        <section style={{ marginTop: '20px' }}>
          <h2>Contact Support</h2>
          <p>
            For additional help or to report issues, please contact the system administrator.
          </p>
        </section>

        <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Glass Defect Detection System v1.0 | Powered by Supabase Authentication
          </p>
        </div>
      </div>
    </div>
  );
}

export default Help;
