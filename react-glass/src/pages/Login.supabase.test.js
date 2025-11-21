import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';
import * as supabase from '../supabase';

// Mock react-router navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('Supabase Login', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    // Prevent automatic redirect by getCurrentUser
    jest.spyOn(supabase, 'getCurrentUser').mockResolvedValue(null);
  });

  test('employee login navigates to /dashboard and sets session storage', async () => {
    const mockRes = { uid: 'u-employee-1', email: 'employee@example.com', role: 'employee' };
    jest.spyOn(supabase, 'signInAndGetRole').mockResolvedValue(mockRes);

    render(<Login />);

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'employee@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(supabase.signInAndGetRole).toHaveBeenCalledWith('employee@example.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      expect(sessionStorage.getItem('loggedIn')).toBe('true');
      expect(sessionStorage.getItem('role')).toBe('employee');
      expect(sessionStorage.getItem('userId')).toBe('u-employee-1');
    });
  });

  test('admin login navigates to /admin when role is admin', async () => {
    const mockRes = { uid: 'u-admin-1', email: 'admin@example.com', role: 'admin' };
    jest.spyOn(supabase, 'signInAndGetRole').mockResolvedValue(mockRes);

    render(<Login />);

    // Click Admin tab to set UI role to admin (UI-only)
    const adminTab = screen.getByRole('tab', { name: 'Admin' });
    fireEvent.click(adminTab);

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'adminpass' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(supabase.signInAndGetRole).toHaveBeenCalledWith('admin@example.com', 'adminpass');
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
      expect(sessionStorage.getItem('loggedIn')).toBe('true');
      expect(sessionStorage.getItem('role')).toBe('admin');
      expect(sessionStorage.getItem('userId')).toBe('u-admin-1');
    });
  });
});
