import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Settings } from '../pages/Settings';
import { AuthProvider } from '../context/AuthContext';
import apiClient from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  default: {
    getCurrentUser: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    setToken: vi.fn(),
    getToken: vi.fn()
  },
  apiClient: {
    getCurrentUser: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    setToken: vi.fn(),
    getToken: vi.fn()
  }
}));

const mockUser = {
  _id: '6712a4b89e2c145d88a1b2c3',
  name: 'Dev Lead Alice',
  email: 'alice@example.com',
  role: 'DEVELOPER',
  createdAt: '2026-01-15T10:00:00.000Z'
};

function renderSettings() {
  apiClient.getCurrentUser.mockResolvedValue({
    success: true,
    data: { user: mockUser }
  });

  return render(
    <AuthProvider>
      <Settings />
    </AuthProvider>
  );
}

describe('Phase 7: Settings Page Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders user profile details correctly', async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Dev Lead Alice')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('DEVELOPER')).toBeInTheDocument();
    });
  });

  it('persists editor preferences changes to localStorage', async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Monaco Editor Preferences')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    // selects: [0: defaultLanguage, 1: fontSize, 2: tabSize, 3: primaryAiModel]
    const languageSelect = selects[0];
    fireEvent.change(languageSelect, { target: { value: 'javascript' } });

    const stored = JSON.parse(window.localStorage.getItem('workspace_preferences') || '{}');
    expect(stored.defaultLanguage).toBe('javascript');
  });

  it('validates password requirements before submission', async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Account Security')).toBeInTheDocument();
    });

    const currentPwInput = screen.getByPlaceholderText('Enter current password');
    const newPwInput = screen.getByPlaceholderText(/Min 8 characters/i);
    const confirmPwInput = screen.getByPlaceholderText('Confirm your new password');
    const submitBtn = screen.getByRole('button', { name: /Update Password/i });

    // Test: short new password
    fireEvent.change(currentPwInput, { target: { value: 'OldPassword1!' } });
    fireEvent.change(newPwInput, { target: { value: 'short' } });
    fireEvent.change(confirmPwInput, { target: { value: 'short' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument();
    expect(apiClient.changePassword).not.toHaveBeenCalled();
  });

  it('submits password change and shows success banner', async () => {
    apiClient.changePassword.mockResolvedValueOnce({
      success: true,
      message: 'Password changed successfully.'
    });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Account Security')).toBeInTheDocument();
    });

    const currentPwInput = screen.getByPlaceholderText('Enter current password');
    const newPwInput = screen.getByPlaceholderText(/Min 8 characters/i);
    const confirmPwInput = screen.getByPlaceholderText('Confirm your new password');
    const submitBtn = screen.getByRole('button', { name: /Update Password/i });

    fireEvent.change(currentPwInput, { target: { value: 'CurrentPass1!' } });
    fireEvent.change(newPwInput, { target: { value: 'BrandNewPass2@' } });
    fireEvent.change(confirmPwInput, { target: { value: 'BrandNewPass2@' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.changePassword).toHaveBeenCalledWith({
        currentPassword: 'CurrentPass1!',
        newPassword: 'BrandNewPass2@'
      });
      expect(screen.getByText(/Password successfully updated/i)).toBeInTheDocument();
    });
  });

  it('calls logout on sign out button click', async () => {
    apiClient.logout.mockResolvedValueOnce({ success: true });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Session Management & Sign Out')).toBeInTheDocument();
    });

    const signOutBtn = screen.getByRole('button', { name: /Sign Out of Workstation/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(apiClient.logout).toHaveBeenCalled();
    });
  });
});
