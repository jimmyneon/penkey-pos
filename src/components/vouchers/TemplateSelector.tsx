"use client";

import { useState } from "react";
import { Plus, Trash2, Check, Image as ImageIcon, Loader2 } from "lucide-react";
import { VoucherTemplate, DEFAULT_VOUCHER_LAYOUT } from "@/lib/voucher/voucher-layout-config";

interface TemplateSelectorProps {
  templates: VoucherTemplate[];
  activeTemplateId: string;
  onSelect: (templateId: string) => void;
  onCreate: (name: string, imageUrl: string) => void;
  onDelete: (templateId: string) => void;
  onUploadImage: (file: File) => Promise<string | null>;
}

export function TemplateSelector({
  templates,
  activeTemplateId,
  onSelect,
  onCreate,
  onDelete,
  onUploadImage,
}: TemplateSelectorProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      if (url) setNewImageUrl(url);
    } catch {
      // error handled by parent
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = () => {
    if (!newName.trim() || !newImageUrl.trim()) return;
    onCreate(newName.trim(), newImageUrl.trim());
    setNewName("");
    setNewImageUrl("");
    setShowCreate(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Templates</span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-600/50 text-gray-400 hover:border-gray-500 transition-colors"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      {/* Template thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {templates.map((t) => (
          <div
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`relative flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
              activeTemplateId === t.id
                ? "border-penkey-orange ring-1 ring-penkey-orange"
                : "border-gray-600/50 hover:border-gray-500"
            }`}
            style={{ width: 48, height: 138 }}
          >
            <img
              src={t.imageUrl}
              alt={t.name}
              className="w-full h-full object-cover"
            />
            {activeTemplateId === t.id && (
              <div className="absolute top-0.5 right-0.5 bg-penkey-orange rounded-full p-0.5">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
            )}
            {t.id !== "default" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(t.id);
                }}
                className="absolute bottom-0.5 right-0.5 bg-black/70 rounded-full p-0.5 hover:bg-red-600/80 transition-colors"
              >
                <Trash2 className="h-2.5 w-2.5 text-white" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Create new template form */}
      {showCreate && (
        <div className="bg-[#252525] rounded-lg p-3 space-y-2 border border-gray-700/50">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name (e.g. Christmas Voucher)"
            className="w-full bg-[#2d2d2d] text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange"
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-500 cursor-pointer transition-colors">
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              Upload Image
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {newImageUrl && (
              <span className="text-xs text-green-400 flex-1 truncate">Image uploaded</span>
            )}
          </div>
          {newImageUrl && (
            <div className="relative rounded-lg overflow-hidden bg-[#1a2847]" style={{ maxWidth: 120 }}>
              <img src={newImageUrl} alt="Preview" className="w-full h-auto" />
            </div>
          )}
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || !newImageUrl.trim()}
            className="w-full py-2 rounded-lg bg-penkey-orange text-white text-sm font-bold disabled:opacity-40 transition-colors"
          >
            Create Template
          </button>
        </div>
      )}
    </div>
  );
}
