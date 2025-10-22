import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './Dashboard.css';

const DEFECT_ITEM_HEIGHT = 56;

// (Removed fake defect generator helpers)

function Dashboard() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentDefects, setCurrentDefects] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const csvInputRef = useRef(null);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const navigate = useNavigate();
  const defectsListRef = useRef(null);

  // (Removed fake defect generator state/refs)

  useEffect(() => {
    const role = sessionStorage.getItem('role');
    if (role === 'admin') {
      alert('Admins cannot access the Employee Dashboard. Redirecting to Admin.');
      navigate('/admin');
    }
  }, [navigate]);

  // Start camera stream and begin inference loop
  const startDetection = async () => {
    setIsDetecting(true);
    setIsPaused(false);
    // Generator removed: defects will only come from uploads or future integrations
    setCameraError('');

  // (Generator removed)

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }
      // Ensure any previous stream is fully released before opening a new one
      releaseStream();
      let constraints;
      // Try to prefer an external/USB camera automatically (no UI)
      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vids = devices.filter(d => d.kind === 'videoinput');
        const preferred = vids.find(d => /usb|external|front/i.test(d.label))
          || vids.find(d => !/integrated|internal/i.test(d.label))
          || vids[0];
        if (preferred && preferred.deviceId) {
          constraints = { video: { deviceId: { exact: preferred.deviceId } }, audio: false };
        }
      }
      if (!constraints) {
        constraints = { video: true, audio: false };
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        console.warn('Primary getUserMedia failed, trying fallbacks...', err1);
        // Try environment-facing camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        } catch (err2) {
          // Final fallback: any available camera
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (err3) {
            throw err1 || err2 || err3;
          }
        }
      }
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (e) { /* ignore autoplay errors */ }
      }
      // generator already started above
    } catch (err) {
      console.error(err);
      setCameraError(err?.message || 'Unable to access camera');
      // On errors like NotReadableError, ensure we are fully reset
      releaseStream();
    }
  };

  const stopDetection = () => {
    setIsDetecting(false);
    setIsPaused(false);
    releaseStream();
  // Generator is managed by the isDetecting effect below
  };

  const toggleDetection = () => {
    isDetecting ? stopDetection() : startDetection();
  };

  // Pause/Resume: stop the inference loop (keeps camera preview), and resume on demand
  const togglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      const stream = mediaStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => { t.enabled = !next; });
      }
      // Pause/play the video element for visual feedback
      try {
        if (videoRef.current) {
          if (next) videoRef.current.pause();
          else videoRef.current.play();
        }
      } catch (_) {}
      return next;
    });
  };

  // Fully release the current media stream and reset the video element
  function releaseStream() {
    const stream = mediaStreamRef.current;
    if (stream) {
      try {
        stream.getTracks().forEach((track) => {
          try { track.stop(); } catch (_) {}
        });
      } catch (_) {}
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch (_) {}
      try { videoRef.current.srcObject = null; } catch (_) { videoRef.current.srcObject = undefined; }
    }
  }

  // (Removed fake defects generator)

  function openClearConfirm() { setConfirmClearOpen(true); }
  function closeClearConfirm() { setConfirmClearOpen(false); }
  function clearDefects() { setCurrentDefects([]); setConfirmClearOpen(false); }

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
    setCurrentImageIndex((idx) => {
      const last = currentDefects.length - 1;
      return idx < last ? idx + 1 : idx; // clamp at most recent (right end)
    });
  }

  function prevImage() {
    setCurrentImageIndex((idx) => (idx > 0 ? idx - 1 : idx)); // clamp at oldest (left end)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseStream();
    };
  }, []);

  // (Removed generator start/stop effect)

  // Auto-scroll defects list so newest entries are visible
  useEffect(() => {
    if (defectsListRef.current) {
      defectsListRef.current.scrollTop = defectsListRef.current.scrollHeight;
    }
  }, [currentDefects]);


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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isDetecting && (
              <button
                onClick={togglePause}
                className="machine-detection-button"
                title={isPaused ? 'Resume appending detections' : 'Pause appending detections'}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
            <button onClick={toggleDetection} className="machine-detection-button">
              {isDetecting ? 'Stop Detection' : 'Start Detection'}
            </button>
          </div>
        </header>

        <div className="machine-content-area">
          <div className="machine-content-wrapper">
            <div className="machine-video-section">
              <h2 className="machine-section-title">Detection Preview</h2>
              <div className="machine-video-container">
                {isDetecting ? (
                  <div className="machine-live-feed">
                    {cameraError ? (
                      <div style={{
                        width: '100%', height: '100%', backgroundColor: '#300', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center'
                      }}>
                        {cameraError}
                      </div>
                    ) : (
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <video
                          ref={videoRef}
                          className="machine-live-video"
                          style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                          autoPlay
                          muted
                          playsInline
                        />
                      </div>
                    )}
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
                    onClick={openClearConfirm}
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
              <div className="machine-defects-list" ref={defectsListRef}>
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
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {currentImageIndex > 0 && (
                <button onClick={prevImage} className="modal-next">
                  <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  Prev
                </button>
              )}
              {currentImageIndex < currentDefects.length - 1 && (
                <button onClick={nextImage} className="modal-next">
                  Next
                  <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal to confirm clearing defects */}
      {confirmClearOpen && (
        <div className="modal">
          <div className="modal-content">
            <button onClick={closeClearConfirm} className="modal-close">
              <svg className="icon" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="modal-image-container" style={{ textAlign: 'center' }}>
              <div className="modal-defect-info">
                <p>Clear all detected defects?</p>
                {currentDefects.length > 0 && (
                  <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
                    This will remove {currentDefects.length} item{currentDefects.length !== 1 ? 's' : ''} from the list.
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={closeClearConfirm} className="action-button upload-button">
                Cancel
              </button>
              <button onClick={clearDefects} className="action-button clear-button">
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;