// ================================
// PERFORMANCE MONITORING
// ================================

// utils/performanceMonitor.ts  
interface PerformanceMetrics {
  count: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
}

export class PerformanceMonitor {
  private static metrics: { [key: string]: number[] } = {};
  private static readonly MAX_SAMPLES = 100;

  static startTimer(operation: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric(operation, duration);
    };
  }

  static recordMetric(operation: string, value: number) {
    if (!this.metrics[operation]) {
      this.metrics[operation] = [];
    }

    this.metrics[operation].push(value);

    // Keep only recent samples
    if (this.metrics[operation].length > this.MAX_SAMPLES) {
      this.metrics[operation].shift();
    }

    // Log slow operations
    if (value > 10000) { // 10 seconds
      console.warn(`Slow operation detected: ${operation} took ${value}ms`);
    }
  }

  static getMetrics(): { [key: string]: PerformanceMetrics } {
    const summary: { [key: string]: PerformanceMetrics } = {};

    for (const [operation, values] of Object.entries(this.metrics)) {
      if (values.length === 0) continue;

      const sorted = values.slice().sort((a, b) => a - b);
      summary[operation] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    }

    return summary;
  }

  static monitorOCRPerformance() {
    // Monitor OCR-specific metrics
    if (typeof window !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes('tesseract') || entry.name.includes('ocr')) {
            this.recordMetric('ocr_processing', entry.duration);
          }
        }
      });

      observer.observe({ entryTypes: ['measure'] });
    }
  }

  static exportMetrics() {
    const metrics = this.getMetrics();
    const timestamp = new Date().toISOString();
    
    return {
      timestamp,
      metrics,
      systemInfo: {
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
        memory: typeof window !== 'undefined' && (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : null,
        connection: typeof window !== 'undefined' && (navigator as any).connection ? {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt
        } : null
      }
    };
  }
}