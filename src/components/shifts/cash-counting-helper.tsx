"use client";

import { useState } from "react";
import { Button } from "@penkey/ui";

interface Denomination {
  name: string;
  value: number;
  count: number;
  weight: number; // grams per coin
}

interface CashCountingHelperProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

// Official weights from Royal Mint specifications
// Notes: Weights vary by condition, so coins only for weight mode
const DENOMINATIONS: Denomination[] = [
  // Notes (no weight - count only)
  { name: "£50", value: 50, count: 0, weight: 0 },
  { name: "£20", value: 20, count: 0, weight: 0 },
  { name: "£10", value: 10, count: 0, weight: 0 },
  { name: "£5", value: 5, count: 0, weight: 0 },
  // Coins (official Royal Mint weights)
  { name: "£2", value: 2, count: 0, weight: 12.0 },    // Bi-metallic, heaviest coin
  { name: "£1", value: 1, count: 0, weight: 8.75 },    // New 2017 bi-metallic coin
  { name: "50p", value: 0.5, count: 0, weight: 8.0 },  // Cupro-nickel
  { name: "20p", value: 0.2, count: 0, weight: 5.0 },  // Cupro-nickel
  { name: "10p", value: 0.1, count: 0, weight: 6.5 },  // Nickel-plated steel
  { name: "5p", value: 0.05, count: 0, weight: 3.25 }, // Nickel-plated steel
  { name: "2p", value: 0.02, count: 0, weight: 7.12 }, // Copper-plated steel
  { name: "1p", value: 0.01, count: 0, weight: 3.564 }, // Copper-plated stainless steel
];

type CountingMode = "denomination" | "manual" | "weight";

export function CashCountingHelper({ value, onChange, label = "Amount" }: CashCountingHelperProps) {
  const [denominations, setDenominations] = useState<Denomination[]>(DENOMINATIONS);
  const [manualInput, setManualInput] = useState(value.toString());
  const [mode, setMode] = useState<CountingMode>("denomination");
  const [weights, setWeights] = useState<Record<string, number>>({});

  const updateDenomination = (index: number, count: number) => {
    const newDenominations = [...denominations];
    newDenominations[index].count = Math.max(0, count);
    setDenominations(newDenominations);

    // Calculate total
    const total = newDenominations.reduce((sum, d) => sum + d.value * d.count, 0);
    onChange(Math.round(total * 100) / 100);
  };

  const handleManualInput = (input: string) => {
    setManualInput(input);
    const num = parseFloat(input) || 0;
    onChange(Math.max(0, num));
  };

  const handleWeightInput = (denomName: string, weightGrams: number) => {
    const newWeights = { ...weights, [denomName]: weightGrams };
    setWeights(newWeights);

    // Calculate total from weights
    let total = 0;
    DENOMINATIONS.forEach((denom) => {
      const weight = newWeights[denom.name] || 0;
      if (weight > 0) {
        const coinCount = Math.round(weight / denom.weight);
        total += coinCount * denom.value;
      }
    });

    onChange(Math.round(total * 100) / 100);
  };

  const resetDenominations = () => {
    setDenominations(DENOMINATIONS);
    setWeights({});
    onChange(0);
  };

  const getWeightCalculations = () => {
    const results: Array<{ name: string; weight: number; count: number; value: number }> = [];
    DENOMINATIONS.forEach((denom) => {
      const weight = weights[denom.name] || 0;
      if (weight > 0) {
        const coinCount = Math.round(weight / denom.weight);
        results.push({
          name: denom.name,
          weight,
          count: coinCount,
          value: coinCount * denom.value,
        });
      }
    });
    return results;
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Display Total */}
      <div className="bg-[#2d2d2d] rounded-lg p-3 sm:p-4 border border-gray-700">
        <p className="text-xs sm:text-sm text-gray-400 mb-1">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-penkey-orange">£{value.toFixed(2)}</p>
      </div>

      {/* Toggle between counting modes - Compact for mobile */}
      <div className="flex gap-1 sm:gap-2">
        <Button
          onClick={() => setMode("denomination")}
          className={`flex-1 text-xs sm:text-sm min-h-[36px] sm:min-h-[40px] ${
            mode === "denomination" 
              ? "bg-penkey-orange hover:bg-penkey-orange/90 text-white" 
              : "bg-gray-600 hover:bg-gray-700 text-white"
          }`}
        >
          Count
        </Button>
        <Button
          onClick={() => setMode("weight")}
          className={`flex-1 text-xs sm:text-sm min-h-[36px] sm:min-h-[40px] ${
            mode === "weight" 
              ? "bg-penkey-orange hover:bg-penkey-orange/90 text-white" 
              : "bg-gray-600 hover:bg-gray-700 text-white"
          }`}
        >
          Weight
        </Button>
        <Button
          onClick={() => setMode("manual")}
          className={`flex-1 text-xs sm:text-sm min-h-[36px] sm:min-h-[40px] ${
            mode === "manual" 
              ? "bg-penkey-orange hover:bg-penkey-orange/90 text-white" 
              : "bg-gray-600 hover:bg-gray-700 text-white"
          }`}
        >
          Manual
        </Button>
      </div>

      {/* Manual Input */}
      {mode === "manual" ? (
        <div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={manualInput}
            onChange={(e) => handleManualInput(e.target.value)}
            placeholder="Enter amount"
            className="w-full bg-[#2d2d2d] border border-gray-600 rounded px-3 py-2 sm:py-3 text-white placeholder-gray-500 focus:outline-none focus:border-penkey-orange text-lg sm:text-xl min-h-[44px]"
          />
        </div>
      ) : mode === "weight" ? (
        /* Weight Input - 2 columns (coins only) */
        <div className="grid grid-cols-2 gap-1.5">
          {DENOMINATIONS.filter(d => d.weight > 0).map((denom) => (
            <div key={denom.name} className="bg-[#2d2d2d] rounded p-2 border border-gray-700">
              {/* Denomination name and calculated value */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white">{denom.name}</span>
                {weights[denom.name] && weights[denom.name] > 0 && (
                  <span className="text-xs font-semibold text-penkey-orange">
                    £{((Math.round(weights[denom.name] / denom.weight)) * denom.value).toFixed(2)}
                  </span>
                )}
              </div>
              
              {/* Weight input */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  value={weights[denom.name] || ""}
                  onChange={(e) => handleWeightInput(denom.name, parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-gray-600 text-center rounded px-2 py-1.5 text-base font-semibold text-white border-0 focus:outline-none focus:ring-1 focus:ring-penkey-orange min-h-[36px]"
                />
                <span className="text-xs text-gray-400 font-medium">g</span>
              </div>
              
              {/* Coin count display */}
              {weights[denom.name] && weights[denom.name] > 0 && (
                <p className="text-xs text-gray-400 text-center mt-1">
                  {Math.round(weights[denom.name] / denom.weight)} coins
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Denomination Grid - 2 columns */
        <div className="grid grid-cols-2 gap-1.5">
          {denominations.map((denom, index) => (
            <div key={denom.name} className="bg-[#2d2d2d] rounded p-2 border border-gray-700">
              {/* Denomination name and value */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white">{denom.name}</span>
                <span className="text-xs font-semibold text-penkey-orange">
                  £{(denom.value * denom.count).toFixed(2)}
                </span>
              </div>
              
              {/* Count input */}
              <input
                type="number"
                min="0"
                value={denom.count || ""}
                onChange={(e) => updateDenomination(index, parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-gray-600 text-center rounded px-2 py-1.5 text-base font-semibold text-white border-0 focus:outline-none focus:ring-1 focus:ring-penkey-orange mb-1 min-h-[36px]"
              />
              
              {/* Plus/Minus buttons */}
              <div className="flex gap-1">
                <button
                  onClick={() => updateDenomination(index, denom.count - 1)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 active:bg-gray-400 rounded py-1.5 text-lg font-bold min-h-[36px] touch-manipulation"
                >
                  −
                </button>
                <button
                  onClick={() => updateDenomination(index, denom.count + 1)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 active:bg-gray-400 rounded py-1.5 text-lg font-bold min-h-[36px] touch-manipulation"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset Button */}
      {(denominations.some(d => d.count > 0) || Object.keys(weights).length > 0 || value > 0) && (
        <Button
          onClick={resetDenominations}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white min-h-[44px]"
        >
          Reset
        </Button>
      )}
    </div>
  );
}
