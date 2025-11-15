import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

// Load endpoints
const endpoints = new SharedArray("endpoints", function () {
  return JSON.parse(open("./endpoints.json"));
});

// Metrics for Jenkins
let latency = new Trend("latency");
let successCount = new Counter("success_count");
let failCount = new Counter("fail_count");

export let options = {
  vus: 1,
  iterations: endpoints.length
};

export default function () {

  const ep = endpoints[__ITER]; // One endpoint per iteration

  let params = {
    headers: {
      "Content-Type": "application/json"
    }
  };

  let res;

  if (ep.method === "POST") {
    res = http.post(ep.url, JSON.stringify(ep.payload), params);
  } else if (ep.method === "GET") {
    res = http.get(ep.url, params);
  } else {
    console.error(`Unsupported method: ${ep.method}`);
    return;
  }

  // Record response time
  latency.add(res.timings.duration);

  // Status verification
  const ok = check(res, {
    "status is 200": (r) => r.status === 200
  });

  if (ok) {
    successCount.add(1);
    console.log(`SUCCESS → ${ep.name}: ${res.status}`);
  } else {
    failCount.add(1);
    console.error(`FAIL → ${ep.name}: Returned ${res.status}`);
  }

  sleep(1);
}

