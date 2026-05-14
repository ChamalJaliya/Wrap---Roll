import axios from 'axios';
import { ADMIN_API_BASE_URL } from '../config/admin-api-public';

/** Same-origin Nest proxy must be `/api/nest`, not `/api` (which is this Next app, not Nest). */
const resolvedBase =
  ADMIN_API_BASE_URL === '/api' ? '/api/nest' : ADMIN_API_BASE_URL.replace(/\/$/, '');

const api = axios.create({
  baseURL: resolvedBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
