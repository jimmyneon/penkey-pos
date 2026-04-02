'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Package } from 'lucide-react';

interface ItemImagePreviewProps {
  imageUrl?: string;
  itemName: string;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  className?: string;
  useThumbnail?: boolean; // Use thumbnail version for faster loading
}

export function ItemImagePreview({
  imageUrl,
  itemName,
  size = 'medium',
  onClick,
  className = '',
  useThumbnail = false,
}: ItemImagePreviewProps) {
  const [imageError, setImageError] = useState(false);

  // Derive thumbnail URL from full URL (replace 'full.webp' with 'thumbnail.webp')
  const displayUrl = useThumbnail && imageUrl 
    ? imageUrl.replace('/full.webp', '/thumbnail.webp')
    : imageUrl;

  console.log('[ItemImagePreview] Rendering with imageUrl:', displayUrl);

  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-20 h-20',
    large: 'w-32 h-32',
  };

  const containerClass = `${sizeClasses[size]} rounded-lg overflow-hidden bg-[#3d3d3d] flex items-center justify-center flex-shrink-0 ${
    onClick ? 'cursor-pointer hover:bg-[#4d4d4d] transition' : ''
  } ${className}`;

  if (!displayUrl || imageError) {
    console.log('[ItemImagePreview] No image or error, showing placeholder');
    return (
      <div className={containerClass} onClick={onClick}>
        <Package className="w-1/2 h-1/2 text-gray-500" />
      </div>
    );
  }

  return (
    <div className={containerClass} onClick={onClick}>
      <Image
        src={displayUrl}
        alt={itemName}
        width={size === 'small' ? 48 : size === 'medium' ? 80 : 128}
        height={size === 'small' ? 48 : size === 'medium' ? 80 : 128}
        className="object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
}
