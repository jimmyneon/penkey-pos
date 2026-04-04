'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@penkey/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@penkey/ui";
import { Alert, AlertDescription } from "@penkey/ui";
import { Loader2, CreditCard, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import { useSumUpPayment } from '@/hooks/useSumUpPayment';

interface Terminal {
  id: string;
  name: string;
  reader_id: string;
  status: 'online' | 'offline' | 'pairing';
}

interface SumUpPaymentFlowProps {
  amount: number;
  currency?: string;
  description?: string;
  onPaymentComplete?: (success: boolean, checkoutId?: string) => void;
}

export function SumUpPaymentFlow({ 
  amount, 
  currency = 'GBP', 
  description = 'POS Payment',
  onPaymentComplete 
}: SumUpPaymentFlowProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [loadingTerminals, setLoadingTerminals] = useState(true);
  
  const { 
    createCheckout, 
    pollPaymentStatus, 
    reset, 
    loading: paymentLoading, 
    error: paymentError 
  } = useSumUpPayment();

  useEffect(() => {
    fetchTerminals();
  }, []);

  const fetchTerminals = async () => {
    try {
      const response = await fetch('/api/sumup/terminals');
      const data = await response.json();
      
      if (data.success) {
        setTerminals(data.terminals);
      }
    } catch (error) {
      console.error('Error fetching terminals:', error);
    } finally {
      setLoadingTerminals(false);
    }
  };

  const handleStartPayment = async () => {
    if (!selectedTerminal) {
      return;
    }

    const terminal = terminals.find(t => t.id === selectedTerminal);
    if (!terminal) return;

    const checkoutId = await createCheckout({
      amount,
      currency,
      reader_id: terminal.reader_id,
      description,
    });

    if (checkoutId) {
      setPaymentStatus('PENDING');
      
      // Start polling for payment status
      const stopPolling = pollPaymentStatus(
        checkoutId,
        (status) => {
          setPaymentStatus(status.status);
          
          if (status.status === 'PAID') {
            onPaymentComplete?.(true, status.checkout_id);
          } else if (status.status === 'FAILED' || status.status === 'CANCELLED') {
            onPaymentComplete?.(false, status.checkout_id);
          }
        }
      );

      // Cleanup on unmount
      return stopPolling;
    }
  };

  const handleCancel = () => {
    reset();
    setPaymentStatus('');
    onPaymentComplete?.(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Loader2 className="w-8 h-8 animate-spin text-blue-500" />;
      case 'PAID':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'FAILED':
      case 'CANCELLED':
        return <XCircle className="w-8 h-8 text-red-500" />;
      default:
        return <CreditCard className="w-8 h-8 text-gray-500" />;
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Waiting for payment... Please present card to the terminal.';
      case 'PAID':
        return 'Payment successful!';
      case 'FAILED':
        return 'Payment failed. Please try again.';
      case 'CANCELLED':
        return 'Payment was cancelled.';
      default:
        return 'Ready to process payment';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-blue-600';
      case 'PAID':
        return 'text-green-600';
      case 'FAILED':
      case 'CANCELLED':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const onlineTerminals = terminals.filter(t => t.status === 'online');

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Card Payment
        </CardTitle>
        <CardDescription>
          Amount: £{amount.toFixed(2)}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!paymentStatus && (
          <>
            {loadingTerminals ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : onlineTerminals.length === 0 ? (
              <Alert>
                <WifiOff className="h-4 w-4" />
                <AlertDescription>
                  No online terminals available. Please check your terminal connections in Settings.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Terminal</label>
                <Select value={selectedTerminal} onValueChange={setSelectedTerminal}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a payment terminal" />
                  </SelectTrigger>
                  <SelectContent>
                    {onlineTerminals.map((terminal) => (
                      <SelectItem key={terminal.id} value={terminal.id}>
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-green-500" />
                          {terminal.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {paymentError && (
              <Alert variant="destructive">
                <AlertDescription>{paymentError}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-2">
              <Button 
                onClick={handleStartPayment}
                disabled={!selectedTerminal || paymentLoading || onlineTerminals.length === 0}
                className="flex-1"
              >
                {paymentLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Take Card Payment
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </>
        )}
        
        {paymentStatus && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              {getStatusIcon(paymentStatus)}
            </div>
            
            <div className={`text-lg font-medium ${getStatusColor(paymentStatus)}`}>
              {getStatusMessage(paymentStatus)}
            </div>
            
            {(paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') && (
              <Button onClick={reset} variant="outline">
                Try Again
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
