import { useState } from 'react';

function isImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https?:\/\/|^data:image\//i.test(trimmed) || /\.(png|jpe?g|gif|webp|svg|ico|avif)(\?|#|$)/i.test(trimmed);
}

interface IconDisplayProps {
  icon: string;
  fallback?: string;
  className?: string;
  imgClassName?: string;
}

export default function IconDisplay({ icon, fallback, className, imgClassName }: IconDisplayProps) {
  const [failed, setFailed] = useState(false);
  const value = icon?.trim() || fallback || '';
  if (!value) return null;

  if (isImageUrl(value) && !failed) {
    return (
      <img
        src={value}
        alt=""
        className={imgClassName ?? 'size-4 object-contain'}
        onError={() => setFailed(true)}
      />
    );
  }
  return <span className={className ?? 'flex size-4 items-center justify-center text-sm leading-none'}>{value}</span>;
}
