"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { Home, Menu, ArrowLeft } from "lucide-react";
import { SidebarMenu } from "@/app/sell/sidebar-menu";
import { ProfileMenu } from "@/app/sell/profile-menu";
import { UnifiedSyncService } from "@/lib/services/unified-sync";
import { SyncManager } from "@/lib/services/sync-manager";
import { hapticButtonPress } from "@/lib/utils/haptics";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  showHome?: boolean;
  showMenu?: boolean;
  session?: {
    employee: { id: string; name: string; role: string };
    register: { id: string; name: string; store_name: string };
    org_id: string;
  } | null;
  rightActions?: React.ReactNode;
  backHref?: string;
}

export function PageHeader({
  title,
  showBack = false,
  showHome = true,
  showMenu = true,
  session,
  rightActions,
  backHref,
}: PageHeaderProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  // Update lastSync from SyncManager
  useEffect(() => {
    if (!session?.org_id) return;
    
    const updateLastSync = async () => {
      const status = await SyncManager.getSyncStatus(session.org_id);
      let mostRecent = 0;
      for (const key in status) {
        const ts = status[key as keyof typeof status].lastSync;
        if (ts && ts > mostRecent) mostRecent = ts;
      }
      setLastSync(mostRecent || null);
    };

    updateLastSync();
    const interval = setInterval(updateLastSync, 30000);
    return () => clearInterval(interval);
  }, [session?.org_id]);

  const handleLock = () => {
    // Clear session but keep auth token
    sessionStorage.removeItem("pos_session");
    router.push("/lock");
  };

  const syncData = async () => {
    if (!session?.org_id) return;
    
    setSyncing(true);
    try {
      const result = await UnifiedSyncService.syncAll(session.org_id, session.register?.id);
      if (result.error) {
        console.error('[PageHeader] Sync failed:', result.error);
        alert(`Sync failed: ${result.error}`);
      } else {
        // Build detailed sync message
        let message = 'Sync complete';
        
        // Show pushed items
        if (result.pushed > 0) {
          const pushedParts: string[] = [];
          Object.entries(result.pushedTypes).forEach(([type, count]) => {
            pushedParts.push(`${count} ${type}${count > 1 ? 's' : ''}`);
          });
          message += `\n\nPushed to Supabase:\n${pushedParts.join('\n')}`;
        }
        
        // Show pulled items
        if (result.pulled) {
          const pulledParts: string[] = [];
          Object.entries(result.pulledTypes).forEach(([type, count]) => {
            if (count > 0) {
              pulledParts.push(`${count} ${type}${count > 1 ? 's' : ''}`);
            }
          });
          if (pulledParts.length > 0) {
            message += `\n\nPulled from Supabase:\n${pulledParts.join('\n')}`;
          } else {
            message += '\n\nPulled fresh data from Supabase';
          }
        }
        
        if (result.pushed === 0 && !result.pulled) {
          message = 'Nothing to sync';
        }
        
        alert(message);
      }
      // Update lastSync after successful sync
      const status = await SyncManager.getSyncStatus(session.org_id);
      let mostRecent = 0;
      for (const key in status) {
        const ts = status[key as keyof typeof status].lastSync;
        if (ts && ts > mostRecent) mostRecent = ts;
      }
      setLastSync(mostRecent || null);
    } catch (error) {
      console.error('[PageHeader] Sync error:', error);
      alert('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log("PageHeader props:", { showHome, showMenu, session: !!session });
  }, [showHome, showMenu, session]);

  return (
    <>
      <header className="bg-[#3d3d3d] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        {/* Left Side */}
        <div className="flex items-center gap-2">
          {showBack && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                hapticButtonPress();
                if (backHref) {
                  router.push(backHref);
                } else {
                  router.back();
                }
              }}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          
          {showMenu && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                hapticButtonPress();
                setSidebarOpen(true);
              }}
              className="text-white hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center - Title */}
        <h1 className="font-semibold text-lg">{title}</h1>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {rightActions}
          
          {showHome && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                hapticButtonPress();
                router.push("/sell");
              }}
              className="text-white hover:bg-white/10"
            >
              <Home className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      {/* Sidebar Menu */}
      {showMenu && session && (
        <>
          <SidebarMenu
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onLock={handleLock}
            onSync={syncData}
            syncing={syncing}
            lastSync={lastSync}
            storeName={session.register.store_name}
            registerName={session.register.name}
          />

          <ProfileMenu
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            onLock={handleLock}
            employeeName={session.employee.name}
            employeeRole={session.employee.role}
          />
        </>
      )}
    </>
  );
}
