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
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  // Criar um nome único para cada tipo de pagamento usando timestamp e VU
  const uniqueName = `Payment Method ${__VU}-${__ITER}-${Date.now()}`;
  
  const url = "http://payments-service:3004/v1/payments/types";
  
  const payload = JSON.stringify({ 
    name: uniqueName
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const res = http.post(url, payload, params);

  check(res, {
    "status 201": (r) => r.status === 201,
    "has id": (r) => r.json().hasOwnProperty('id'),
    "has name": (r) => r.json().name === uniqueName
  });

  sleep(1);
}
