let isDetecting = false;
let currentDefects = [];
let currentImageIndex = 0;
let detectionIntervalId = null;

const defectTypes = ['Bubble', 'Crack', 'Scratch'];

// Helpers
function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `[${h}:${m}:${s}]`;
}

function checkAuth() {
  if (sessionStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'Login.html';
  }
}

function navigateTo(page) {
  window.location.href = page;
}

function handleSettings() {
  alert('Settings page coming soon!');
}

function handleLogout() {
  sessionStorage.removeItem('loggedIn');
  window.location.href = 'Login.html';
}

function updateButtonStates() {
  const clearButton = document.getElementById('clearButton');
  const uploadButton = document.getElementById('uploadButton');
  const downloadButton = document.getElementById('downloadButton');

  if (!clearButton || !uploadButton || !downloadButton) return;

  const hasDefects = currentDefects.length > 0;
  clearButton.disabled = !hasDefects;
  uploadButton.disabled = false;
  downloadButton.disabled = !hasDefects;
}

function renderDefects() {
  const defectsList = document.getElementById('defectsList');
  if (!defectsList) return;

  if (currentDefects.length === 0) {
    defectsList.innerHTML = `
      <div class="machine-empty-state">
        <p class="machine-empty-state-text">No detections yet</p>
      </div>
    `;
  } else {
    defectsList.innerHTML = currentDefects
      .map((defect, index) => `
      <div class="machine-defect-item">
        <div class="machine-defect-content">
          <span class="machine-defect-time">${defect.time}</span>
          <span class="machine-defect-label">Glass Defect:</span>
          <span class="machine-defect-type">${defect.type}</span>
          <span class="machine-defect-image-link" onclick="openModal(${index})">Image</span>
        </div>
      </div>
    `)
      .join('');
  }

  updateButtonStates();
}

function addDefectByTime() {
  const now = new Date();
  const timeStr = formatTime(now);
  const type = defectTypes[Math.floor(Math.random() * defectTypes.length)];
  const imageUrl = `https://via.placeholder.com/600x400/dc2626/ffffff?text=${type}+Defect`;

  currentDefects.push({ time: timeStr, type, imageUrl });

  if (currentDefects.length > 20) {
    currentDefects = currentDefects.slice(-20);
  }

  renderDefects();
}

function toggleDetection() {
  isDetecting = !isDetecting;

  const detectionButton = document.getElementById('detectionButton');
  const videoSectionTitle = document.getElementById('videoSectionTitle');
  const videoPlaceholder = document.getElementById('videoPlaceholder');
  const liveFeed = document.getElementById('liveFeed');

  if (isDetecting) {
    detectionButton.textContent = 'Stop Detection';
    videoSectionTitle.textContent = 'Monitoring';
    videoPlaceholder.classList.add('hidden');
    liveFeed.classList.remove('hidden');
    currentDefects = [];
    renderDefects();

    addDefectByTime();
    detectionIntervalId = setInterval(addDefectByTime, 15000);
  } else {
    detectionButton.textContent = 'Start Detection';
    videoSectionTitle.textContent = 'Monitor';
    videoPlaceholder.classList.remove('hidden');
    liveFeed.classList.add('hidden');
    renderDefects();

    if (detectionIntervalId) {
      clearInterval(detectionIntervalId);
      detectionIntervalId = null;
    }
  }
}

function openModal(index) {
  currentImageIndex = index;
  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const modalDefectInfo = document.getElementById('modalDefectInfo');

  if (!modal || !modalImage || !modalDefectInfo) return;
  const defect = currentDefects[currentImageIndex];
  if (!defect) return;
  modalImage.src = defect.imageUrl;
  modalDefectInfo.textContent = `${defect.time} Glass Defect: ${defect.type}`;

  modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('imageModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function nextImage() {
  if (currentDefects.length === 0) return;
  currentImageIndex = (currentImageIndex + 1) % currentDefects.length;
  const modalImage = document.getElementById('modalImage');
  const modalDefectInfo = document.getElementById('modalDefectInfo');
  if (!modalImage || !modalDefectInfo) return;
  const defect = currentDefects[currentImageIndex];
  if (!defect) return;
  modalImage.src = defect.imageUrl;
  modalDefectInfo.textContent = `${defect.time} Glass Defect: ${defect.type}`;
}

function clearDefects() {
  if (confirm('Are you sure you want to clear all defects?')) {
    currentDefects = [];
    renderDefects();
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

// CSV upload logic for Upload to Database button
document.addEventListener('DOMContentLoaded', function() {
  checkAuth();
  renderDefects();

  const csvInput = document.getElementById('csvInput');
  if (csvInput) {
    csvInput.addEventListener('change', function(event) {
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
    });
  }
});

document.addEventListener('click', function(e) {
  const modal = document.getElementById('imageModal');
  if (e.target === modal) {
    closeModal();
  }
});