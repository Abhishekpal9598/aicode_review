import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Verify and hydrate existing session from HttpOnly cookie on initial mount.
   */
  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getCurrentUser();
      if (res && res.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch {
      // Unauthenticated / expired cookie / network issue
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  /**
   * Log in user with credentials and store profile in state.
   */
  const login = async (credentials) => {
    setError(null);
    try {
      const res = await apiClient.login(credentials);
      if (res && res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      throw new Error('Authentication response missing user profile.');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
      throw err;
    }
  };

  /**
   * Register a new developer account.
   */
  const register = async (userData) => {
    setError(null);
    try {
      const res = await apiClient.register(userData);
      return res;
    } catch (err) {
      setError(err.message || 'Registration failed.');
      throw err;
    }
  };

  /**
   * Log out active session and clear client state.
   */
  const logout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // Proceed with client cleanup regardless
    } finally {
      setUser(null);
      setError(null);
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
    refreshUser: checkSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
