"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface UserOnboardingProps {
  userId: string;
  email: string;
  onComplete: () => void;
}

export default function UserOnboarding({ userId, email, onComplete }: UserOnboardingProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get org_id (Penkey org)
      const { data: orgData } = await supabase
        .from('orgs')
        .select('id')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

      if (!orgData) {
        throw new Error("Organization not found");
      }

      // Get role_id (default to Cashier)
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'Cashier')
        .eq('org_id', orgData.id)
        .single();

      if (!roleData) {
        throw new Error("Cashier role not found");
      }

      // Create org_members entry
      const { data: memberData, error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: orgData.id,
          user_id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`,
          role_id: roleData.id,
          is_active: true,
        })
        .select('id')
        .single();

      if (memberError || !memberData) {
        throw new Error("Failed to create employee record");
      }

      // Create employee_pins entry with default PIN "0000"
      const { error: pinError } = await supabase
        .from('employee_pins')
        .insert({
          member_id: memberData.id,
          pin_hash: await supabase.rpc('hash_pin', { p_pin: '0000' }),
        });

      if (pinError) {
        console.error("Failed to create PIN entry:", pinError);
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

          <div className="text-sm text-gray-400">
            <p>Email: {email}</p>
            <p>Default PIN: 0000 (change in settings)</p>
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
