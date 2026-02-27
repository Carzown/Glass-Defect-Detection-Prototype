import React from 'react';
import './ConfirmationModal.css';

function ConfirmationModal({ 
  isOpen, 
  title = 'Confirm Action', 
  message = 'Are you sure?', 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  isDangerous = false,
  onConfirm, 
  onCancel 
}) {
  if (!isOpen) return null;

  return (
    <div className="confirmation-modal-overlay">
      <div className="confirmation-modal">
        <div className="confirmation-modal-content">
          <h2 className="confirmation-modal-title">{title}</h2>
          <p className="confirmation-modal-message">{message}</p>
        </div>
        <div className="confirmation-modal-actions">
          <button
            className="confirmation-modal-btn confirmation-modal-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className={`confirmation-modal-btn confirmation-modal-confirm ${isDangerous ? 'dangerous' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;
