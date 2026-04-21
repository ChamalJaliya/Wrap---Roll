import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Kitchen Display System (KDS) Queue Load Test
 * Hits the orders/queue endpoint with many concurrent 'KITCHEN' persona projections.
 * 
 * Usage: 
 *   BASE_URL=http://localhost:4000/api JWT='Bearer eyJ...' k6 run scripts/load/k6-queue.js
 */

const base = __ENV.BASE_URL || 'http://localhost:4000/api';
const auth = __ENV.JWT || 'Bearer mock-staff-token';

export const options = {
  vus: 30, // Simulate 30 concurrent kitchen/staff tablets
  duration: '1m',
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration': ['p(95)<1000'], // KDS needs to be snappy (<1s)
  },
};

export default function () {
  // Simulate polling every 5 seconds per tablet
  const res = http.get(`${base}/orders/queue?status=placed,paid,in_kitchen`, {
    headers: { 
      'Authorization': auth,
      'Accept': 'application/json'
    },
  });

  check(res, {
    'kds status 200': (r) => r.status === 200,
    'queue is array': (r) => Array.isArray(r.json()),
  });

  sleep(5);
}
