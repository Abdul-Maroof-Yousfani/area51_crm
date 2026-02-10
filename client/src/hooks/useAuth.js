import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Check for existing token on mount
  useEffect(() => {
    const token = authService.getToken();
    if (token) {
      // Decode token to get user info (JWT payload is base64 encoded)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser({ id: payload.id, role: payload.role });
          setActiveUser(userData);
        }
      } catch (e) {
        console.error('Invalid token:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setAuthLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await authService.login(email, password);
      const { user: userData, token } = response.data;
      setUser({ id: userData.id, role: userData.role });
      setActiveUser({
        uid: userData.id,
        email: userData.email,
        name: userData.username,
        role: userData.role
      });
      localStorage.setItem('user', JSON.stringify({
        uid: userData.id,
        email: userData.email,
        name: userData.username,
        role: userData.role
      }));
      return response;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signup = useCallback(async (username, email, password, role) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await authService.signup(username, email, password, role);
      const { user: userData, token } = response.data;
      setUser({ id: userData.id, role: userData.role });
      setActiveUser({
        uid: userData.id,
        email: userData.email,
        name: userData.username,
        role: userData.role
      });
      localStorage.setItem('user', JSON.stringify({
        uid: userData.id,
        email: userData.email,
        name: userData.username,
        role: userData.role
      }));
      return response;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setActiveUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  }, []);

  return {
    user,
    activeUser,
    setActiveUser,
    authLoading,
    authError,
    login,
    signup,
    logout,
    isAuthenticated: !!user
  };
}
