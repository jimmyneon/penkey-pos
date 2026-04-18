"use client";

import { useState } from "react";

interface UserOnboardingProps {
  userId: string;
  email: string;
  onComplete: () => void;
}

export default function UserOnboarding({ userId, email, onComplete }: UserOnboardingProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (pin.length !== 4) {
      setError("PIN must be 4 digits");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email,
          firstName,
          lastName,
          pin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete onboarding");
      }

      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center p-4">
      <div className="bg-[#3d3d3d] rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-2">Welcome!</h2>
        <p className="text-gray-300 mb-6">
          Please complete your profile to get started.
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-500 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full px-4 py-2 bg-[#2d2d2d] border border-gray-600 rounded text-white focus:outline-none focus:border-penkey-orange"
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full px-4 py-2 bg-[#2d2d2d] border border-gray-600 rounded text-white focus:outline-none focus:border-penkey-orange"
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">PIN (4 digits)</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                // Only allow digits, max 4 characters
                const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPin(value);
              }}
              required
              maxLength={4}
              className="w-full px-4 py-2 bg-[#2d2d2d] border border-gray-600 rounded text-white focus:outline-none focus:border-penkey-orange"
              placeholder="••••"
            />
          </div>

          <div className="text-sm text-gray-400">
            <p>Email: {email}</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-[#ff6b35] hover:bg-[#ff8c5a] disabled:bg-gray-600 text-white font-bold rounded transition-colors"
          >
            {loading ? "Creating Profile..." : "Complete Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
