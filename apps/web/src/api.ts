const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiClientError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiClientError(body.message, response.status, body.code);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export { API_URL };
