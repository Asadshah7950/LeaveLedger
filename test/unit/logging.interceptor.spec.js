'use strict';

const { of, throwError } = require('rxjs');
const { LoggingInterceptor } = require('../../src/common/interceptors/logging.interceptor');

describe('LoggingInterceptor (Unit)', () => {
  let interceptor;
  let mockExecutionContext;
  let mockRequest;
  let mockResponse;
  let mockCallHandler;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();

    mockRequest = {
      headers: {},
      method: 'GET',
      url: '/health',
    };

    mockResponse = {
      statusCode: 200,
      setHeader: jest.fn(),
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: 'ok' })),
    };
  });

  it('generates a new UUID for X-Request-ID and X-Correlation-ID when not provided', (done) => {
    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (val) => {
        expect(val).toEqual({ data: 'ok' });
        expect(mockRequest.requestId).toBeDefined();
        expect(mockRequest.correlationId).toBeDefined();
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', mockRequest.requestId);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', mockRequest.correlationId);
        done();
      },
    });
  });

  it('preserves incoming X-Correlation-ID from upstream gateway headers', (done) => {
    mockRequest.headers['x-correlation-id'] = 'gw-corr-999';

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: () => {
        expect(mockRequest.correlationId).toBe('gw-corr-999');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'gw-corr-999');
        done();
      },
    });
  });

  it('logs error event and propagates exception on downstream error', (done) => {
    mockCallHandler.handle.mockReturnValue(throwError(() => new Error('Service failure')));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      error: (err) => {
        expect(err.message).toBe('Service failure');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
        done();
      },
    });
  });
});
