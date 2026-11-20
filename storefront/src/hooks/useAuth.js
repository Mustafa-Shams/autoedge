import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken, getCustomer, isAuthenticated, setAuth, clearAuth, AUTH_EVENT } from '../store/authStore';
import * as storeApi from '../api/storeApi';

export default function useAuth() {
  const [customer, setCustomer] = useState(getCustomer());
  const [loggedIn, setLoggedIn] = useState(isAuthenticated());
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => {
      setCustomer(getCustomer());
      setLoggedIn(isAuthenticated());
    };
    window.addEventListener(AUTH_EVENT, handler);
    return () => window.removeEventListener(AUTH_EVENT, handler);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await storeApi.login({ email, password });
    setAuth(res.data.access_token, res.data.customer);
    return res.data;
  }, []);

  const register = useCallback(async (data) => {
    const res = await storeApi.register(data);
    setAuth(res.data.access_token, res.data.customer);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    navigate('/');
  }, [navigate]);

  return { customer, loggedIn, login, register, logout, token: getToken() };
}
