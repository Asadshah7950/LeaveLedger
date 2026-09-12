'use strict';

const { HealthController } = require('../../src/modules/health/health.controller');

describe('HealthController (Unit)', () => {
  let controller;
  let mockDataSource;
  let mockHcmService;
  let mockResponse;

  beforeEach(() => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    mockHcmService = {
      getCircuitStatus: jest.fn().mockReturnValue({
        state: 'CLOSED',
        consecutiveFailures: 0,
        nextAttemptAt: null,
      }),
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    controller = new HealthController(mockDataSource, mockHcmService);
  });

  it('returns 200 OK with status UP when database and circuit breaker are healthy', async () => {
    await controller.getHealth(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'UP',
        details: expect.objectContaining({
          database: { status: 'UP', driver: 'sqlite' },
          hcmCircuitBreaker: expect.objectContaining({ state: 'CLOSED' }),
        }),
      }),
    );
  });

  it('returns 200 OK with status DEGRADED when HCM circuit breaker is OPEN', async () => {
    mockHcmService.getCircuitStatus.mockReturnValue({
      state: 'OPEN',
      consecutiveFailures: 5,
      nextAttemptAt: new Date().toISOString(),
    });

    await controller.getHealth(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DEGRADED',
      }),
    );
  });

  it('returns 503 SERVICE_UNAVAILABLE with status DOWN when database query fails', async () => {
    mockDataSource.query.mockRejectedValue(new Error('SQLITE_BUSY: database is locked'));

    await controller.getHealth(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DOWN',
        details: expect.objectContaining({
          database: expect.objectContaining({
            status: 'DOWN',
            error: 'SQLITE_BUSY: database is locked',
          }),
        }),
      }),
    );
  });

  describe('getLiveness', () => {
    it('returns 200 OK with status UP and uptimeSeconds', () => {
      controller.getLiveness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'UP',
          uptimeSeconds: expect.any(Number),
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('getReadiness', () => {
    it('returns 200 OK with READY when database is initialized and responsive', async () => {
      await controller.getReadiness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'UP',
          database: 'READY',
        }),
      );
    });

    it('returns 503 SERVICE_UNAVAILABLE when database is not initialized', async () => {
      mockDataSource.isInitialized = false;

      await controller.getReadiness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          database: 'UNAVAILABLE',
          error: 'Database connection is not initialized',
        }),
      );
    });

    it('returns 503 SERVICE_UNAVAILABLE when database query throws error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Connection lost'));

      await controller.getReadiness(mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          database: 'UNAVAILABLE',
          error: 'Connection lost',
        }),
      );
    });
  });

  describe('getMetrics', () => {
    it('returns 200 OK with Prometheus formatted text', () => {
      controller.getMetrics(mockResponse);

      expect(mockResponse.set).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4; charset=utf-8',
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('process_uptime_seconds'),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        expect.stringContaining('process_resident_memory_bytes'),
      );
    });
  });
});


