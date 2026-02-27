import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import './AdminEmployeeManagement.css';

function AdminEmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('manage'); // manage, clear
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  // Form states for adding employee
  const [newEmployee, setNewEmployee] = useState({ email: '', password: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [clearDbConfirm, setClearDbConfirm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');

  // Load employees on mount
  const loadEmployees = useCallback(async () => {

  try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .eq('role', 'employee')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
      clearMessages();
    } catch (error) {
      console.error('Error loading employees:', error);
      setErrorMessage('Failed to load employees: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearMessages = () => {
    setTimeout(() => {
      setSuccessMessage('');
      setErrorMessage('');
    }, 5000);
  };

  // Load employees on component mount
  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // ════════════════════════════════════════════════════════════════
  // ADD EMPLOYEE
  // ════════════════════════════════════════════════════════════════
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!newEmployee.email || !newEmployee.password) {
      setErrorMessage('Email and password are required');
      return;
    }

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmployee.email,
        password: newEmployee.password,
      });

      if (authError) throw authError;

      // Add profile to database
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email: newEmployee.email,
            role: 'employee',
          },
        ]);

      if (profileError) throw profileError;

      setSuccessMessage(`Employee ${newEmployee.email} added successfully`);
      setNewEmployee({ email: '', password: '' });
      setShowAddForm(false);
      await loadEmployees();
      clearMessages();
    } catch (error) {
      console.error('Error adding employee:', error);
      setErrorMessage('Error: ' + error.message);
      clearMessages();
    }
  };

  // ════════════════════════════════════════════════════════════════
  // EDIT EMPLOYEE
  // ════════════════════════════════════════════════════════════════
  const handleEditEmployee = async (id, email) => {
    if (!editEmail.trim()) {
      setErrorMessage('Email cannot be empty');
      return;
    }
    try {
      // Update email in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ email: editEmail })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update password in auth if provided
      if (editPassword.trim()) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          id,
          { password: editPassword }
        );
        if (passwordError) throw passwordError;
      }

      setSuccessMessage(`✅ Employee ${email} updated successfully`);
      setEditingEmployeeId(null);
      setEditEmail('');
      setEditPassword('');
      await loadEmployees();
      clearMessages();
    } catch (error) {
      console.error('Error editing employee:', error);
      setErrorMessage('Error: ' + error.message);
      clearMessages();
    }
  };

  // DELETE EMPLOYEE
  // ════════════════════════════════════════════════════════════════
  const handleDeleteEmployee = async (id, email) => {
    try {
      // Delete from profiles table (will cascade)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage(`✅ Employee ${email} deleted successfully`);
      setDeleteConfirm(null);
      await loadEmployees();
      clearMessages();
    } catch (error) {
      console.error('Error deleting employee:', error);
      setErrorMessage('Error: ' + error.message);
      clearMessages();
    }
  };

  // ════════════════════════════════════════════════════════════════
  // CLEAR DEFECTS DATABASE
  // ════════════════════════════════════════════════════════════════
  const handleClearDatabase = async () => {
    try {
      // Delete all defects
      const { error } = await supabase
        .from('defects')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (error) throw error;

      setSuccessMessage('✅ Database cleared - all defects deleted');
      setClearDbConfirm(false);
      clearMessages();
    } catch (error) {
      console.error('Error clearing database:', error);
      setErrorMessage('Error: ' + error.message);
      clearMessages();
    }
  };

  // Helper: Format date
  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };



  return (
    <div className="admin-employee-management">
      {/* Messages */}
      {successMessage && <div className="admin-message admin-success">{successMessage}</div>}
      {errorMessage && <div className="admin-message admin-error">{errorMessage}</div>}

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          Manage Employees
        </button>
        <button
          className={`admin-tab ${activeTab === 'clear' ? 'active' : ''}`}
          onClick={() => setActiveTab('clear')}
        >
          Database
        </button>
      </div>

      {/* Content */}
      <div className="admin-content">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MANAGE EMPLOYEES TAB */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'manage' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h3>Manage Employees ({employees.length})</h3>
              <button
                className={`admin-btn-add${showAddForm ? ' active' : ''}`}
                onClick={() => setShowAddForm(prev => !prev)}
              >
                {showAddForm ? 'Cancel' : '+ Add Employee'}
              </button>
            </div>

            {showAddForm && (
              <form className="admin-add-dropdown" onSubmit={handleAddEmployee}>
                <div className="admin-add-dropdown-fields">
                  <input
                    type="email"
                    required
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    placeholder="Email"
                    className="admin-add-input"
                  />
                  <input
                    type="password"
                    required
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                    placeholder="Password (min 6 chars)"
                    className="admin-add-input"
                  />
                  <button type="submit" className="admin-btn-add-submit">Add</button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="admin-loading">Loading employees...</div>
            ) : employees.length === 0 ? (
              <div className="admin-empty">No employees found. Add one to get started!</div>
            ) : (
              <div className="admin-manage-layout">
                {/* Employee sidebar list */}
                <div className="admin-emp-sidebar">
                  {employees.map((emp, index) => (
                    <button
                      key={emp.id}
                      className={`admin-emp-item ${selectedEmployeeId === emp.id ? 'active' : ''}`}
                      onClick={() => { setSelectedEmployeeId(emp.id); setDeleteConfirm(null); }}
                    >
                      <span className="admin-emp-item-avatar">
                        {index + 1}
                      </span>
                      <span className="admin-emp-item-email">{emp.email}</span>
                    </button>
                  ))}
                </div>

                {/* Detail panel */}
                <div className="admin-emp-detail">
                  {(() => {
                    const empIndex = employees.findIndex(e => e.id === (selectedEmployeeId || (employees[0] && employees[0].id)));
                    const emp = employees.find(e => e.id === selectedEmployeeId) || employees[0];
                    if (!emp) return null;
                    return (
                      <>
                        <div className="admin-detail-header">
                          <div className="admin-detail-avatar">
                            {(empIndex >= 0 ? empIndex : 0) + 1}
                          </div>
                          <div className="admin-detail-title">
                            <h4>{emp.email}</h4>
                            <span className="admin-role-badge">Employee</span>
                          </div>
                        </div>

                        <div className="admin-detail-grid">
                          <div className="admin-detail-card">
                            <span className="admin-detail-card-label">Email</span>
                            <span className="admin-detail-card-value">{emp.email}</span>
                          </div>
                          <div className="admin-detail-card">
                            <span className="admin-detail-card-label">Role</span>
                            <span className="admin-detail-card-value">Employee</span>
                          </div>
                          <div className="admin-detail-card">
                            <span className="admin-detail-card-label">Created</span>
                            <span className="admin-detail-card-value">{formatDate(emp.created_at)}</span>
                          </div>
                        </div>

                        <div className="admin-detail-actions">
                          {editingEmployeeId === emp.id ? (
                            <div className="admin-edit-form">
                              <div className="admin-form-group">
                                <label>Email</label>
                                <input
                                  type="email"
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  placeholder="New email"
                                />
                              </div>
                              <div className="admin-form-group">
                                <label>Password (leave blank to keep current)</label>
                                <input
                                  type="password"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  placeholder="New password"
                                />
                              </div>
                              <div className="admin-button-row">
                                <button
                                  className="admin-btn-primary"
                                  onClick={() => handleEditEmployee(emp.id, emp.email)}
                                >
                                  Save Changes
                                </button>
                                <button
                                  className="admin-btn-secondary"
                                  onClick={() => {
                                    setEditingEmployeeId(null);
                                    setEditEmail('');
                                    setEditPassword('');
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : deleteConfirm === emp.id ? (
                            <div className="admin-confirm-delete">
                              <p>Are you sure you want to delete {emp.email}?</p>
                              <div className="admin-confirm-buttons">
                                <button
                                  className="admin-btn-danger"
                                  onClick={() => handleDeleteEmployee(emp.id, emp.email)}
                                >
                                  Yes, Delete
                                </button>
                                <button
                                  className="admin-btn-secondary"
                                  onClick={() => setDeleteConfirm(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="admin-button-row">
                              <button
                                className="admin-btn-primary"
                                onClick={() => {
                                  setEditingEmployeeId(emp.id);
                                  setEditEmail(emp.email);
                                  setEditPassword('');
                                }}
                              >
                                Edit Employee
                              </button>
                              <button
                                className="admin-btn-danger"
                                onClick={() => setDeleteConfirm(emp.id)}
                              >
                                Delete Employee
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* DATABASE MANAGEMENT TAB */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'clear' && (
          <div className="admin-section">
            <h3>Database Management</h3>

            <div className="admin-db-info">
              <div className="admin-info-card">
                <h4>Clear Defects Database</h4>
                <p>This will permanently delete all defect records from the database.</p>
                <p className="admin-warning">This action cannot be undone.</p>

                {!clearDbConfirm ? (
                  <button
                    className="admin-btn-danger"
                    onClick={() => setClearDbConfirm(true)}
                  >
                    Clear All Defects
                  </button>
                ) : (
                  <div className="admin-confirm-delete">
                    <p className="admin-confirm-title">
                      Are you absolutely sure?
                    </p>
                    <p>All defect records will be permanently deleted.</p>
                    <div className="admin-confirm-buttons">
                      <button
                        className="admin-btn-danger"
                        onClick={handleClearDatabase}
                      >
                        Yes, Delete All Defects
                      </button>
                      <button
                        className="admin-btn-secondary"
                        onClick={() => setClearDbConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="admin-info-card">
                <h4>Change Employee Passwords</h4>
                <p>To change employee passwords:</p>
                <ol>
                  <li>Go to Supabase Dashboard</li>
                  <li>Click on "Authentication" → "Users"</li>
                  <li>Find the employee account</li>
                  <li>Click the user and use "Reset Password"</li>
                  <li>Send the reset link to the employee</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminEmployeeManagement;
