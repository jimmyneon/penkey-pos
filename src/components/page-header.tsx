"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { Home, Menu, ArrowLeft } from "lucide-react";
import { SidebarMenu } from "@/app/sell/sidebar-menu";
import { ProfileMenu } from "@/app/sell/profile-menu";
import { useDataSync } from "@/lib/hooks/use-data-sync";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { dataCache } from "@/lib/services/data-cache";

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
  const { syncing, lastSync, syncData } = useDataSync(session?.org_id || "skip");

  const handleLock = () => {
    // Clear session but keep auth token
    sessionStorage.removeItem("pos_session");
    router.push("/lock");
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
