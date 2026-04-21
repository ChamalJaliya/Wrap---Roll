import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Checkout Write-Path Stress Test
 * Simulates concurrent guest order placement.
 * 
 * Usage: 
 *   BASE_URL=http://localhost:4000/api k6 run scripts/load/k6-checkout.js
 */

const base = __ENV.BASE_URL || 'http://localhost:4000/api';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    'http_req_failed': ['rate<0.05'], // Max 5% failure (account for throttling)
    'http_req_duration': ['p(95)<2000'],
  },
};

export default function () {
  const payload = JSON.stringify({
    fulfillmentType: 'TAKEAWAY',
    customerName: `k6_tester_${__VU}_${__ITER}`,
    customerPhone: '0770000000',
    paymentMethod: 'cash',
    items: [
      {
        itemId: 'ITEM_001', // Assumes this exists in seed
        name: 'Classic Wrap',
        quantity: 1,
        totalPrice: 1200,
        modifiers: [
          { options: [{ label: 'Regular', priceAdjust: 0 }] },
          { options: [{ label: 'Chicken', priceAdjust: 0 }] }
        ]
      }
    ]
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${base}/orders`, payload, params);

  check(res, {
    'checkout status 201': (r) => r.status === 201,
    'has orderId': (r) => r.json().orderId !== undefined,
  });

  sleep(2); // Wait 2 seconds between orders per virtual user
}
