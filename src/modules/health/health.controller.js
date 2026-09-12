'use strict';

const { Controller, Get, Res, HttpStatus, Inject } = require('@nestjs/common');
const { DataSource } = require('typeorm');
const { HcmService } = require('../hcm/hcm.service');

@Controller('health')
class HealthController {
  constructor(dataSource, hcmService) {
    this.dataSource = dataSource;
    this.hcmService = hcmService;
  }

  @Get('live')
  getLiveness(res) {
    return res.status(HttpStatus.OK).json({
      status: 'UP',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }

  @Get('ready')
  async getReadiness(res) {
    let dbStatus = 'READY';
    let dbError = null;

    try {
      if (!this.dataSource || !this.dataSource.isInitialized) {
        dbStatus = 'UNAVAILABLE';
        dbError = 'Database connection is not initialized';
      } else {
        await this.dataSource.query('SELECT 1');
      }
    } catch (err) {
      dbStatus = 'UNAVAILABLE';
      dbError = err.message;
    }

    const isReady = dbStatus === 'READY';
    const httpStatus = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(httpStatus).json({
      status: isReady ? 'UP' : 'DOWN',
      database: dbStatus,
      ...(dbError ? { error: dbError } : {}),
      timestamp: new Date().toISOString(),
    });
  }

  @Get('metrics')
  getMetrics(res) {
    const mem = process.memoryUsage();
    const uptime = Math.floor(process.uptime());
    const payload = [
      '# HELP process_uptime_seconds Process uptime in seconds.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${uptime}`,
      '',
      '# HELP process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${mem.rss}`,
      '',
      '# HELP process_heap_bytes Process heap bytes.',
      '# TYPE process_heap_bytes gauge',
      `process_heap_bytes ${mem.heapUsed}`,
      '',
      '# HELP process_heap_total_bytes Process heap total bytes.',
      '# TYPE process_heap_total_bytes gauge',
      `process_heap_total_bytes ${mem.heapTotal}`,
      '',
    ].join('\n');

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.status(HttpStatus.OK).send(payload);
  }

  @Get()
  async getHealth(res) {
    let dbStatus = 'UP';
    let dbError = null;

    try {
      if (!this.dataSource || !this.dataSource.isInitialized) {
        dbStatus = 'DOWN';
        dbError = 'Database connection is not initialized';
      } else {
        await this.dataSource.query('SELECT 1');
      }
    } catch (err) {
      dbStatus = 'DOWN';
      dbError = err.message;
    }

    const circuitStatus = this.hcmService ? this.hcmService.getCircuitStatus() : null;
    const isCircuitOpen = circuitStatus && circuitStatus.state === 'OPEN';

    let overallStatus = 'UP';
    let httpStatus = HttpStatus.OK;

    if (dbStatus === 'DOWN') {
      overallStatus = 'DOWN';
      httpStatus = HttpStatus.SERVICE_UNAVAILABLE;
    } else if (isCircuitOpen) {
      overallStatus = 'DEGRADED';
      httpStatus = HttpStatus.OK;
    }

    const mem = process.memoryUsage();
    const memoryDetails = {
      rssMb: +(mem.rss / 1024 / 1024).toFixed(2),
      heapUsedMb: +(mem.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMb: +(mem.heapTotal / 1024 / 1024).toFixed(2),
    };

    return res.status(httpStatus).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      details: {
        database: {
          status: dbStatus,
          driver: 'sqlite',
          ...(dbError ? { error: dbError } : {}),
        },
        hcmCircuitBreaker: circuitStatus,
        memory: memoryDetails,
      },
    });
  }
}

Res()(HealthController.prototype, 'getHealth', 0);
Res()(HealthController.prototype, 'getLiveness', 0);
Res()(HealthController.prototype, 'getReadiness', 0);
Res()(HealthController.prototype, 'getMetrics', 0);
Inject(DataSource)(HealthController, undefined, 0);
Inject(HcmService)(HealthController, undefined, 1);

module.exports = { HealthController };
