'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, Wifi, WifiOff, CreditCard, X, AlertCircle, RefreshCw, ArrowLeft, Home } from 'lucide-react';

interface Terminal {
  id: string;
  name: string;
  reader_id: string;
  location?: string;
  status: 'online' | 'offline' | 'pairing';
  created_at: string;
  updated_at: string;
}

interface SumUpReader {
  id: string;
  name: string;
  status: string;
  serial_number?: string;
}

export default function PaymentTerminalsPage() {
  const router = useRouter();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [sumUpReaders, setSumUpReaders] = useState<SumUpReader[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReaders, setLoadingReaders] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [pairingCode, setPairingCode] = useState('');

  useEffect(() => {
    fetchTerminals();
    fetchSumUpReaders();
  }, []);

  const fetchTerminals = async () => {
    try {
      const res = await fetch('/api/sumup/terminals');
      const data = await res.json();
      if (data.success) {
        setTerminals(data.terminals || []);
        // Check status after loading terminals
        if (data.terminals && data.terminals.length > 0) {
          checkAllReaderStatus();
        }
      }
    } catch (e) {
      console.error('Failed to fetch terminals', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSumUpReaders = async () => {
    try {
      setLoadingReaders(true);
      const res = await fetch('/api/sumup/readers');
      const data = await res.json();
      if (data.success) setSumUpReaders(data.readers || []);
    } catch (e) {
      console.error('Failed to fetch SumUp readers', e);
    } finally {
      setLoadingReaders(false);
    }
  };

  const checkReaderStatus = async (readerId: string): Promise<'online' | 'offline'> => {
    try {
      console.log('[Payment Terminals] Checking status for reader:', readerId);
      const res = await fetch(`/api/sumup/diagnose?reader_id=${readerId}`);
      const data = await res.json();
      console.log('[Payment Terminals] Reader status response:', data);
      if (data.success && data.reader_online) {
        const status = data.reader_online === 'ONLINE' ? 'online' : 'offline';
        console.log('[Payment Terminals] Reader', readerId, 'is', status);
        return status;
      }
      console.log('[Payment Terminals] Reader', readerId, 'status check failed, defaulting to offline');
      return 'offline';
    } catch (e) {
      console.error('Failed to check reader status:', readerId, e);
      return 'offline';
    }
  };

  const checkAllReaderStatus = async () => {
    if (terminals.length === 0) return;
    
    console.log('[Payment Terminals] Checking status for all terminals:', terminals.length);
    setCheckingStatus(true);
    const statusUpdates = await Promise.all(
      terminals.map(async (terminal) => {
        const status = await checkReaderStatus(terminal.reader_id);
        return { id: terminal.id, status };
      })
    );

    console.log('[Payment Terminals] Status updates:', statusUpdates);
    setTerminals(prev =>
      prev.map(t => {
        const update = statusUpdates.find(u => u.id === t.id);
        return update ? { ...t, status: update.status } : t;
      })
    );
    setCheckingStatus(false);
  };

  const handleUnpairFromSumUp = async (readerId: string) => {
    if (!confirm('Unpair this reader from SumUp? This will allow you to generate a new pairing code on the device.')) return;
    try {
      const res = await fetch(`/api/sumup/readers?reader_id=${readerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchSumUpReaders();
      } else {
        alert(data.error || 'Failed to unpair reader');
      }
    } catch {
      alert('Network error. Please try again.');
    }
  };

  const handleUnpairAll = async () => {
    if (!confirm('Unpair ALL readers from SumUp and delete all local terminals? This will reset everything.')) return;
    try {
      // Unpair all from SumUp API
      for (const reader of sumUpReaders) {
        try {
          await fetch(`/api/sumup/readers?reader_id=${reader.id}`, { method: 'DELETE' });
        } catch {
          // Continue even if one fails
        }
      }

      // Delete all from local DB
      for (const terminal of terminals) {
        try {
          await fetch(`/api/sumup/terminals?id=${terminal.id}`, { method: 'DELETE' });
        } catch {
          // Continue even if one fails
        }
      }

      fetchSumUpReaders();
      fetchTerminals();
    } catch {
      alert('Network error. Please try again.');
    }
  };

  const handlePair = async (e: FormEvent) => {
    e.preventDefault();
    setPairingLoading(true);
    setPairingError('');

    try {
      const res = await fetch('/api/sumup/pair-reader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingCode: pairingCode.trim(), name: terminalName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setTerminalName('');
        setPairingCode('');
        fetchTerminals();
      } else {
        setPairingError(data.error || 'Failed to pair terminal');
      }
    } catch {
      setPairingError('Network error. Please try again.');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this terminal?')) return;
    try {
      const res = await fetch('/api/sumup/terminals?id=' + id, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchTerminals();
      else alert(data.error || 'Failed to remove terminal');
    } catch {
      alert('Network error. Please try again.');
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'online') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
        <Wifi className="w-3 h-3" /> Online
      </span>
    );
    if (status === 'pairing') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
        <Loader2 className="w-3 h-3 animate-spin" /> Pairing
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/20 text-zinc-400">
        <WifiOff className="w-3 h-3" /> Offline
      </span>
    );
  };

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#3d3d3d] text-white px-3 sm:px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0 z-10">
        <button
          onClick={() => router.back()}
          className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px] p-2 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-semibold text-base sm:text-lg">Payment Terminals</h1>
        <div className="w-[44px]"></div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                fetchTerminals();
              }}
              disabled={loadingReaders || checkingStatus}
              className="inline-flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${(loadingReaders || checkingStatus) ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleUnpairAll}
              disabled={sumUpReaders.length === 0 && terminals.length === 0}
              className="inline-flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Reset All
            </button>
            <button
              onClick={() => { setPairingError(''); setShowModal(true); }}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Pair New Reader
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
              <p className="text-zinc-400 text-sm">Loading terminals...</p>
            </div>
          ) : checkingStatus ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
              <p className="text-zinc-400 text-sm">Checking reader status...</p>
            </div>
          ) : terminals.length === 0 ? (
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 flex flex-col items-center justify-center py-12 sm:py-16 gap-4">
              <CreditCard className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-500" />
              <div className="text-center px-4">
                <p className="text-white font-semibold text-sm sm:text-base">No terminals paired</p>
                <p className="text-zinc-400 text-xs sm:text-sm mt-1">Pair your SumUp Solo to start accepting card payments</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm sm:text-base"
              >
                <Plus className="w-4 h-4" />
                Pair First Reader
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {terminals.map((t) => (
                <div key={t.id} className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-zinc-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white text-sm sm:text-base truncate">{t.name}</p>
                      <p className="text-xs text-zinc-400 truncate">ID: {t.reader_id}{t.location ? ' · ' + t.location : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {statusBadge(t.status)}
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove terminal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-lg font-bold text-white">Pair SumUp Solo Reader</h2>
                <p className="text-sm text-zinc-400 mt-0.5">Enter the code shown on your card reader</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mx-4 sm:mx-6 mt-4 sm:mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs sm:text-sm text-blue-300">
              <p className="font-semibold mb-2">How to get your pairing code:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-200/80">
                <li>Make sure your Solo reader is <strong>logged out</strong></li>
                <li>Open the top menu on the Solo</li>
                <li>Go to <strong>Connections &rarr; API &rarr; Connect</strong></li>
                <li>Copy the code shown on screen and enter it below</li>
              </ol>
              <p className="mt-2 text-xs text-blue-300/60">Code expires in 5 minutes</p>
            </div>

            <form onSubmit={handlePair} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5" htmlFor="terminalName">
                  Reader Name
                </label>
                <input
                  id="terminalName"
                  type="text"
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  placeholder="e.g. Front Counter"
                  required
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5" htmlFor="pairingCode">
                  Pairing Code
                </label>
                <input
                  id="pairingCode"
                  type="text"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="Enter code from Solo screen"
                  required
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors font-mono text-base sm:text-lg tracking-widest"
                />
              </div>

              {pairingError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{pairingError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pairingLoading || !terminalName.trim() || !pairingCode.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  {pairingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pairingLoading ? 'Pairing...' : 'Pair Reader'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
