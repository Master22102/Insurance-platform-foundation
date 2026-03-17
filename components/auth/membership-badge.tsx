'use client';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Building2 } from 'lucide-react';

interface MembershipBadgeProps { tier: 'FREE' | 'CORPORATE'; showIcon?: boolean; }

export function MembershipBadge({ tier, showIcon = true }: MembershipBadgeProps) {
  const config = {
    FREE: { label: 'Free Preview', icon: Sparkles, className: 'bg-gray-100 text-gray-700' },
    CORPORATE: { label: 'Corporate', icon: Building2, className: 'bg-purple-100 text-purple-700' },
  };
  const { label, icon: Icon, className } = config[tier] ?? config.FREE;
  return <Badge className={className}>{showIcon && <Icon className="h-3 w-3 mr-1" />}{label}</Badge>;
}
