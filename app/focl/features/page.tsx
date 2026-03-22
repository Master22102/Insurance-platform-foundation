'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FoclFeaturesIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/focl/features/intelligence');
  }, [router]);

  return null;
}
