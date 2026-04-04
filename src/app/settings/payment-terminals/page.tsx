'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@penkey/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@penkey/ui";
import { Input } from "@penkey/ui";
import { Label } from "@penkey/ui";
import { Alert, AlertDescription } from "@penkey/ui";
import { Loader2, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';

interface Terminal {
  id: string;
  name: string;
  reader_id: string;
  location?: string;
  status: 'online' | 'offline' | 'pairing';
  created_at: string;
  updated_at: string;
}

export default function PaymentTerminalsPage() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingDialogOpen, setPairingDialogOpen] = useState(false);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [pairingCode, setPairingCode] = useState('');

  useEffect(() => {
    fetchTerminals();
  }, []);

  const fetchTerminals = async () => {
    try {
      const response = await fetch('/api/sumup/terminals');
      const data = await response.json();
      
      if (data.success) {
        setTerminals(data.terminals);
      } else {
        console.error('Failed to fetch terminals:', data.error);
      }
    } catch (error) {
      console.error('Error fetching terminals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePairTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairingLoading(true);
    setPairingError('');

    try {
      const response = await fetch('/api/sumup/pair-reader', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairingCode: pairingCode.trim(),
          name: terminalName.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPairingDialogOpen(false);
        setTerminalName('');
        setPairingCode('');
        fetchTerminals();
      } else {
        setPairingError(data.error || 'Failed to pair terminal');
      }
    } catch (error) {
      setPairingError('Network error. Please try again.');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleDeleteTerminal = async (terminalId: string) => {
    if (!confirm('Are you sure you want to remove this terminal?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sumup/terminals?id=${terminalId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        fetchTerminals();
      } else {
        alert(data.error || 'Failed to delete terminal');
      }
    } catch (error) {
      alert('Network error. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge variant="default" className="bg-green-500"><Wifi className="w-3 h-3 mr-1" />Online</Badge>;
      case 'offline':
        return <Badge variant="secondary"><WifiOff className="w-3 h-3 mr-1" />Offline</Badge>;
      case 'pairing':
        return <Badge variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Pairing</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Payment Terminals</h1>
          <p className="text-muted-foreground">
            Manage your SumUp Solo payment terminals
          </p>
        </div>
        
        <Dialog open={pairingDialogOpen} onOpenChange={setPairingDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Terminal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pair New Terminal</DialogTitle>
              <DialogDescription>
                Connect a new SumUp Solo terminal to your POS system
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handlePairTerminal} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="terminalName">Terminal Name</Label>
                <Input
                  id="terminalName"
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  placeholder="e.g., Front Counter Terminal"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pairingCode">Pairing Code</Label>
                <Input
                  id="pairingCode"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                />
              </div>
              
              <Alert>
                <AlertDescription>
                  <strong>Important:</strong> On your SumUp Solo, go to Settings → Connections → API → Connect to generate a pairing code. Enter it here within 5 minutes.
                </AlertDescription>
              </Alert>
              
              {pairingError && (
                <Alert variant="destructive">
                  <AlertDescription>{pairingError}</AlertDescription>
                </Alert>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPairingDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pairingLoading}>
                  {pairingLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Pair Terminal
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : terminals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <WifiOff className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Terminals Configured</h3>
              <p className="text-muted-foreground text-center mb-4">
                Add your first SumUp Solo terminal to start accepting card payments
              </p>
              <Button onClick={() => setPairingDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Terminal
              </Button>
            </CardContent>
          </Card>
        ) : (
          terminals.map((terminal) => (
            <Card key={terminal.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{terminal.name}</CardTitle>
                  <CardDescription>
                    Reader ID: {terminal.reader_id}
                    {terminal.location && ` • ${terminal.location}`}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(terminal.status)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTerminal(terminal.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
