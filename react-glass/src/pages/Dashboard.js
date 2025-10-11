import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/AlumpreneurLogo.png';
import './Dashboard.css';

const defectTypes = ['Bubble', 'Crack', 'Scratch'];

function Dashboard() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentDefects, setCurrentDefects] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const detectionInterval = useRef(null);
  const csvInputRef = useRef(null);
  const navigate = useNavigate();

  const startDetection = () => {
    setIsDetecting(true);
    setCurrentDefects([]);
    addDefectByTime();
    detectionInterval.current = setInterval(addDefectByTime, 15000);
  };

  const stopDetection = () => {
    setIsDetecting(false);
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
  };

  const toggleDetection = () => {
    if (isDetecting) {
      stopDetection();
    } else {
      startDetection();
    }
  };

  function addDefectByTime() {
    const now = new Date();
    const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    const type = defectTypes[Math.floor(Math.random() * defectTypes.length)];
    const imageUrl = `https://via.placeholder.com/600x400/dc2626/ffffff?text=${type}+Defect`;

    setCurrentDefects(prev => {
      const updated = [...prev, { time: timeStr, type, imageUrl }];
      return updated.length > 20 ? updated.slice(-20) : updated;
    });
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
    navigate('/'); // ✅ Go back to Login
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
      <aside className="machine-sidebar">
        <div className="machine-sidebar-logo">
          {/* ✅ Use imported logo here */}
          <img
            src={logo}
            alt="Alumpreneur Logo"
            className="machine-logo-image"
          />
        </div>
        <div className="machine-sidebar-divider"></div>
        <nav className="machine-nav-menu"></nav>
        <div className="machine-bottom-menu">
          <button onClick={handleLogout} className="machine-bottom-button">
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span className="machine-bottom-label">Log Out</span>
          </button>
        </div>
      </aside>

      <main className="machine-main-content">
        <header className="machine-header">
          <div className="machine-header-left">
            <h1 className="machine-header-title">Glass Defect Detector</h1>
            <p className="machine-header-subtitle">CAM-001</p>
          </div>
          <button onClick={toggleDetection} className="machine-detection-button" id="detectionButton">
            {isDetecting ? 'Stop Detection' : 'Start Detection'}
          </button>
        </header>

        <div className="machine-content-area">
          <div className="machine-content-wrapper">
            {/* Camera section */}
            <div className="machine-video-section">
              <h2 className="machine-section-title" id="videoSectionTitle">{isDetecting ? 'Monitoring' : 'Monitor'}</h2>
              <div className="machine-video-container">
                {!isDetecting ? (
                  <div id="videoPlaceholder" className="machine-video-placeholder">
                    <p className="machine-placeholder-title">Camera Ready</p>
                    <p className="machine-placeholder-subtitle">
                      Click "Start Detection" to begin live view
                    </p>
                  </div>
                ) : (
                  <div id="liveFeed" className="machine-live-feed">
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
                      Live Camera Feed
                    </div>
                    <div className="machine-live-indicator">
                      <span className="machine-live-dot"></span>
                      LIVE
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
                    id="clearButton"
                    disabled={currentDefects.length === 0}
                  >
                    Clear
                  </button>
                  <input
                    type="file"
                    id="csvInput"
                    accept=".csv"
                    style={{ display: 'none' }}
                    ref={csvInputRef}
                    onChange={handleCsvUpload}
                  />
                  <button
                    onClick={() => csvInputRef.current.click()}
                    className="action-button upload-button"
                    id="uploadButton"
                  >
                    Upload to Database
                  </button>
                  <button
                    onClick={downloadCSV}
                    className="action-button download-button"
                    id="downloadButton"
                    disabled={currentDefects.length === 0}
                  >
                    Download CSV
                  </button>
                </div>
              </div>
              <div className="machine-defects-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
                <div id="defectsList">
                  {currentDefects.length === 0 ? (
                    <div className="machine-empty-state">
                      <p className="machine-empty-state-text">No detections yet</p>
                    </div>
                  ) : (
                    currentDefects.map((defect, index) => (
                      <div className="machine-defect-item" key={index}>
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

      {/* Modal */}
      {modalOpen && (
        <div id="imageModal" className="modal">
          <div className="modal-content">
            <button onClick={closeModal} className="modal-close">
              <svg className="icon" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="modal-image-container">
              <img
                id="modalImage"
                src={currentDefects[currentImageIndex]?.imageUrl}
                alt="Defect"
                className="modal-image"
              />
              <div className="modal-defect-info">
                <p id="modalDefectInfo">
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
