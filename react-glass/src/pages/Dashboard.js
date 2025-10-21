import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './Dashboard.css';

const defectTypes = ['Bubble', 'Crack', 'Scratch'];
const DEFECT_ITEM_HEIGHT = 56;

function Dashboard() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentDefects, setCurrentDefects] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const detectionInterval = useRef(null);
  const csvInputRef = useRef(null);
  const navigate = useNavigate();

  // Show a new defect every 3 seconds
  const startDetection = () => {
    setIsDetecting(true);
    setCurrentDefects([]);
    addDefectByTime();
    detectionInterval.current = setInterval(addDefectByTime, 3000);
  };

  const stopDetection = () => {
    setIsDetecting(false);
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
  };

  const toggleDetection = () => {
    isDetecting ? stopDetection() : startDetection();
  };

  function addDefectByTime() {
    const now = new Date();
    const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    const type = defectTypes[Math.floor(Math.random() * defectTypes.length)];
    const imageUrl = `https://via.placeholder.com/600x400/dc2626/ffffff?text=${type}+Defect`;

  setCurrentDefects(prev => [...prev, { time: timeStr, type, imageUrl }]);
  }

  function clearDefects() {
    if (window.confirm('Are you sure you want to clear all defects?')) {
      setCurrentDefects([]);
    }
  }

  function downloadCSV() {
    if (currentDefects.length === 0) return;
    const csvHeader = 'Time,Defect Type,Image URL\n';
    const csvRows = currentDefects.map(defect =>
      `${defect.time},${defect.type},${defect.imageUrl}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `defects_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function handleLogout() {
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('role');
    navigate('/');
  }

  function openModal(index) {
    setCurrentImageIndex(index);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function nextImage() {
    setCurrentImageIndex((currentImageIndex + 1) % currentDefects.length);
  }

  function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      const lines = text.trim().split('\n');
      let startIdx = 0;
      if (lines[0].toLowerCase().includes('time') && lines[0].toLowerCase().includes('defect')) {
        startIdx = 1;
      }
      let uploadedDefects = [];
      for (let i = startIdx; i < lines.length; i++) {
        const [time, type, imageUrl] = lines[i].split(',');
        if (time && type && imageUrl) {
          uploadedDefects.push({ time: time.trim(), type: type.trim(), imageUrl: imageUrl.trim() });
        }
      }
      alert('CSV parsed and ready to upload to database!\n' + JSON.stringify(uploadedDefects, null, 2));
    };
    reader.readAsText(file);
  }

  return (
    <div className="machine-container">
      <Sidebar
        onLogout={handleLogout}
        mainItems={[
          { key: 'dashboard', label: 'Dashboard', onClick: () => navigate('/dashboard') },
        ]}
        bottomItems={[
          { key: 'help', label: ' Help', onClick: () => navigate('/help') },
        ]}
        activeKey="dashboard"
      />

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Glass Defect Detector</h1>
            <p className="machine-header-subtitle">CAM-001</p>
          </div>
          <button onClick={toggleDetection} className="machine-detection-button">
            {isDetecting ? 'Stop Detection' : 'Start Detection'}
          </button>
        </header>

        <div className="machine-content-area">
          <div className="machine-content-wrapper">
            <div className="machine-video-section">
              <h2 className="machine-section-title">Detection Preview</h2>
              <div className="machine-video-container">
                {isDetecting ? (
                  <div className="machine-live-feed">
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 18
                    }}>
                      Detection View
                    </div>
                    <div className="machine-live-indicator">
                      <span className="machine-live-dot"></span>
                      LIVE
                    </div>
                  </div>
                ) : (
                  <div className="machine-video-placeholder">
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <p className="machine-placeholder-title" style={{ color: '#1a3a52', fontWeight: 700, fontSize: 18 }}>Camera Ready</p>
                      <p className="machine-placeholder-subtitle" style={{ color: '#6b7280', fontSize: 14 }}>Click "Start Detection" to begin live view</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Defect List Section */}
            <div className="machine-defects-panel">
              <div className="defects-panel-header">
                <h2 className="machine-section-title">Detected Defects</h2>
                <div className="defects-panel-actions">
                  <button
                    onClick={clearDefects}
                    className="action-button clear-button"
                    disabled={currentDefects.length === 0}
                  >
                    Clear
                  </button>
                  <input
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    ref={csvInputRef}
                    onChange={handleCsvUpload}
                  />
                  <button
                    onClick={() => csvInputRef.current.click()}
                    className="action-button upload-button"
                  >
                    Upload to Database
                  </button>
                  <button
                    onClick={downloadCSV}
                    className="action-button download-button"
                    disabled={currentDefects.length === 0}
                  >
                    Download CSV
                  </button>
                </div>
              </div>
              <div className="machine-defects-list">
                <div>
                  {currentDefects.length === 0 ? (
                    <div className="machine-empty-state">
                      <p className="machine-empty-state-text">No detections yet</p>
                    </div>
                  ) : (
                    currentDefects.map((defect, index) => (
                      <div className="machine-defect-item" key={index} style={{ height: DEFECT_ITEM_HEIGHT }}>
                        <div className="machine-defect-content">
                          <span className="machine-defect-time">{defect.time}</span>
                          <span className="machine-defect-label">Glass Defect:</span>
                          <span className="machine-defect-type">{defect.type}</span>
                          <span
                            className="machine-defect-image-link"
                            style={{ cursor: 'pointer', color: '#e5a445' }}
                            onClick={() => openModal(index)}
                          >
                            Image
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal for defect image with X and Next button */}
      {modalOpen && (
        <div className="modal">
          <div className="modal-content">
            <button onClick={closeModal} className="modal-close">
              <svg className="icon" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="modal-image-container">
              <img
                src={currentDefects[currentImageIndex]?.imageUrl}
                alt="Defect"
                className="modal-image"
              />
              <div className="modal-defect-info">
                <p>
                  {currentDefects[currentImageIndex]?.time} Glass Defect: {currentDefects[currentImageIndex]?.type}
                </p>
              </div>
            </div>
            <button onClick={nextImage} className="modal-next">
              Next
              <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;