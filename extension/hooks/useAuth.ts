import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';

export function useAuth(ready: boolean) {
  const [user, setUser] = useState<api.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (api.isLoggedIn()) {
      api.getMe().then((u) => {
        setUser(u);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [ready]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { user } = await api.register(email, password, name);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return { user, loading, login, register, logout, isLoggedIn: !!user };
}
