/**
 * T4: k6 Performance Benchmark — VedaAide RAG endpoints
 *
 * Usage:
 *   k6 run tests/load/rag-query.js
 *   k6 run tests/load/rag-query.js --env BASE_URL=http://your-server:3000
 *
 * Thresholds:
 *   - P95 response time < 2500ms
 *   - Error rate < 5%
 */

// @ts-nocheck (k6 is not a Node.js module; run with the k6 binary)
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "1m", target: 10 }, // Ramp up to 10 VUs
    { duration: "3m", target: 10 }, // Stay at 10 VUs
    { duration: "1m", target: 50 }, // Spike to 50 VUs
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2500"], // 95th percentile < 2.5s
    http_req_failed: ["rate<0.05"], // Error rate < 5%
    rag_query_duration: ["p(95)<2500"],
    rag_ingest_duration: ["p(95)<5000"],
  },
};

// ── Custom metrics ────────────────────────────────────────────────────────────

const ragQueryDuration = new Trend("rag_query_duration");
const ragIngestDuration = new Trend("rag_ingest_duration");
const errorCount = new Counter("rag_errors");
const successRate = new Rate("rag_success_rate");

// ── Test data ────────────────────────────────────────────────────────────────

const SAMPLE_QUESTIONS = [
  "What is Retrieval-Augmented Generation?",
  "How does vector similarity search work?",
  "What are the benefits of using a RAG architecture?",
  "Explain the chunking strategy for document ingestion.",
  "What is hallucination detection in LLMs?",
];

const SAMPLE_DOCUMENTS = [
  {
    content:
      "RAG (Retrieval-Augmented Generation) combines retrieval-based and generative AI approaches.",
    source: "k6-test-rag-intro.md",
  },
  {
    content: "Vector embeddings convert text into high-dimensional numerical representations.",
    source: "k6-test-embeddings.md",
  },
];

// ── Helper functions ─────────────────────────────────────────────────────────

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeHeaders() {
  return { "Content-Type": "application/json" };
}

// ── Health check ─────────────────────────────────────────────────────────────

export function setup() {
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`Health check failed: ${res.status} ${res.body}`);
  }
  console.log(`✓ Server is healthy at ${BASE_URL}`);
  return { baseUrl: BASE_URL };
}

// ── Default scenario: RAG query ───────────────────────────────────────────────

export default function main() {
  const question = randomItem(SAMPLE_QUESTIONS);
  const startTime = Date.now();

  const res = http.post(
    `${BASE_URL}/api/query`,
    JSON.stringify({ question, topK: 5 }),
    { headers: makeHeaders() },
  );

  const duration = Date.now() - startTime;
  ragQueryDuration.add(duration);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "response has answer": (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.answer === "string";
      } catch {
        return false;
      }
    },
    "response time < 2500ms": () => duration < 2500,
  });

  successRate.add(ok);
  if (!ok) errorCount.add(1);

  sleep(1);
}

// ── Ingest scenario ───────────────────────────────────────────────────────────

export function ingestScenario() {
  const doc = randomItem(SAMPLE_DOCUMENTS);
  const startTime = Date.now();

  const res = http.post(
    `${BASE_URL}/api/ingest`,
    JSON.stringify(doc),
    { headers: makeHeaders() },
  );

  const duration = Date.now() - startTime;
  ragIngestDuration.add(duration);

  check(res, {
    "ingest status is 200 or 201": (r) => r.status === 200 || r.status === 201,
    "ingest response has fileId": (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.fileId === "string";
      } catch {
        return false;
      }
    },
  });

  sleep(2);
}

// ── Teardown ─────────────────────────────────────────────────────────────────

export function teardown() {
  console.log("✓ k6 load test completed");
}
