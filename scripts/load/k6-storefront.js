import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Baseline Storefront Read-Path Load Test
 * Hits menu and category endpoints to measure cold/cached response times.
 * 
 * Usage: 
 *   BASE_URL=http://localhost:4000/api k6 run scripts/load/k6-storefront.js
 */

const base = __ENV.BASE_URL || 'http://localhost:4000/api';

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // Ramp up to 20 users
    { duration: '20s', target: 20 }, // Stay at 20 users
    { duration: '10s', target: 0 },  // Ramp down
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'],   // Less than 1% errors
    'http_req_duration': ['p(95)<500'], // 95% of requests should be under 500ms
  },
};

export default function () {
  // 1. Fetch Categories
  const catRes = http.get(`${base}/menu/categories`);
  check(catRes, {
    'categories status 200': (r) => r.status === 200,
  });

  // 2. Fetch Menu Items (Search & Filter)
  const menuRes = http.get(`${base}/menu?limit=50`);
  check(menuRes, {
    'menu status 200': (r) => r.status === 200,
    'menu has items': (r) => r.json().items.length > 0,
  });

  sleep(1);
}
