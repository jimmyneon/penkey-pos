"use client";

import React from "react";

export function SettingsSection({
  title,
  icon: Icon,
  children
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#3d3d3d] rounded-lg p-4 sm:p-6 border border-gray-700">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 pb-3 border-b border-gray-700">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-penkey-orange flex-shrink-0" />
        <h2 className="text-lg sm:text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-4 sm:space-y-4">
        {children}
      </div>
    </div>
  );
}

export function SettingRow({
  label,
  description,
  children
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium text-sm sm:text-base">{label}</div>
        <div className="text-xs sm:text-sm text-gray-400 leading-relaxed">{description}</div>
      </div>
      <div className="flex-shrink-0 self-start sm:self-center">
        {children}
      </div>
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-12 rounded-full transition-colors !min-h-0 !min-w-0 ${
        checked ? "bg-penkey-orange" : "bg-gray-600"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function SettingsPageWrapper({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh bg-[#2d2d2d] flex flex-col overflow-hidden">
      {children}
    </div>
  );
}

export function SettingsHeader({
  title,
  onBack
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <header className="bg-[#3d3d3d] text-white px-3 sm:px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0 z-10">
      <button
        onClick={onBack}
        className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px] p-2 flex items-center rounded"
      >
        <svg className="h-5 w-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="hidden sm:inline">Back to Settings</span>
      </button>
      <h1 className="font-semibold text-base sm:text-lg">{title}</h1>
      <div className="w-[44px] sm:w-36" />
    </header>
  );
}

export function SettingsLoading() {
  return (
    <div className="min-h-dvh bg-[#2d2d2d] flex items-center justify-center">
      <div className="text-white text-lg">Loading settings...</div>
    </div>
  );
}
