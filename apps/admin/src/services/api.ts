import axios from 'axios';
import { ADMIN_API_BASE_URL } from '../config/admin-api-public';

const api = axios.create({
  baseURL: ADMIN_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
