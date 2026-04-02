/**
 * Manual Test Runner for Offline Sync Robustness
 * Console-based testing without UI dependencies
 */

import { dataIntegrityChecker } from './data-integrity-checker';
import { networkSimulator, NetworkSimulator } from './network-simulator';
import { stressTestRunner } from './stress-test-runner';
import { OutboxSyncService } from '@/lib/services/outbox-sync';

export class ManualTestRunner {
  private static instance: ManualTestRunner;

  static getInstance(): ManualTestRunner {
    if (!ManualTestRunner.instance) {
      ManualTestRunner.instance = new ManualTestRunner();
    }
    return ManualTestRunner.instance;
  }

  /**
   * Run comprehensive offline sync robustness test
   */
  async runFullRobustnessTest(): Promise<void> {
    console.log('🧪 Starting Comprehensive Offline Sync Robustness Test');
    console.log('=' .repeat(60));

    const results = {
      dataIntegrity: false,
      outboxConsistency: false,
      modifierConsistency: false,
      blackFridayStress: false,
      networkHellStress: false,
      extendedOfflineStress: false,
      memoryPressureStress: false
    };

    try {
      // Phase 1: Data Integrity Checks
      console.log('\n📊 Phase 1: Data Integrity Checks');
      console.log('-'.repeat(40));
      
      const integrityResult = await dataIntegrityChecker.checkIndexedDBConsistency();
      results.dataIntegrity = integrityResult.valid;
      this.logTestResult('IndexedDB Integrity', integrityResult.valid, integrityResult.errors);

      const outboxResult = await dataIntegrityChecker.checkOutboxIntegrity();
      results.outboxConsistency = outboxResult.valid;
      this.logTestResult('Outbox Consistency', outboxResult.valid, outboxResult.errors);

      const modifierResult = await dataIntegrityChecker.checkModifierConsistency();
      results.modifierConsistency = modifierResult.valid;
      this.logTestResult('Modifier Consistency', modifierResult.valid, modifierResult.errors);

      // Phase 2: Performance Monitoring
      console.log('\n⚡ Phase 2: Performance Monitoring');
      console.log('-'.repeat(40));
      
      const memoryStats = await dataIntegrityChecker.measureMemoryUsage();
      const storageStats = await dataIntegrityChecker.measureStorageUsage();
      
      console.log(`Memory Usage: ${this.formatBytes(memoryStats.used)} (${memoryStats.percentage.toFixed(1)}%)`);
      console.log(`Storage Usage: ${this.formatBytes(storageStats.totalSize)}`);
      console.log(`IndexedDB Size: ${this.formatBytes(storageStats.indexedDBSize)}`);
      console.log(`Storage Quota: ${this.formatBytes(storageStats.quota)}`);

      // Phase 3: Stress Testing
      console.log('\n🔥 Phase 3: Stress Testing');
      console.log('-'.repeat(40));

      // Black Friday scenario
      console.log('\nRunning Black Friday scenario...');
      const blackFridayResult = await stressTestRunner.runScenario('BLACK_FRIDAY');
      results.blackFridayStress = blackFridayResult.success;
      this.logStressTestResult('Black Friday', blackFridayResult);

      // Network Hell scenario
      console.log('\nRunning Network Hell scenario...');
      const networkHellResult = await stressTestRunner.runScenario('NETWORK_HELL');
      results.networkHellStress = networkHellResult.success;
      this.logStressTestResult('Network Hell', networkHellResult);

      // Extended Offline scenario
      console.log('\nRunning Extended Offline scenario...');
      const extendedOfflineResult = await stressTestRunner.runScenario('EXTENDED_OFFLINE');
      results.extendedOfflineStress = extendedOfflineResult.success;
      this.logStressTestResult('Extended Offline', extendedOfflineResult);

      // Memory Pressure scenario
      console.log('\nRunning Memory Pressure scenario...');
      const memoryPressureResult = await stressTestRunner.runScenario('MEMORY_PRESSURE');
      results.memoryPressureStress = memoryPressureResult.success;
      this.logStressTestResult('Memory Pressure', memoryPressureResult);

      // Final Summary
      console.log('\n📋 Test Summary');
      console.log('=' .repeat(60));
      
      const passedTests = Object.values(results).filter(Boolean).length;
      const totalTests = Object.keys(results).length;
      
      console.log(`Overall Result: ${passedTests}/${totalTests} tests passed`);
      console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
      
      if (passedTests === totalTests) {
        console.log('🎉 ALL TESTS PASSED - System is robust!');
      } else {
        console.log('⚠️  Some tests failed - Review results above');
      }

      // Detailed results
      console.log('\nDetailed Results:');
      Object.entries(results).forEach(([test, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${this.formatTestName(test)}`);
      });

    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  /**
   * Run quick daily robustness check (5 minutes)
   */
  async runDailyCheck(): Promise<void> {
    console.log('🔍 Daily Robustness Check');
    console.log('=' .repeat(30));

    try {
      // 1. Cache verification
      console.log('\n1. Cache Verification...');
      const integrityResult = await dataIntegrityChecker.checkIndexedDBConsistency();
      this.logTestResult('Cache Integrity', integrityResult.valid, integrityResult.errors);

      // 2. Outbox status
      console.log('\n2. Outbox Status...');
      const outboxCounts = await OutboxSyncService.getOutboxCount();
      console.log(`Pending: ${outboxCounts.pending}, Failed: ${outboxCounts.failed}, Total: ${outboxCounts.total}`);
      
      if (outboxCounts.failed > 0) {
        console.log('⚠️  Warning: Failed sync items detected');
      }

      // 3. Performance check
      console.log('\n3. Performance Check...');
      const memoryStats = await dataIntegrityChecker.measureMemoryUsage();
      const storageStats = await dataIntegrityChecker.measureStorageUsage();
      
      console.log(`Memory: ${memoryStats.percentage.toFixed(1)}% (${this.formatBytes(memoryStats.used)})`);
      console.log(`Storage: ${this.formatBytes(storageStats.totalSize)}`);

      // 4. Quick offline test
      console.log('\n4. Quick Offline Test...');
      await this.runQuickOfflineTest();

      console.log('\n✅ Daily check complete');

    } catch (error) {
      console.error('❌ Daily check failed:', error);
    }
  }

  /**
   * Test network failure scenarios
   */
  async runNetworkFailureTests(): Promise<void> {
    console.log('🌐 Network Failure Tests');
    console.log('=' .repeat(30));

    const scenarios = [
      { name: 'Poor WiFi', condition: NetworkSimulator.CONDITIONS.POOR_WIFI },
      { name: 'Mobile 3G', condition: NetworkSimulator.CONDITIONS.MOBILE_3G },
      { name: 'Flaky Connection', condition: NetworkSimulator.CONDITIONS.FLAKY_CONNECTION },
      { name: 'Offline', condition: NetworkSimulator.CONDITIONS.OFFLINE }
    ];

    for (const scenario of scenarios) {
      console.log(`\nTesting: ${scenario.name}`);
      
      try {
        // Start network simulation
        networkSimulator.startCondition(scenario.condition);
        
        // Create test receipt
        const receipt = this.generateTestReceipt();
        await OutboxSyncService.addToOutbox('receipt', receipt, receipt.org_id, false);
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check outbox
        const counts = await OutboxSyncService.getOutboxCount();
        console.log(`  Outbox after test: ${counts.pending} pending, ${counts.failed} failed`);
        
        // Stop simulation
        networkSimulator.stop();
        
        // Try to sync
        await OutboxSyncService.syncOutbox();
        
        const finalCounts = await OutboxSyncService.getOutboxCount();
        const success = finalCounts.pending === 0 && finalCounts.failed === 0;
        
        console.log(`  Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
        
      } catch (error) {
        console.error(`  Error: ${error}`);
        networkSimulator.stop();
      }
    }
  }

  /**
   * Simulate data corruption and test recovery
   */
  async runCorruptionRecoveryTest(): Promise<void> {
    console.log('🔧 Corruption Recovery Test');
    console.log('=' .repeat(30));

    try {
      // TODO: Implement corruption simulation
      console.log('Corruption recovery tests not yet implemented');
      
    } catch (error) {
      console.error('❌ Corruption test failed:', error);
    }
  }

  /**
   * Monitor sync performance over time
   */
  async runPerformanceMonitoring(durationMinutes: number = 10): Promise<void> {
    console.log(`⏱️  Performance Monitoring (${durationMinutes} minutes)`);
    console.log('=' .repeat(40));

    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);
    const measurements: any[] = [];

    while (Date.now() < endTime) {
      try {
        const timestamp = new Date().toISOString();
        const memoryStats = await dataIntegrityChecker.measureMemoryUsage();
        const storageStats = await dataIntegrityChecker.measureStorageUsage();
        const outboxCounts = await OutboxSyncService.getOutboxCount();

        const measurement = {
          timestamp,
          memory: memoryStats,
          storage: storageStats,
          outbox: outboxCounts
        };

        measurements.push(measurement);
        
        console.log(`[${timestamp}] Memory: ${memoryStats.percentage.toFixed(1)}%, Outbox: ${outboxCounts.total}, Storage: ${this.formatBytes(storageStats.totalSize)}`);

        // Wait 30 seconds before next measurement
        await new Promise(resolve => setTimeout(resolve, 30000));

      } catch (error) {
        console.error('Measurement error:', error);
      }
    }

    // Summary
    console.log('\nPerformance Summary:');
    console.log(`Total measurements: ${measurements.length}`);
    
    if (measurements.length > 0) {
      const avgMemory = measurements.reduce((sum, m) => sum + m.memory.percentage, 0) / measurements.length;
      const maxOutbox = Math.max(...measurements.map(m => m.outbox.total));
      
      console.log(`Average memory usage: ${avgMemory.toFixed(1)}%`);
      console.log(`Peak outbox size: ${maxOutbox}`);
    }
  }

  /**
   * Private helper methods
   */
  private async runQuickOfflineTest(): Promise<void> {
    try {
      // Go offline
      networkSimulator.startCondition(NetworkSimulator.CONDITIONS.OFFLINE);
      
      // Create test receipt
      const receipt = this.generateTestReceipt();
      await OutboxSyncService.addToOutbox('receipt', receipt, receipt.org_id, false);
      
      // Go back online
      networkSimulator.stop();
      
      // Sync
      await OutboxSyncService.syncOutbox();
      
      console.log('✅ Quick offline test passed');
      
    } catch (error) {
      console.log('❌ Quick offline test failed:', error);
    }
  }

  private generateTestReceipt(): any {
    const receiptId = `test-receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: receiptId,
      org_id: 'test-org-id',
      register_id: 'test-register',
      total_amount: 25.99,
      payment_method: 'cash',
      created_at: new Date().toISOString(),
      lines: [
        {
          item_id: 'test-item-1',
          quantity: 2,
          unit_price: 12.99,
          line_total: 25.98
        }
      ]
    };
  }

  private logTestResult(testName: string, passed: boolean, errors: string[] = []): void {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);
    
    if (!passed && errors.length > 0) {
      errors.forEach(error => console.log(`  ⚠️  ${error}`));
    }
  }

  private logStressTestResult(testName: string, result: any): void {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);
    console.log(`  Receipts: ${result.metrics.receiptsCreated}`);
    console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`  Max Outbox: ${result.metrics.maxOutboxSize}`);
    console.log(`  Memory: ${this.formatBytes(result.metrics.memoryUsage)}`);
    
    if (result.violations.length > 0) {
      console.log(`  Violations: ${result.violations.length}`);
      result.violations.forEach((violation: string) => console.log(`    ⚠️  ${violation}`));
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatTestName(testName: string): string {
    return testName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}

// Export singleton instance
export const manualTestRunner = ManualTestRunner.getInstance();

// Global functions for easy console access
declare global {
  interface Window {
    runRobustnessTest: () => Promise<void>;
    runDailyCheck: () => Promise<void>;
    runNetworkTests: () => Promise<void>;
    runPerformanceMonitoring: (minutes?: number) => Promise<void>;
  }
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  window.runRobustnessTest = () => manualTestRunner.runFullRobustnessTest();
  window.runDailyCheck = () => manualTestRunner.runDailyCheck();
  window.runNetworkTests = () => manualTestRunner.runNetworkFailureTests();
  window.runPerformanceMonitoring = (minutes = 10) => manualTestRunner.runPerformanceMonitoring(minutes);
}
