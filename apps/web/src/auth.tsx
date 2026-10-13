import { createContext, useContext, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { User } from './types';

type AuthContextValue = { user: User | null; loading: boolean; login: (data: { email: string; password: string }) => Promise<User>; register: (data: { name: string; email: string; password: string }) => Promise<User>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), retry: false });
  const loginMutation = useMutation({ mutationFn: (data: { email: string; password: string }) => api<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }) });
  const registerMutation = useMutation({ mutationFn: (data: { name: string; email: string; password: string }) => api<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }) });
  return <AuthContext.Provider value={{
    user: me.data?.user ?? null, loading: me.isLoading,
    login: async (data) => { const result = await loginMutation.mutateAsync(data); client.setQueryData(['me'], result); return result.user; },
    register: async (data) => { const result = await registerMutation.mutateAsync(data); client.setQueryData(['me'], result); return result.user; },
    logout: async () => { await api('/auth/logout', { method: 'POST' }); client.setQueryData(['me'], null); client.clear(); },
  }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider missing'); return value; };
