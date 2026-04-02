'use client';

import { useEffect } from 'react';

/**
 * Testing Integration Component
 * Makes testing functions available globally in the browser console
 */
export function TestingIntegration() {
  useEffect(() => {
    // Only load testing in development or when explicitly enabled
    const isDev = process.env.NODE_ENV === 'development';
    const testingEnabled = localStorage.getItem('enable_testing') === 'true';
    
    if (isDev || testingEnabled) {
      // Dynamically import testing modules to avoid bundling in production
      import('@/lib/testing/manual-test-runner').then(({ manualTestRunner }) => {
        // Make testing functions available globally
        (window as any).runRobustnessTest = () => manualTestRunner.runFullRobustnessTest();
        (window as any).runDailyCheck = () => manualTestRunner.runDailyCheck();
        (window as any).runNetworkTests = () => manualTestRunner.runNetworkFailureTests();
        (window as any).runPerformanceMonitoring = (minutes = 10) => manualTestRunner.runPerformanceMonitoring(minutes);
        
        console.log('🧪 Testing Framework Loaded');
        console.log('Available commands:');
        console.log('  window.runDailyCheck() - Quick 5-minute health check');
        console.log('  window.runRobustnessTest() - Full 30-minute test suite');
        console.log('  window.runNetworkTests() - Network failure scenarios');
        console.log('  window.runPerformanceMonitoring(10) - Monitor for X minutes');
        console.log('');
        console.log('💡 To enable testing in production, run:');
        console.log('  localStorage.setItem("enable_testing", "true")');
        console.log('  Then refresh the page');
      }).catch(error => {
        console.error('Failed to load testing framework:', error);
      });
    }
  }, []);

  return null; // This component renders nothing
}
