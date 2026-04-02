/**
 * Network Simulator for Testing Offline Sync Robustness
 * Simulates various network conditions to test sync reliability
 */

export interface NetworkCondition {
  name: string;
  online: boolean;
  latency?: number;
  bandwidth?: number;
  errorRate?: number;
  timeoutRate?: number;
}

export interface NetworkPattern {
  name: string;
  conditions: Array<{
    condition: NetworkCondition;
    duration: number; // milliseconds
  }>;
  repeat?: boolean;
}

export class NetworkSimulator {
  private static instance: NetworkSimulator;
  private originalFetch: typeof fetch;
  private currentCondition: NetworkCondition | null = null;
  private patternTimer: NodeJS.Timeout | null = null;
  private requestCount = 0;
  private errorCount = 0;
  private timeoutCount = 0;

  private constructor() {
    this.originalFetch = window.fetch;
  }

  static getInstance(): NetworkSimulator {
    if (!NetworkSimulator.instance) {
      NetworkSimulator.instance = new NetworkSimulator();
    }
    return NetworkSimulator.instance;
  }

  /**
   * Predefined network conditions
   */
  static CONDITIONS = {
    PERFECT: {
      name: 'Perfect',
      online: true,
      latency: 10,
      bandwidth: 1000000, // 1Mbps
      errorRate: 0,
      timeoutRate: 0
    },
    GOOD_WIFI: {
      name: 'Good WiFi',
      online: true,
      latency: 50,
      bandwidth: 500000, // 500Kbps
      errorRate: 0.01,
      timeoutRate: 0.01
    },
    POOR_WIFI: {
      name: 'Poor WiFi',
      online: true,
      latency: 200,
      bandwidth: 100000, // 100Kbps
      errorRate: 0.05,
      timeoutRate: 0.05
    },
    MOBILE_3G: {
      name: 'Mobile 3G',
      online: true,
      latency: 300,
      bandwidth: 50000, // 50Kbps
      errorRate: 0.1,
      timeoutRate: 0.1
    },
    FLAKY_CONNECTION: {
      name: 'Flaky Connection',
      online: true,
      latency: 500,
      bandwidth: 20000, // 20Kbps
      errorRate: 0.2,
      timeoutRate: 0.15
    },
    OFFLINE: {
      name: 'Offline',
      online: false
    }
  } as const;

  /**
   * Predefined network patterns
   */
  static PATTERNS: Record<string, NetworkPattern> = {
    INTERMITTENT: {
      name: 'Intermittent Connection',
      conditions: [
        { condition: NetworkSimulator.CONDITIONS.GOOD_WIFI, duration: 30000 },
        { condition: NetworkSimulator.CONDITIONS.OFFLINE, duration: 10000 }
      ],
      repeat: true
    },
    DEGRADING: {
      name: 'Degrading Connection',
      conditions: [
        { condition: NetworkSimulator.CONDITIONS.PERFECT, duration: 10000 },
        { condition: NetworkSimulator.CONDITIONS.GOOD_WIFI, duration: 10000 },
        { condition: NetworkSimulator.CONDITIONS.POOR_WIFI, duration: 10000 },
        { condition: NetworkSimulator.CONDITIONS.MOBILE_3G, duration: 10000 },
        { condition: NetworkSimulator.CONDITIONS.OFFLINE, duration: 20000 }
      ],
      repeat: false
    },
    PEAK_HOURS: {
      name: 'Peak Hours Congestion',
      conditions: [
        { condition: NetworkSimulator.CONDITIONS.POOR_WIFI, duration: 45000 },
        { condition: NetworkSimulator.CONDITIONS.GOOD_WIFI, duration: 15000 }
      ],
      repeat: true
    }
  };

  /**
   * Start simulating a specific network condition
   */
  startCondition(condition: NetworkCondition): void {
    console.log(`[NetworkSimulator] Starting condition: ${condition.name}`);
    this.currentCondition = condition;
    this.resetStats();
    this.interceptFetch();
  }

  /**
   * Start simulating a network pattern
   */
  startPattern(pattern: NetworkPattern): void {
    console.log(`[NetworkSimulator] Starting pattern: ${pattern.name}`);
    this.stopPattern();
    
    let currentIndex = 0;
    
    const executePattern = () => {
      if (currentIndex >= pattern.conditions.length) {
        if (pattern.repeat) {
          currentIndex = 0;
        } else {
          console.log(`[NetworkSimulator] Pattern ${pattern.name} completed`);
          return;
        }
      }

      const step = pattern.conditions[currentIndex];
      this.startCondition(step.condition);
      
      this.patternTimer = setTimeout(() => {
        currentIndex++;
        executePattern();
      }, step.duration);
    };

    executePattern();
  }

  /**
   * Stop current pattern
   */
  stopPattern(): void {
    if (this.patternTimer) {
      clearTimeout(this.patternTimer);
      this.patternTimer = null;
    }
  }

  /**
   * Stop all simulation and restore normal network
   */
  stop(): void {
    console.log('[NetworkSimulator] Stopping simulation');
    this.stopPattern();
    this.currentCondition = null;
    this.restoreFetch();
  }

  /**
   * Get current network statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      timeoutCount: this.timeoutCount,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      timeoutRate: this.requestCount > 0 ? this.timeoutCount / this.requestCount : 0,
      currentCondition: this.currentCondition?.name || 'Normal'
    };
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.timeoutCount = 0;
  }

  /**
   * Intercept fetch requests to simulate network conditions
   */
  private interceptFetch(): void {
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      this.requestCount++;

      // If offline, reject immediately
      if (!this.currentCondition?.online) {
        throw new Error('Network request failed: Offline');
      }

      const condition = this.currentCondition!;

      // Simulate timeout
      if (condition.timeoutRate && Math.random() < condition.timeoutRate) {
        this.timeoutCount++;
        throw new Error('Network request failed: Timeout');
      }

      // Simulate network errors
      if (condition.errorRate && Math.random() < condition.errorRate) {
        this.errorCount++;
        throw new Error('Network request failed: Connection error');
      }

      // Simulate latency
      if (condition.latency) {
        await new Promise(resolve => setTimeout(resolve, condition.latency));
      }

      // Make actual request
      try {
        const response = await this.originalFetch(input, init);
        
        // Simulate server errors occasionally
        if (condition.errorRate && Math.random() < condition.errorRate * 0.3) {
          this.errorCount++;
          return new Response(null, { status: 500, statusText: 'Internal Server Error' });
        }

        return response;
      } catch (error) {
        this.errorCount++;
        throw error;
      }
    };
  }

  /**
   * Restore original fetch function
   */
  private restoreFetch(): void {
    window.fetch = this.originalFetch;
  }
}

/**
 * Utility functions for testing
 */
export class NetworkTestUtils {
  /**
   * Test sync robustness under specific network condition
   */
  static async testSyncUnderCondition(
    condition: NetworkCondition,
    testDuration: number,
    operations: () => Promise<void>
  ): Promise<{
    success: boolean;
    stats: ReturnType<NetworkSimulator['getStats']>;
    errors: string[];
  }> {
    const simulator = NetworkSimulator.getInstance();
    const errors: string[] = [];

    try {
      simulator.startCondition(condition);
      
      // Run test operations
      await operations();
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration));
      
      const stats = simulator.getStats();
      
      return {
        success: true,
        stats,
        errors
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        stats: simulator.getStats(),
        errors
      };
    } finally {
      simulator.stop();
    }
  }

  /**
   * Test sync robustness under network pattern
   */
  static async testSyncUnderPattern(
    pattern: NetworkPattern,
    operations: () => Promise<void>
  ): Promise<{
    success: boolean;
    stats: ReturnType<NetworkSimulator['getStats']>;
    errors: string[];
  }> {
    const simulator = NetworkSimulator.getInstance();
    const errors: string[] = [];

    try {
      simulator.startPattern(pattern);
      
      // Run test operations
      await operations();
      
      // Calculate total pattern duration
      const totalDuration = pattern.conditions.reduce((sum, step) => sum + step.duration, 0);
      await new Promise(resolve => setTimeout(resolve, totalDuration));
      
      const stats = simulator.getStats();
      
      return {
        success: true,
        stats,
        errors
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        stats: simulator.getStats(),
        errors
      };
    } finally {
      simulator.stop();
    }
  }

  /**
   * Simulate "Black Friday" scenario
   */
  static async simulateHighVolumeDay(): Promise<void> {
    const simulator = NetworkSimulator.getInstance();
    
    // Start with degrading network pattern
    simulator.startPattern(NetworkSimulator.PATTERNS.DEGRADING);
    
    console.log('[NetworkTestUtils] Starting Black Friday simulation...');
    console.log('- High volume sales expected');
    console.log('- Network will degrade over time');
    console.log('- Test will run for 5 minutes');
    
    // Let it run for 5 minutes
    await new Promise(resolve => setTimeout(resolve, 300000));
    
    simulator.stop();
    console.log('[NetworkTestUtils] Black Friday simulation complete');
  }
}

// Export singleton instance for easy access
export const networkSimulator = NetworkSimulator.getInstance();
