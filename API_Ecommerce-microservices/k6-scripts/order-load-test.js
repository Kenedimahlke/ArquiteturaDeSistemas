import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "1m", target: 200 },
    { duration: "1m", target: 500 },
    { duration: "1m", target: 800 },
    { duration: "1m", target: 1000 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"], // Allow up to 5% failures for microservices architecture
    http_req_duration: ["p(95)<1000"], // 1 second for p95 (accounts for multiple service calls)
    http_req_duration: ["p(99)<2000"], // 2 seconds for p99
  },
};

export default function () {
  // IDs fixos de cliente e produto (use os que você criou)
  const clientId = "49bc155d-98f9-4c02-a034-97e686ec4569";
  const productId = "559e6af5-3503-4a80-8fc8-157d244273e8";
  
  const url = "http://orders-service:3003/v1/orders";
  
  const payload = JSON.stringify({
    clientId: clientId,
    items: [
      { 
        productId: productId, 
        quantity: Math.floor(Math.random() * 5) + 1 // Quantidade aleatória entre 1 e 5
      }
    ]
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const res = http.post(url, payload, params);

  check(res, {
    "status 201": (r) => r.status === 201,
    "has _id": (r) => r.json().hasOwnProperty('_id'),
    "has status": (r) => r.json().hasOwnProperty('status')
  });

  sleep(1);
}
