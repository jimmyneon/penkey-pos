'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Loader2, Plus, Trash2, Wifi, WifiOff, CreditCard, X, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [sumUpReaders, setSumUpReaders] = useState<SumUpReader[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReaders, setLoadingReaders] = useState(false);
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
      if (data.success) setTerminals(data.terminals || []);
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payment Terminals</h1>
          <p className="text-zinc-400 mt-1">Manage your SumUp Solo card readers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSumUpReaders}
            disabled={loadingReaders}
            className="inline-flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loadingReaders ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleUnpairAll}
            disabled={sumUpReaders.length === 0 && terminals.length === 0}
            className="inline-flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Reset All
          </button>
          <button
            onClick={() => { setPairingError(''); setShowModal(true); }}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Pair New Reader
          </button>
        </div>
      </div>

      {/* SumUp API Readers (for recovery when pairing fails locally) */}
      {sumUpReaders.length > 0 && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <h2 className="font-semibold text-white">Readers paired on SumUp (not in local DB)</h2>
          </div>
          <p className="text-sm text-orange-200/80 mb-4">
            These readers are paired on your SumUp account but not saved locally. Unpair them to generate a new pairing code on your device.
          </p>
          <div className="space-y-2">
            {sumUpReaders.map((reader) => (
              <div key={reader.id} className="rounded-lg bg-zinc-800/50 p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{reader.name}</p>
                  <p className="text-xs text-zinc-400">ID: {reader.id}</p>
                </div>
                <button
                  onClick={() => handleUnpairFromSumUp(reader.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Unpair
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      ) : terminals.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 flex flex-col items-center justify-center py-16 gap-4">
          <CreditCard className="w-12 h-12 text-zinc-500" />
          <div className="text-center">
            <p className="text-white font-semibold">No terminals paired</p>
            <p className="text-zinc-400 text-sm mt-1">Pair your SumUp Solo to start accepting card payments</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Pair First Reader
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {terminals.map((t) => (
            <div key={t.id} className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-zinc-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-zinc-400">ID: {t.reader_id}{t.location ? ' · ' + t.location : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(t.status)}
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Remove terminal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
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

            <div className="mx-6 mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
              <p className="font-semibold mb-2">How to get your pairing code:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-200/80">
                <li>Make sure your Solo reader is <strong>logged out</strong></li>
                <li>Open the top menu on the Solo</li>
                <li>Go to <strong>Connections &rarr; API &rarr; Connect</strong></li>
                <li>Copy the code shown on screen and enter it below</li>
              </ol>
              <p className="mt-2 text-xs text-blue-300/60">Code expires in 5 minutes</p>
            </div>

            <form onSubmit={handlePair} className="p-6 space-y-4">
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
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors font-mono text-lg tracking-widest"
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
