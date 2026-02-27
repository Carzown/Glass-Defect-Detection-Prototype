import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './Dashboard.css';

function AdminHowToUse() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState(0);

  const instructions = [
    { section: 'Setup', steps: [
      'Connect the prototype to a power source and ensure the power plug is properly inserted.',
      'Press the power button to turn on the system.',
      'Activate the lighting system and adjust the brightness to its maximum level using the PWM button.',
      'Carefully place the glass onto the designated platform.',
    ]},
    { section: 'Operation', steps: [
      'Launch the web application.',
      'Execute the appropriate command to initiate the inspection process.',
      'View and navigate the results displayed on the LCD screen.',
      'Verify that the inspection results have been properly recorded in the web application.',
      'Carefully remove the glass from the platform.',
    ]},
    { section: 'Shutdown', steps: [
      'After completing the navigation and verification process, close the web application.',
      'Shut down the system following the proper procedure.',
      'Turn off the lighting system using the PWM button.',
      'Power off the prototype by pressing the main power button.',
      'Disconnect the prototype from the power source.',
    ]},
  ];

  const allSteps = instructions.flatMap((group, groupIdx) => 
    group.steps.map((step, stepIdx) => ({
      ...group,
      step,
      globalIdx: groupIdx * 5 + stepIdx + 1,
      stepIdx,
    }))
  );

  // Check if admin is authenticated
  useEffect(() => {
    const adminLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    const adminToken = sessionStorage.getItem('adminToken');
    if (!adminLoggedIn && !adminToken) {
      navigate('/');
    }
  }, [navigate]);

  function handleLogout() {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem('userId');
    navigate('/');
  }

  return (
    <div className="machine-container">
      <Sidebar
        onLogout={handleLogout}
        mainItems={[
          { key: 'admin-dashboard', label: 'Dashboard', onClick: () => navigate('/admin-dashboard') },
          { key: 'admin-detection', label: 'Detection', onClick: () => navigate('/admin-detection') },
          { key: 'admin-detection-history', label: 'Detection History', onClick: () => navigate('/admin-detection-history') },
        ]}
        bottomItems={[
          { key: 'admin-how-to-use', label: 'How to Use', onClick: () => navigate('/admin-how-to-use') },
        ]}
        activeKey="admin-how-to-use"
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />
      <main className="machine-main-content">
        <header className="machine-header">
          <button className="sidebar-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="machine-header-left">
            <h1 className="machine-header-title">How to Use</h1>
            <p className="machine-header-subtitle">Guide for glass defect monitoring</p>
          </div>
        </header>
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#f8fafb', display: 'flex', gap: '24px' }}>
          {/* Left Column - Title Box Only */}
          <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: 'fit-content' }}>
            {/* Title Section */}
            <div style={{ padding: '28px 20px', background: 'linear-gradient(135deg, #0f2942 0%, #1a3a52 100%)', borderBottom: '3px solid #e5a445' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#fff', lineHeight: '1.6', letterSpacing: '0.3px' }}>
                INSTRUCTIONS FOR FLAT GLASS DEFECT DETECTION DEVICE
              </h3>
            </div>
          </div>

          {/* Right Column - All Numbered Instructions */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%', 
            }}>
              {/* Instructions List */}
              <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allSteps.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedStep(idx)}
                      style={{
                        display: 'flex',
                        gap: '14px',
                        padding: '12px 14px',
                        background: selectedStep === idx ? 'linear-gradient(135deg, #e5a445 0%, #d4941d 100%)' : '#f9fafb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: '1px solid ' + (selectedStep === idx ? '#d4941d' : '#e5e7eb'),
                      }}
                      onMouseEnter={(e) => {
                        if (selectedStep !== idx) {
                          e.currentTarget.style.background = '#f0f3f7';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedStep !== idx) {
                          e.currentTarget.style.background = '#f9fafb';
                        }
                      }}
                    >
                      <span style={{
                        minWidth: '32px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: selectedStep === idx ? '#0f2942' : '#0f2942',
                        color: selectedStep === idx ? '#e5a445' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '13px',
                        flexShrink: 0,
                      }}>
                        {item.globalIdx}
                      </span>
                      <span style={{
                        fontSize: '13px',
                        color: selectedStep === idx ? '#fff' : '#374151',
                        lineHeight: '1.6',
                        fontWeight: selectedStep === idx ? '600' : '400',
                      }}>
                        {item.step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Safety Tip */}
            <div style={{ marginTop: '20px', padding: '20px', background: 'linear-gradient(135deg, rgba(229, 164, 69, 0.1) 0%, rgba(229, 164, 69, 0.05) 100%)', borderLeft: '4px solid #e5a445', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
                <strong style={{ color: '#0f2942' }}>Safety Tip:</strong> Always ensure the device is properly powered off and cooled down between inspections. Handle glass with care and wear protective equipment when necessary.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminHowToUse;
