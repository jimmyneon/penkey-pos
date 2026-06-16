"use client";

import { useState } from "react";
import { formatCurrency } from "@penkey/ui";

interface TipSelectionProps {
  subtotal: number;
  tipPresets: number[]; // e.g. [2, 5, 10]
  onSelect: (tipAmount: number) => void;
  onSkip: () => void;
}

export function TipSelection({ subtotal, tipPresets, onSelect, onSkip }: TipSelectionProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const handleCustomSubmit = () => {
    const val = parseFloat(customInput);
    if (!isNaN(val) && val >= 0) {
      onSelect(parseFloat(val.toFixed(2)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCustomSubmit();
    if (e.key === "Escape") { setCustomMode(false); setCustomInput(""); }
  };

  if (customMode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-1">Enter Tip Amount</h2>
          <p className="text-gray-400 text-sm">Type an amount and press confirm</p>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-bold text-penkey-orange">£</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="0.00"
            className="bg-[#4d4d4d] text-white text-3xl font-bold text-center pl-10 pr-4 py-4 rounded-xl w-48 border-2 border-penkey-orange focus:outline-none"
          />
        </div>

        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => { setCustomMode(false); setCustomInput(""); }}
            className="flex-1 bg-[#5d5d5d] hover:bg-[#6d6d6d] text-white py-4 rounded-xl font-semibold text-lg transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleCustomSubmit}
            disabled={!customInput || isNaN(parseFloat(customInput))}
            className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 disabled:opacity-40 text-white py-4 rounded-xl font-bold text-lg transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-1">Add a Tip?</h2>
        <p className="text-gray-400 text-sm">Your kindness means the world to us</p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        {tipPresets.map((amount) => (
          <button
            key={amount}
            onClick={() => onSelect(amount)}
            className="bg-[#5d5d5d] hover:bg-penkey-orange/20 hover:border-penkey-orange border-2 border-transparent text-white rounded-xl py-6 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
          >
            <span className="text-2xl font-bold">{formatCurrency(amount)}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setCustomMode(true)}
        className="w-full max-w-sm bg-[#5d5d5d] hover:bg-[#6d6d6d] text-white py-4 rounded-xl font-semibold text-lg transition-colors border-2 border-dashed border-gray-500 hover:border-penkey-orange"
      >
        Custom Amount
      </button>

      <button
        onClick={onSkip}
        className="text-gray-400 hover:text-white text-sm underline underline-offset-2 transition-colors"
      >
        No thanks, skip tip
      </button>
    </div>
  );
}
