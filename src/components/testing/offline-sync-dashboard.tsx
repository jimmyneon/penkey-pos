/**
 * Offline Sync Testing Dashboard
 * Real-time monitoring and testing interface for sync robustness
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Database, 
  Network, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Play,
  Square,
  RefreshCw,
  Zap
} from 'lucide-react';

import { dataIntegrityChecker, ValidationResult, DiffReport } from '@/lib/testing/data-integrity-checker';
import { networkSimulator, NetworkSimulator } from '@/lib/testing/network-simulator';
import { stressTestRunner, StressTestResult } from '@/lib/testing/stress-test-runner';
import { OutboxSyncService } from '@/lib/services/outbox-sync';

interface DashboardMetrics {
  outboxCount: { pending: number; failed: number; total: number };
  networkStats: any;
  memoryUsage: { used: number; total: number; percentage: number };
  storageUsage: { indexedDBSize: number; totalSize: number; quota: number };
  lastIntegrityCheck: ValidationResult | null;
  lastDiffReport: DiffReport | null;
}

export function OfflineSyncDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    outboxCount: { pending: 0, failed: 0, total: 0 },
    networkStats: {},
    memoryUsage: { used: 0, total: 0, percentage: 0 },
    storageUsage: { indexedDBSize: 0, totalSize: 0, quota: 0 },
    lastIntegrityCheck: null,
    lastDiffReport: null
  });

  const [isRunningTest, setIsRunningTest] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, StressTestResult>>({});
  const [networkCondition, setNetworkCondition] = useState<string>('Normal');

  // Update metrics every 5 seconds
  useEffect(() => {
    const updateMetrics = async () => {
      try {
        const [outboxCount, memoryUsage, storageUsage] = await Promise.all([
          OutboxSyncService.getOutboxCount(),
          dataIntegrityChecker.measureMemoryUsage(),
          dataIntegrityChecker.measureStorageUsage()
        ]);

        const networkStats = networkSimulator.getStats();

        setMetrics(prev => ({
          ...prev,
          outboxCount,
          memoryUsage,
          storageUsage,
          networkStats
        }));
      } catch (error) {
        console.error('[Dashboard] Error updating metrics:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const runIntegrityCheck = async () => {
    try {
      const result = await dataIntegrityChecker.checkIndexedDBConsistency();
      setMetrics(prev => ({ ...prev, lastIntegrityCheck: result }));
    } catch (error) {
      console.error('[Dashboard] Integrity check failed:', error);
    }
  };

  const runDataComparison = async () => {
    try {
      const session = JSON.parse(sessionStorage.getItem('pos_session') || '{}');
      if (session.org_id) {
        const report = await dataIntegrityChecker.compareLocalVsRemote(session.org_id);
        setMetrics(prev => ({ ...prev, lastDiffReport: report }));
      }
    } catch (error) {
      console.error('[Dashboard] Data comparison failed:', error);
    }
  };

  const startStressTest = async (scenarioName: string) => {
    if (isRunningTest) return;

    setIsRunningTest(true);
    setCurrentTest(scenarioName);

    try {
      const result = await stressTestRunner.runScenario(scenarioName);
      setTestResults(prev => ({ ...prev, [scenarioName]: result }));
    } catch (error) {
      console.error('[Dashboard] Stress test failed:', error);
    } finally {
      setIsRunningTest(false);
      setCurrentTest(null);
    }
  };

  const startNetworkSimulation = (conditionName: string) => {
    const condition = NetworkSimulator.CONDITIONS[conditionName as keyof typeof NetworkSimulator.CONDITIONS];
    if (condition) {
      networkSimulator.startCondition(condition);
      setNetworkCondition(condition.name);
    }
  };

  const stopNetworkSimulation = () => {
    networkSimulator.stop();
    setNetworkCondition('Normal');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (valid: boolean | null) => {
    if (valid === null) return 'secondary';
    return valid ? 'success' : 'destructive';
  };

  const getStatusIcon = (valid: boolean | null) => {
    if (valid === null) return <Activity className="h-4 w-4" />;
    return valid ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />;
  };

  return (
    <div className="p-6 space-y-6 bg-[#2d2d2d] min-h-screen text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Offline Sync Testing Dashboard</h1>
        <div className="flex items-center gap-2">
          <Badge variant={networkCondition === 'Normal' ? 'default' : 'secondary'}>
            <Network className="h-3 w-3 mr-1" />
            {networkCondition}
          </Badge>
          {isRunningTest && (
            <Badge variant="secondary">
              <Play className="h-3 w-3 mr-1" />
              Running: {currentTest}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-[#3d3d3d]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="integrity">Data Integrity</TabsTrigger>
          <TabsTrigger value="stress">Stress Testing</TabsTrigger>
          <TabsTrigger value="network">Network Simulation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Outbox Status */}
            <Card className="bg-[#3d3d3d] border-[#5d5d5d]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Outbox Status</CardTitle>
                <Database className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{metrics.outboxCount.total}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {metrics.outboxCount.pending} pending, {metrics.outboxCount.failed} failed
                </div>
                {metrics.outboxCount.failed > 0 && (
                  <Badge variant="destructive" className="mt-2">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Sync Issues
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card className="bg-[#3d3d3d] border-[#5d5d5d]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Memory Usage</CardTitle>
                <Activity className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {metrics.memoryUsage.percentage.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatBytes(metrics.memoryUsage.used)} / {formatBytes(metrics.memoryUsage.total)}
                </div>
                <Progress 
                  value={metrics.memoryUsage.percentage} 
                  className="mt-2"
                />
              </CardContent>
            </Card>

            {/* Storage Usage */}
            <Card className="bg-[#3d3d3d] border-[#5d5d5d]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Storage Usage</CardTitle>
                <Database className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {formatBytes(metrics.storageUsage.totalSize)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  IndexedDB: {formatBytes(metrics.storageUsage.indexedDBSize)}
                </div>
                <div className="text-xs text-gray-400">
                  Quota: {formatBytes(metrics.storageUsage.quota)}
                </div>
              </CardContent>
            </Card>

            {/* Network Stats */}
            <Card className="bg-[#3d3d3d] border-[#5d5d5d]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Network Stats</CardTitle>
                <Network className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {metrics.networkStats.requestCount || 0}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Requests made
                </div>
                <div className="text-xs text-gray-400">
                  Error rate: {((metrics.networkStats.errorRate || 0) * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-[#3d3d3d] border-[#5d5d5d]">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button 
                onClick={runIntegrityCheck}
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Check Integrity
              </Button>
              <Button 
                onClick={runDataComparison}
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Compare Data
              </Button>
              <Button 
                onClick={() => OutboxSyncService.syncOutbox()}
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <Zap className="h-4 w-4 mr-2" />
                Force Sync
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrity" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Integrity Check Results */}
            <Card className="bg-[#3d3d3d] border-[#5d5d5d]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  {getStatusIcon(metrics.lastIntegrityCheck?.valid || null)}
                  IndexedDB Integrity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.lastIntegrityCheck ? (
                  <div className="space-y-2">
                    <Badge variant={getStatusColor(metrics.lastIntegrityCheck.valid)}>
                      {metrics.lastIntegrityCheck.valid ? 'Valid' : 'Issues Found'}
                    </Badge>
                    
                    {metrics.lastIntegrityCheck.errors.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-400 mb-1">Errors:</h4>
                        <ul className="text-xs text-gray-300 space-y-1">
                          {metrics.lastIntegrityCheck.errors.map((error, i) => (
                            <li key={i}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {metrics.lastIntegrityCheck.warnings.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-yellow-400 mb-1">Warnings:</h4>
                        <ul className="text-xs text-gray-300 space-y-1">
                          {metrics.lastIntegrityCheck.warnings.map((warning, i) => (
                            <li key={i}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No integrity check run yet</p>
                )}
              </CardContent>
            </Card>

            {/* Data Comparison Results */}
            <Card className="bg-[#3d3d3d] border-[#5d5d5d]">
              <CardHeader>
                <CardTitle className="text-white">Local vs Remote Data</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.lastDiffReport ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Local Total:</span>
                        <span className="ml-2 text-white">{metrics.lastDiffReport.summary.total_local}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Remote Total:</span>
                        <span className="ml-2 text-white">{metrics.lastDiffReport.summary.total_remote}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Missing Local:</span>
                        <span className="ml-2 text-red-400">{metrics.lastDiffReport.summary.missing_local_count}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Conflicts:</span>
                        <span className="ml-2 text-yellow-400">{metrics.lastDiffReport.summary.conflict_count}</span>
                      </div>
                    </div>

                    {(metrics.lastDiffReport.summary.missing_local_count > 0 || 
                      metrics.lastDiffReport.summary.conflict_count > 0) && (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Sync Required
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No data comparison run yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stress" className="space-y-4">
          <Card className="bg-[#3d3d3d] border-[#5d5d5d]">
            <CardHeader>
              <CardTitle className="text-white">Stress Test Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(stressTestRunner.constructor.SCENARIOS).map((scenarioName) => (
                  <div key={scenarioName} className="p-4 border border-[#5d5d5d] rounded-lg">
                    <h3 className="font-medium text-white mb-2">{scenarioName.replace('_', ' ')}</h3>
                    <div className="flex items-center justify-between">
                      <Button
                        onClick={() => startStressTest(scenarioName)}
                        disabled={isRunningTest}
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {isRunningTest && currentTest === scenarioName ? (
                          <Square className="h-4 w-4 mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        {isRunningTest && currentTest === scenarioName ? 'Running...' : 'Start Test'}
                      </Button>
                      
                      {testResults[scenarioName] && (
                        <Badge variant={testResults[scenarioName].success ? 'default' : 'destructive'}>
                          {testResults[scenarioName].success ? 'PASS' : 'FAIL'}
                        </Badge>
                      )}
                    </div>
                    
                    {testResults[scenarioName] && (
                      <div className="mt-2 text-xs text-gray-400">
                        <div>Receipts: {testResults[scenarioName].metrics.receiptsCreated}</div>
                        <div>Duration: {(testResults[scenarioName].duration / 1000).toFixed(1)}s</div>
                        {testResults[scenarioName].violations.length > 0 && (
                          <div className="text-red-400">
                            Violations: {testResults[scenarioName].violations.length}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card className="bg-[#3d3d3d] border-[#5d5d5d]">
            <CardHeader>
              <CardTitle className="text-white">Network Simulation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(NetworkSimulator.CONDITIONS).map(([key, condition]) => (
                  <div key={key} className="p-4 border border-[#5d5d5d] rounded-lg">
                    <h3 className="font-medium text-white mb-2">{condition.name}</h3>
                    <div className="text-xs text-gray-400 space-y-1 mb-3">
                      <div>Online: {condition.online ? 'Yes' : 'No'}</div>
                      {condition.latency && <div>Latency: {condition.latency}ms</div>}
                      {condition.errorRate && <div>Error Rate: {(condition.errorRate * 100).toFixed(1)}%</div>}
                    </div>
                    <Button
                      onClick={() => startNetworkSimulation(key)}
                      disabled={networkCondition === condition.name}
                      size="sm"
                      variant={networkCondition === condition.name ? 'default' : 'outline'}
                      className={networkCondition === condition.name 
                        ? 'bg-orange-500 text-white' 
                        : 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white'
                      }
                    >
                      {networkCondition === condition.name ? 'Active' : 'Start'}
                    </Button>
                  </div>
                ))}
              </div>
              
              {networkCondition !== 'Normal' && (
                <div className="mt-4">
                  <Button
                    onClick={stopNetworkSimulation}
                    variant="outline"
                    className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Simulation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
