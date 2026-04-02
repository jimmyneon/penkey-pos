import { Clock } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#2d2d2d] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin mb-4">
          <Clock className="h-12 w-12 text-penkey-orange" />
        </div>
        <p className="text-gray-400">Loading shifts...</p>
      </div>
    </div>
  );
}
