import { useState, useEffect } from "react";
import { authStore } from "../store/authStore";

export function useAuth() {
  const [auth, setAuth] = useState(authStore.getState());

  useEffect(() => {
    const unsubscribe = authStore.subscribe(setAuth);
    return unsubscribe;
  }, []);

  return {
    user: auth.user,
    token: auth.token,
    role: auth.role,
    isLoggedIn: !!auth.token,
    login: authStore.login.bind(authStore),
    logout: authStore.logout.bind(authStore),
  };
}
