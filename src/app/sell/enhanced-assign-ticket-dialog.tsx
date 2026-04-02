"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button, Input } from "@penkey/ui";
import { User, Hash, QrCode, MapPin, Clock, Star, Scan, Search, Users, UserPlus } from "lucide-react";
import { useToastContext } from "@/components/toast-provider";
import { perksApi } from "@penkey/perks-integration";
import { BrowserQRCodeReader } from "@zxing/library";

interface Customer {
  id: string;
  customer_code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  points_balance: number;
  membership_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  is_checked_in: boolean;
  is_nearby?: boolean;
  last_checkin_at?: Date;
  last_nearby_at?: string;
  checkin_store_id?: string;
  total_spent: number;
  visit_count: number;
  distance_meters?: number; // Distance from store
  proximity_status?: 'checked_in' | 'nearby' | 'unknown';
}

interface EnhancedAssignTicketDialogProps {
  open: boolean;
  onClose: () => void;
  onAssign: (assignee: { type: 'customer' | 'table'; customer?: Customer; name: string }) => void;
  storeId: string;
}

type AssignMode = 'quick' | 'search' | 'scan' | 'nearby' | 'new';

export function EnhancedAssignTicketDialog({ 
  open, 
  onClose, 
  onAssign,
  storeId 
}: EnhancedAssignTicketDialogProps) {
  const [mode, setMode] = useState<AssignMode>('quick');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableName, setTableName] = useState('');
  const [quickAssignValue, setQuickAssignValue] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [nearbyCustomers, setNearbyCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const { showToast } = useToastContext();

  // Load nearby checked-in customers on open
  useEffect(() => {
    if (open && mode === 'nearby') {
      loadNearbyCustomers();
    }
  }, [open, mode, storeId]);

  // Cleanup camera when dialog closes
  useEffect(() => {
    if (!open && videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  }, [open]);

  const loadNearbyCustomers = async () => {
    setIsLoading(true);
    try {
      // Use perksApi to get recent check-ins from Perks database
      const response = await perksApi.getNearbyCustomers({
        store_id: storeId,
        radius_meters: 25
      });
      
      const customers = response.customers || [];
      
      // Filter to only last hour on client side
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCustomers = customers.filter((customer: any) => {
        const checkinTime = customer.last_checkin_at ? new Date(customer.last_checkin_at) : null;
        const nearbyTime = customer.last_nearby_at ? new Date(customer.last_nearby_at) : null;
        
        return (checkinTime && checkinTime > oneHourAgo) || (nearbyTime && nearbyTime > oneHourAgo);
      });
      
      // Sort by most recent first
      const sortedCustomers = recentCustomers.sort((a: any, b: any) => {
        const timeA = Math.max(
          a.last_checkin_at ? new Date(a.last_checkin_at).getTime() : 0,
          a.last_nearby_at ? new Date(a.last_nearby_at).getTime() : 0
        );
        const timeB = Math.max(
          b.last_checkin_at ? new Date(b.last_checkin_at).getTime() : 0,
          b.last_nearby_at ? new Date(b.last_nearby_at).getTime() : 0
        );
        return timeB - timeA;
      });
      
      setNearbyCustomers(sortedCustomers as any);
      
      // Debug: Log customers with beans
      console.log('Nearby customers with beans:', sortedCustomers.map(c => ({
        name: `${c.first_name} ${c.last_name}`,
        beans: c.points_balance
      })));
      
      // Show summary in toast
      if (sortedCustomers.length > 0) {
        showToast(
          `Found ${sortedCustomers.length} recent customers (last hour)`, 
          'success'
        );
      }
    } catch (error) {
      console.error('Failed to load nearby customers:', error);
      showToast('Failed to load nearby customers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const searchCustomers = async (term: string) => {
    if (!term.trim()) {
      setCustomers([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await perksApi.searchCustomers({ 
        query: term, 
        store_id: storeId 
      });
      setCustomers(response.customers || []);
    } catch (error) {
      console.error('Failed to search customers:', error);
      showToast('Failed to search customers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    setIsScanning(true);
    
    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera not supported in this browser');
      setIsScanning(false);
      showToast('Camera not supported in this browser', 'error');
      return;
    }
    
    try {
      // Initialize QR code reader
      if (!qrReaderRef.current) {
        qrReaderRef.current = new BrowserQRCodeReader();
      }
      
      // Start decoding from video element
      if (videoRef.current) {
        qrReaderRef.current.decodeFromVideoDevice(
          undefined, // Use default camera
          videoRef.current,
          (result, error) => {
            if (result) {
              // QR code detected!
              const qrData = result.getText();
              console.log('QR Code detected:', qrData);
              handleScanResult(qrData);
            }
            // Ignore errors - they're just "no QR code found" messages
          }
        );
      }
    } catch (error: any) {
      console.error('Failed to start camera:', error);
      
      let errorMessage = 'Failed to access camera';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on this device';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another application';
      }
      
      setCameraError(errorMessage);
      showToast(errorMessage, 'error');
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    // Stop QR code reader
    if (qrReaderRef.current) {
      qrReaderRef.current.reset();
    }
    
    // Stop video stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  const handleScanResult = async (qrData: string) => {
    stopScanner();
    setIsLoading(true);
    
    try {
      let customer;
      
      // Check if it's a profile QR code
      if (qrData.startsWith('profile:')) {
        customer = await perksApi.getCustomerByProfileQR(qrData);
        showToast(`Found customer profile: ${customer.first_name} ${customer.last_name}`, 'success');
      } else {
        // Regular check-in QR code
        customer = await perksApi.getCustomerByCode(qrData);
        showToast(`Found customer: ${customer.first_name} ${customer.last_name}`, 'success');
      }
      
      setSelectedCustomer(customer);
    } catch (error) {
      console.error('Failed to lookup customer:', error);
      if (error instanceof Error && error.message.includes('expired')) {
        showToast('QR code has expired', 'error');
      } else {
        showToast('Customer not found', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignCustomer = (customer: Customer) => {
    onAssign({
      type: 'customer',
      customer,
      name: `${customer.first_name} ${customer.last_name}`
    });
    handleClose();
  };

  const handleAssignTable = () => {
    if (!tableName.trim()) return;
    
    onAssign({
      type: 'table',
      name: tableName.trim()
    });
    handleClose();
  };

  const handleQuickAssign = () => {
    if (!quickAssignValue.trim()) return;
    
    onAssign({
      type: 'table',
      name: quickAssignValue.trim()
    });
    handleClose();
  };

  const handleCreateNewCustomer = async () => {
    if (!newCustomerName.trim()) {
      showToast('Please enter customer name', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // Create customer in Perks database via API
      const response = await fetch(`${process.env.NEXT_PUBLIC_PERKS_API_URL}/api/integration/customers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          email: newCustomerEmail.trim() || undefined,
          phone: newCustomerPhone.trim() || undefined,
        })
      });

      if (!response.ok) throw new Error('Failed to create customer');

      const newCustomer = await response.json();
      
      showToast(`Customer ${newCustomerName} created successfully!`, 'success');
      
      // Assign the new customer to the ticket
      onAssign({
        type: 'customer',
        customer: newCustomer,
        name: newCustomerName.trim()
      });
      
      handleClose();
    } catch (error) {
      console.error('Failed to create customer:', error);
      showToast('Failed to create customer', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setTableName('');
    setQuickAssignValue('');
    setNewCustomerName('');
    setNewCustomerEmail('');
    setNewCustomerPhone('');
    setCustomers([]);
    setSelectedCustomer(null);
    setCameraError(null);
    stopScanner();
    onClose();
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'text-purple-400';
      case 'gold': return 'text-yellow-400';
      case 'silver': return 'text-gray-300';
      default: return 'text-orange-400';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'platinum': return '💎';
      case 'gold': return '🥇';
      case 'silver': return '🥈';
      default: return '🥉';
    }
  };

  const CustomerCard = ({ customer, onSelect }: { customer: Customer; onSelect: () => void }) => (
    <div 
      onClick={onSelect}
      className="p-4 border rounded-lg bg-[#2d2d2d] border-gray-700 hover:border-penkey-orange cursor-pointer transition-colors"
    >
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-white text-lg">
          {customer.first_name} {customer.last_name}
        </h3>
        <div className="flex items-center gap-2 text-penkey-orange font-bold text-lg">
          <span>{customer.points_balance}</span>
          <span className="text-sm">beans</span>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-[#3d3d3d] text-white border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-xl font-bold text-white">Assign Ticket</DialogTitle>
        <DialogDescription className="text-gray-300">
          Quick assign or find customer by scanning, searching, or selecting from nearby
        </DialogDescription>

        {/* Mode Selection */}
        <div className="grid grid-cols-5 gap-2 mt-4">
          <button
            onClick={() => setMode('quick')}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
              mode === 'quick'
                ? 'border-penkey-orange bg-penkey-orange/10 text-penkey-orange'
                : 'border-gray-700 text-gray-300 hover:border-gray-600 bg-[#2d2d2d]'
            }`}
          >
            <Hash className="h-5 w-5" />
            <span className="text-xs font-medium">Quick</span>
          </button>
          
          <button
            onClick={() => setMode('nearby')}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
              mode === 'nearby'
                ? 'border-penkey-orange bg-penkey-orange/10 text-penkey-orange'
                : 'border-gray-700 text-gray-300 hover:border-gray-600 bg-[#2d2d2d]'
            }`}
          >
            <MapPin className="h-5 w-5" />
            <span className="text-xs font-medium">Nearby</span>
          </button>
          
          <button
            onClick={() => setMode('scan')}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
              mode === 'scan'
                ? 'border-penkey-orange bg-penkey-orange/10 text-penkey-orange'
                : 'border-gray-700 text-gray-300 hover:border-gray-600 bg-[#2d2d2d]'
            }`}
          >
            <QrCode className="h-5 w-5" />
            <span className="text-xs font-medium">Scan</span>
          </button>
          
          <button
            onClick={() => setMode('search')}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
              mode === 'search'
                ? 'border-penkey-orange bg-penkey-orange/10 text-penkey-orange'
                : 'border-gray-700 text-gray-300 hover:border-gray-600 bg-[#2d2d2d]'
            }`}
          >
            <Search className="h-5 w-5" />
            <span className="text-xs font-medium">Search</span>
          </button>
          
          <button
            onClick={() => setMode('new')}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
              mode === 'new'
                ? 'border-penkey-orange bg-penkey-orange/10 text-penkey-orange'
                : 'border-gray-700 text-gray-300 hover:border-gray-600 bg-[#2d2d2d]'
            }`}
          >
            <UserPlus className="h-5 w-5" />
            <span className="text-xs font-medium">New</span>
          </button>
        </div>

        {/* Content based on mode */}
        <div className="mt-6 min-h-[300px]">
          {mode === 'quick' && (
            <div>
              <h3 className="font-medium text-white mb-4">Quick Assign</h3>
              <p className="text-sm text-gray-400 mb-4">
                Enter a table number, customer name, or description for fast assignment
              </p>
              
              <Input
                value={quickAssignValue}
                onChange={(e) => setQuickAssignValue(e.target.value)}
                placeholder="e.g., Table 5, John's order, Window seat..."
                className="w-full bg-[#2d2d2d] border-gray-700 text-white placeholder:text-gray-500 mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickAssignValue.trim()) {
                    handleQuickAssign();
                  }
                }}
              />
              
              <div className="flex gap-2">
                <Button
                  onClick={handleClose}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleQuickAssign}
                  disabled={!quickAssignValue.trim()}
                  className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white disabled:opacity-50"
                >
                  Assign
                </Button>
              </div>
            </div>
          )}

          {mode === 'nearby' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-white">Nearby Customers</h3>
                <Button
                  onClick={loadNearbyCustomers}
                  disabled={isLoading}
                  className="text-xs bg-[#2d2d2d] hover:bg-gray-600"
                >
                  Refresh
                </Button>
              </div>
              
              {isLoading ? (
                <div className="text-center py-8 text-gray-400">Loading nearby customers...</div>
              ) : nearbyCustomers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No customers detected nearby</p>
                  <p className="text-xs mt-1">Customers appear here when they're within 25m of the store</p>
                  <p className="text-xs mt-1">They can check in via the Penkey Perks app or scan their profile QR</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {nearbyCustomers.map((customer) => (
                    <CustomerCard
                      key={customer.id}
                      customer={customer}
                      onSelect={() => handleAssignCustomer(customer)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'scan' && (
            <div>
              <h3 className="font-medium text-white mb-4">Scan QR Code</h3>
              
              {cameraError && (
                <div className="mb-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
                  <p className="text-red-400 text-sm font-medium mb-2">Camera Error</p>
                  <p className="text-red-300 text-xs">{cameraError}</p>
                  {cameraError.includes('permission') && (
                    <p className="text-red-300 text-xs mt-2">
                      💡 Check your browser's address bar for camera permissions
                    </p>
                  )}
                </div>
              )}
              
              {!isScanning ? (
                <div className="text-center py-8">
                  <QrCode className="h-16 w-16 mx-auto mb-6 text-gray-400" />
                  <Button
                    onClick={startScanner}
                    className="bg-penkey-orange hover:bg-penkey-orange/90 min-w-[160px]"
                  >
                    <Scan className="h-4 w-4 mr-2" />
                    Start Scanner
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      className="w-full h-64 object-cover"
                      playsInline
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="border-2 border-penkey-orange w-48 h-48 rounded-lg"></div>
                    </div>
                  </div>
                  <Button
                    onClick={stopScanner}
                    className="mt-4 w-full bg-gray-600 hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              
              {selectedCustomer && (
                <div className="mt-4">
                  <CustomerCard
                    customer={selectedCustomer}
                    onSelect={() => handleAssignCustomer(selectedCustomer)}
                  />
                </div>
              )}
            </div>
          )}

          {mode === 'search' && (
            <div>
              <h3 className="font-medium text-white mb-4">Search Customers</h3>
              
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchCustomers(e.target.value);
                }}
                placeholder="Search by name, email, or phone..."
                className="w-full bg-[#2d2d2d] border-gray-700 text-white placeholder:text-gray-500 mb-4"
                autoFocus
              />
              
              {isLoading ? (
                <div className="text-center py-4 text-gray-400">Searching...</div>
              ) : customers.length === 0 && searchTerm ? (
                <div className="text-center py-8 text-gray-400">
                  <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No customers found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {customers.map((customer) => (
                    <CustomerCard
                      key={customer.id}
                      customer={customer}
                      onSelect={() => handleAssignCustomer(customer)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'new' && (
            <div>
              <h3 className="font-medium text-white mb-4">Create New Customer</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Name *</label>
                  <Input
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Enter customer name..."
                    className="w-full bg-[#2d2d2d] border-gray-700 text-white placeholder:text-gray-500"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Email (optional)</label>
                  <Input
                    type="email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full bg-[#2d2d2d] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Phone (optional)</label>
                  <Input
                    type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="+44 1234 567890"
                    className="w-full bg-[#2d2d2d] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={handleClose}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateNewCustomer}
                  disabled={!newCustomerName.trim() || isLoading}
                  className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create & Assign'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Close button for modes without their own action buttons */}
        {mode !== 'quick' && mode !== 'new' && (
          <div className="flex justify-end mt-6">
            <Button
              onClick={handleClose}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
