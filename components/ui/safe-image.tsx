'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { PLACEHOLDER_PRODUCT, safeImageSrc } from '@/lib/image-utils';

type SafeImageProps = Omit<ImageProps, 'src'> & {
  src: string | null | undefined;
  fallbackSrc?: string;
};

export function SafeImage({
  src,
  fallbackSrc = PLACEHOLDER_PRODUCT,
  alt,
  onError,
  ...props
}: SafeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(() => safeImageSrc(src, fallbackSrc));

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      onError={(event) => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
        onError?.(event);
      }}
    />
  );
}
