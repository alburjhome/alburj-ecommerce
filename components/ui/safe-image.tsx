'use client';

import Image, { ImageProps } from 'next/image';
import { useEffect, useState } from 'react';
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
  sizes,
  ...props
}: SafeImageProps) {
  const [currentSrc, setCurrentSrc] = useState(() => safeImageSrc(src, fallbackSrc));
  const resolvedSizes = sizes ?? (props.fill ? '100vw' : undefined);

  useEffect(() => {
    const nextSrc = safeImageSrc(src, fallbackSrc);
    setCurrentSrc(nextSrc);
  }, [src, fallbackSrc]);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      sizes={resolvedSizes}
      onError={(event) => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
        onError?.(event);
      }}
    />
  );
}
