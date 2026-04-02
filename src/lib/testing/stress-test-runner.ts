/**
 * Stress Test Runner for Offline Sync Robustness
 * Simulates high-volume scenarios to test system limits
 */

import { OutboxSyncService } from "@/lib/services/outbox-sync";
import { dataIntegrityChecker } from "./data-integrity-checker";
import { networkSimulator, NetworkCondition } from "./network-simulator";

export interface StressTestConfig {
  name: string;
  duration: number; // milliseconds
  operations: {
    receiptsPerMinute: number;
    itemsPerReceipt: number;
    modifierUsageRate: number; // 0-1
    concurrentUsers: number;
  };
  network: NetworkCondition;
  expectedOutcomes: {
    maxSyncTime: number;
    maxOutboxSize: number;
    maxMemoryUsage: number;
    zeroDataLoss: boolean;
  };
}

export interface StressTestResult {
  config: StressTestConfig;
  success: boolean;
  duration: number;
  metrics: {
    receiptsCreated: number;
    syncSuccessRate: number;
    avgSyncTime: number;
    maxOutboxSize: number;
    memoryUsage: number;
    networkStats: any;
  };
  violations: string[];
  errors: string[];
}

export class StressTestRunner {
  private static instance: StressTestRunner;
  private isRunning = false;
  private currentTest: string | null = null;

  static getInstance(): StressTestRunner {
    if (!StressTestRunner.instance) {
      StressTestRunner.instance = new StressTestRunner();
    }
    return StressTestRunner.instance;
  }

  /**
   * Predefined stress test scenarios
   */
  static SCENARIOS: Record<string, StressTestConfig> = {
    BLACK_FRIDAY: {
      name: 'Black Friday Peak Load',
      duration: 300000, // 5 minutes
      operations: {
        receiptsPerMinute: 120,
        itemsPerReceipt: 8,
        modifierUsageRate: 0.6,
        concurrentUsers: 3
      },
      network: {
        name: 'Poor WiFi',
        online: true,
        latency: 200,
        bandwidth: 100000,
        errorRate: 0.1,
        timeoutRate: 0.05
      },
      expectedOutcomes: {
        maxSyncTime: 30000,
        maxOutboxSize: 100,
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        zeroDataLoss: true
      }
    },

    NETWORK_HELL: {
      name: 'Extreme Network Conditions',
      duration: 180000, // 3 minutes
      operations: {
        receiptsPerMinute: 60,
        itemsPerReceipt: 5,
        modifierUsageRate: 0.4,
        concurrentUsers: 2
      },
      network: {
        name: 'Flaky Connection',
        online: true,
        latency: 500,
        bandwidth: 20000,
        errorRate: 0.3,
        timeoutRate: 0.2
      },
      expectedOutcomes: {
        maxSyncTime: 60000,
        maxOutboxSize: 200,
        maxMemoryUsage: 150 * 1024 * 1024, // 150MB
        zeroDataLoss: true
      }
    },

    MEMORY_PRESSURE: {
      name: 'High Memory Pressure',
      duration: 240000, // 4 minutes
      operations: {
        receiptsPerMinute: 80,
        itemsPerReceipt: 12,
        modifierUsageRate: 0.8,
        concurrentUsers: 1
      },
      network: {
        name: 'Good WiFi',
        online: true,
        latency: 50,
        bandwidth: 500000,
        errorRate: 0.02,
        timeoutRate: 0.01
      },
      expectedOutcomes: {
        maxSyncTime: 20000,
        maxOutboxSize: 50,
        maxMemoryUsage: 200 * 1024 * 1024, // 200MB
        zeroDataLoss: true
      }
    },

    EXTENDED_OFFLINE: {
      name: 'Extended Offline Period',
      duration: 600000, // 10 minutes
      operations: {
        receiptsPerMinute: 40,
        itemsPerReceipt: 6,
        modifierUsageRate: 0.5,
        concurrentUsers: 1
      },
      network: {
        name: 'Offline',
        online: false
      },
      expectedOutcomes: {
        maxSyncTime: 0, // No sync while offline
        maxOutboxSize: 500,
        maxMemoryUsage: 80 * 1024 * 1024, // 80MB
        zeroDataLoss: true
      }
    }
  };

  /**
   * Run a specific stress test scenario
   */
  async runScenario(scenarioName: string): Promise<StressTestResult> {
    const config = StressTestRunner.SCENARIOS[scenarioName];
    if (!config) {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }

    return this.runStressTest(config);
  }

  /**
   * Run a custom stress test
   */
  async runStressTest(config: StressTestConfig): Promise<StressTestResult> {
    if (this.isRunning) {
      throw new Error('Another stress test is already running');
    }

    this.isRunning = true;
    this.currentTest = config.name;

    console.log(`[StressTestRunner] Starting stress test: ${config.name}`);
    console.log(`[StressTestRunner] Duration: ${config.duration / 1000}s`);
    console.log(`[StressTestRunner] Target: ${config.operations.receiptsPerMinute} receipts/min`);

    const startTime = Date.now();
    const result: StressTestResult = {
      config,
      success: false,
      duration: 0,
      metrics: {
        receiptsCreated: 0,
        syncSuccessRate: 0,
        avgSyncTime: 0,
        maxOutboxSize: 0,
        memoryUsage: 0,
        networkStats: {}
      },
      violations: [],
      errors: []
    };

    try {
      // Start network simulation
      networkSimulator.startCondition(config.network);

      // Run the stress test
      await this.executeStressTest(config, result);

      // Calculate final metrics
      result.duration = Date.now() - startTime;
      result.success = result.violations.length === 0 && result.errors.length === 0;

      console.log(`[StressTestRunner] Test completed: ${result.success ? 'PASS' : 'FAIL'}`);
      console.log(`[StressTestRunner] Receipts created: ${result.metrics.receiptsCreated}`);
      console.log(`[StressTestRunner] Violations: ${result.violations.length}`);

    } catch (error) {
      result.errors.push(`Test execution failed: ${error}`);
      console.error(`[StressTestRunner] Test failed:`, error);
    } finally {
      // Cleanup
      networkSimulator.stop();
      this.isRunning = false;
      this.currentTest = null;
    }

    return result;
  }

  /**
   * Run all predefined scenarios
   */
  async runAllScenarios(): Promise<Record<string, StressTestResult>> {
    const results: Record<string, StressTestResult> = {};

    for (const scenarioName of Object.keys(StressTestRunner.SCENARIOS)) {
      console.log(`[StressTestRunner] Running scenario: ${scenarioName}`);
      
      try {
        results[scenarioName] = await this.runScenario(scenarioName);
        
        // Wait between tests to allow cleanup
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (error) {
        console.error(`[StressTestRunner] Scenario ${scenarioName} failed:`, error);
        results[scenarioName] = {
          config: StressTestRunner.SCENARIOS[scenarioName],
          success: false,
          duration: 0,
          metrics: {
            receiptsCreated: 0,
            syncSuccessRate: 0,
            avgSyncTime: 0,
            maxOutboxSize: 0,
            memoryUsage: 0,
            networkStats: {}
          },
          violations: [],
          errors: [`Failed to run scenario: ${error}`]
        };
      }
    }

    return results;
  }

  /**
   * Check if a stress test is currently running
   */
  isTestRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current test name
   */
  getCurrentTest(): string | null {
    return this.currentTest;
  }

  /**
   * Execute the actual stress test operations
   */
  private async executeStressTest(config: StressTestConfig, result: StressTestResult): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + config.duration;
    
    const receiptInterval = 60000 / config.operations.receiptsPerMinute; // ms between receipts
    const workers: Promise<void>[] = [];

    // Start concurrent workers
    for (let i = 0; i < config.operations.concurrentUsers; i++) {
      workers.push(this.runWorker(i, config, result, endTime, receiptInterval));
    }

    // Start monitoring
    const monitoringPromise = this.monitorTestProgress(config, result, endTime);

    // Wait for all workers and monitoring to complete
    await Promise.all([...workers, monitoringPromise]);
  }

  /**
   * Run a single worker that creates receipts
   */
  private async runWorker(
    workerId: number,
    config: StressTestConfig,
    result: StressTestResult,
    endTime: number,
    receiptInterval: number
  ): Promise<void> {
    console.log(`[StressTestRunner] Worker ${workerId} started`);

    while (Date.now() < endTime) {
      try {
        // Create a receipt
        const receipt = this.generateTestReceipt(config);
        
        // Save to outbox (simulating offline sale)
        await OutboxSyncService.addToOutbox('receipt', receipt, receipt.org_id, false);
        
        result.metrics.receiptsCreated++;

        // Wait before next receipt
        await new Promise(resolve => setTimeout(resolve, receiptInterval));

      } catch (error) {
        result.errors.push(`Worker ${workerId} error: ${error}`);
        console.error(`[StressTestRunner] Worker ${workerId} error:`, error);
      }
    }

    console.log(`[StressTestRunner] Worker ${workerId} completed`);
  }

  /**
   * Monitor test progress and collect metrics
   */
  private async monitorTestProgress(
    config: StressTestConfig,
    result: StressTestResult,
    endTime: number
  ): Promise<void> {
    const monitorInterval = 5000; // Check every 5 seconds

    while (Date.now() < endTime) {
      try {
        // Check outbox size
        const outboxCounts = await OutboxSyncService.getOutboxCount();
        result.metrics.maxOutboxSize = Math.max(result.metrics.maxOutboxSize, outboxCounts.total);

        // Check memory usage
        const memoryStats = await dataIntegrityChecker.measureMemoryUsage();
        result.metrics.memoryUsage = Math.max(result.metrics.memoryUsage, memoryStats.used);

        // Check for violations
        this.checkViolations(config, result, outboxCounts, memoryStats);

        // Get network stats
        result.metrics.networkStats = networkSimulator.getStats();

        await new Promise(resolve => setTimeout(resolve, monitorInterval));

      } catch (error) {
        result.errors.push(`Monitoring error: ${error}`);
      }
    }

    // Final sync attempt and measurements
    try {
      const syncStartTime = Date.now();
      await OutboxSyncService.syncOutbox();
      const syncTime = Date.now() - syncStartTime;
      
      result.metrics.avgSyncTime = syncTime;

      // Check final outbox state
      const finalCounts = await OutboxSyncService.getOutboxCount();
      if (finalCounts.failed > 0 && config.expectedOutcomes.zeroDataLoss) {
        result.violations.push(`${finalCounts.failed} items failed to sync (zero data loss required)`);
      }

      result.metrics.syncSuccessRate = finalCounts.total > 0 
        ? (finalCounts.total - finalCounts.failed) / finalCounts.total 
        : 1;

    } catch (error) {
      result.errors.push(`Final sync failed: ${error}`);
    }
  }

  /**
   * Check for violations of expected outcomes
   */
  private checkViolations(
    config: StressTestConfig,
    result: StressTestResult,
    outboxCounts: any,
    memoryStats: any
  ): void {
    const { expectedOutcomes } = config;

    if (outboxCounts.total > expectedOutcomes.maxOutboxSize) {
      result.violations.push(`Outbox size exceeded limit: ${outboxCounts.total} > ${expectedOutcomes.maxOutboxSize}`);
    }

    if (memoryStats.used > expectedOutcomes.maxMemoryUsage) {
      result.violations.push(`Memory usage exceeded limit: ${memoryStats.used} > ${expectedOutcomes.maxMemoryUsage}`);
    }
  }

  /**
   * Generate a test receipt with realistic data
   */
  private generateTestReceipt(config: StressTestConfig): any {
    const receiptId = `test-receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const orgId = 'test-org-id'; // Should be configurable
    
    const lines = [];
    let totalAmount = 0;

    for (let i = 0; i < config.operations.itemsPerReceipt; i++) {
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = Math.round((Math.random() * 20 + 5) * 100) / 100; // £5-£25
      const lineTotal = quantity * unitPrice;
      
      const line: any = {
        item_id: `test-item-${i}`,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        modifiers: []
      };

      // Add modifiers based on usage rate
      if (Math.random() < config.operations.modifierUsageRate) {
        const modifier = {
          modifier_id: `test-modifier-${i}`,
          name: `Test Modifier ${i}`,
          price_adjustment: Math.round(Math.random() * 200) / 100 // £0-£2
        };
        line.modifiers = [modifier];
        line.line_total += modifier.price_adjustment;
      }

      lines.push(line);
      totalAmount += line.line_total;
    }

    return {
      id: receiptId,
      org_id: orgId,
      register_id: 'test-register',
      total_amount: Math.round(totalAmount * 100) / 100,
      payment_method: 'cash',
      created_at: new Date().toISOString(),
      lines
    };
  }
}

// Export singleton instance
export const stressTestRunner = StressTestRunner.getInstance();
