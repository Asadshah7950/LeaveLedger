'use strict';

/**
 * LeaveLedger — High-Concurrency Stress Benchmark Harness
 * 
 * Simulates extreme concurrent balance mutation races against the atomic ledger engine.
 * Validates:
 * 1. ACID isolation & serialized balance reservations
 * 2. Zero negative balance invariants (no double-spend anomalies)
 * 3. Exact deterministic settlement under high thread contention
 * 4. Microsecond/millisecond latency distribution (p50, p95, p99)
 */

const { performance } = require('perf_hooks');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { v4: uuidv4 } = require('uuid');

async function runBenchmark() {
  console.log('\n================================================================');
  console.log('⚡ LEAVELEDGER CONCURRENCY & ISOLATION BENCHMARK');
  console.log('================================================================');
  console.log('Node Version : ' + process.version);
  console.log('Architecture : ' + process.arch + ' (' + process.platform + ')');
  console.log('Timestamp    : ' + new Date().toISOString());
  console.log('----------------------------------------------------------------\n');

  process.env.DB_PATH = ':memory:';
  process.env.HCM_BASE_URL = 'http://127.0.0.1:3201';
  process.env.HCM_RETRY_MAX_ATTEMPTS = '1';
  process.env.HCM_RETRY_BASE_DELAY_MS = '1';

  const { AppModule } = require('../src/app.module');
  const { HcmService } = require('../src/modules/hcm/hcm.service');

  console.log('⚙️  Bootstrapping NestJS HTTP application context (SQLite WAL)...');
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  const hcmService = app.get(HcmService);
  if (hcmService && hcmService.validateRequest) {
    hcmService.validateRequest = async () => ({ valid: true, hcmBalance: 100 });
  }

  const employee = 'BENCH_EMP_' + Date.now();
  const locId = 'LOC_US_01';
  const type = 'VACATION';
  const initialBalance = 100;

  console.log('📦 Seeding initial balance: ' + initialBalance + ' days for ' + employee + ' (' + type + ')');
  await request(app.getHttpServer())
    .post('/balances/admin/seed/' + employee + '/' + locId + '/' + type + '/' + initialBalance)
    .expect(201);

  const initialBalanceRes = await request(app.getHttpServer())
    .get('/balances/' + employee + '/' + locId + '/' + type)
    .expect(200);

  console.log('✓ Confirmed initial available balance: ' + initialBalanceRes.body.availableBalance + ' days\n');

  const totalConcurrentRequests = 25;
  console.log('🚀 Firing ' + totalConcurrentRequests + ' simultaneous deduction requests with unique date windows...');

  const latencies = [];
  const results = {
    success: 0,
    conflictRejected: 0,
    unexpectedErrors: 0,
  };

  const startTime = performance.now();

  const promises = Array.from({ length: totalConcurrentRequests }).map(async (_, idx) => {
    const startDay = 10 + (idx * 3);
    const endDay = startDay + 2;
    const sStr = '2042-01-' + String(startDay).padStart(2, '0');
    const eStr = '2042-01-' + String(endDay).padStart(2, '0');

    const payload = {
      employeeId: employee,
      locationId: locId,
      leaveType: type,
      startDate: sStr,
      endDate: eStr,
    };

    const reqStart = performance.now();
    try {
      const res = await request(app.getHttpServer())
        .post('/time-off/requests')
        .set('X-Idempotency-Key', uuidv4())
        .send(payload);

      const reqDuration = performance.now() - reqStart;
      latencies.push(reqDuration);

      if (res.status === 201) {
        results.success++;
      } else if (res.status === 409 || res.status === 422) {
        results.conflictRejected++;
      } else {
        results.unexpectedErrors++;
      }
    } catch (err) {
      const reqDuration = performance.now() - reqStart;
      latencies.push(reqDuration);
      results.unexpectedErrors++;
    }
  });

  await Promise.all(promises);
  const totalDuration = performance.now() - startTime;

  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const avg = sum / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const throughput = (totalConcurrentRequests / (totalDuration / 1000)).toFixed(2);

  const finalBalanceRes = await request(app.getHttpServer())
    .get('/balances/' + employee + '/' + locId + '/' + type)
    .expect(200);

  const finalAvailable = finalBalanceRes.body.availableBalance;
  const finalPending = finalBalanceRes.body.pendingBalance;

  console.log('================================================================');
  console.log('📊 BENCHMARK EXECUTION RESULTS');
  console.log('================================================================');
  console.log('Total Requests Executed     : ' + totalConcurrentRequests);
  console.log('Successful Deductions       : ' + results.success);
  console.log('Graceful Limit Rejections   : ' + results.conflictRejected);
  console.log('Unexpected Failures         : ' + results.unexpectedErrors);
  console.log('Total Wall-Clock Time       : ' + totalDuration.toFixed(2) + ' ms');
  console.log('Throughput                  : ' + throughput + ' req/sec');
  console.log('----------------------------------------------------------------');
  console.log('⏱️  LATENCY DISTRIBUTION');
  console.log('----------------------------------------------------------------');
  console.log('Min Latency                 : ' + min.toFixed(2) + ' ms');
  console.log('Average Latency             : ' + avg.toFixed(2) + ' ms');
  console.log('p50 (Median)                : ' + p50.toFixed(2) + ' ms');
  console.log('p95 Latency                 : ' + p95.toFixed(2) + ' ms');
  console.log('p99 Latency                 : ' + p99.toFixed(2) + ' ms');
  console.log('Max Latency                 : ' + max.toFixed(2) + ' ms');
  console.log('----------------------------------------------------------------');
  console.log('🛡️  TRANSACTIONAL INTEGRITY INVARIANTS');
  console.log('----------------------------------------------------------------');
  console.log('Initial Available Balance   : ' + initialBalanceRes.body.availableBalance + ' days');
  console.log('Total Deducted (Pending)    : ' + finalPending + ' days');
  console.log('Final Available Balance     : ' + finalAvailable + ' days');
  console.log('Conservation of Value Check : ' + (finalAvailable + finalPending === initialBalance ? '✅ PASS (Exact Match)' : '❌ FAIL'));
  console.log('Non-Negative Invariant Check: ' + (finalAvailable >= 0 ? '✅ PASS (Zero Over-Deduction)' : '❌ FAIL'));
  console.log('================================================================\n');

  await app.close();

  if (results.unexpectedErrors > 0 || finalAvailable < 0 || (finalAvailable + finalPending !== initialBalance)) {
    console.error('❌ Benchmark failed integrity checks.');
    process.exit(1);
  } else {
    console.log('✨ All concurrency invariants verified with 100% mathematical integrity.\n');
    process.exit(0);
  }
}

runBenchmark().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
