import axios from 'axios';

/** Same-origin `/api/nest` → App Route maps httpOnly admin cookie to `Authorization: Bearer` then forwards to Nest. */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '/api/nest';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
