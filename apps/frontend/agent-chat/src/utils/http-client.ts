import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export function toApiUrl(path: string) {
  return `${API_BASE}${path}`;
}
