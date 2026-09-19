import React from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';

interface AdBannerProps {
  isPremium?: boolean;
  placement: 'dashboard' | 'history' | 'reports' | 'meet' | 'settings';
  className?: string;
}

export function AdBanner({ isPremium, placement, className = '' }: AdBannerProps) {
  // Premium users never see banner ads
  if (isPremium) {
    return null;
  }

  const getPlacementCopy = () => {
    switch (placement) {
      case 'dashboard':
        return {
          title: 'Organize Your Day Better',
          subtitle: 'Upgrade to Premium for unlimited voice tasks and an ad-free experience.'
        };
      case 'history':
        return {
          title: 'Track Your Milestones',
          subtitle: 'Keep your productivity streak going with daily task reviews.'
        };
      case 'reports':
        return {
          title: 'Daily Performance Insights',
          subtitle: 'Export comprehensive analytics and unlock full history in Premium.'
        };
      case 'meet':
        return {
          title: 'Connect & Stay Accountable',
          subtitle: 'Pair up with accountability partners working on similar daily goals.'
        };
      case 'settings':
        return {
          title: 'Ad-Free Experience Available',
          subtitle: 'Get uninterrupted task management with Daily TASK AI Premium.'
        };
    }
  };

  const info = getPlacementCopy();

  return (
    <div
      id={`ad-banner-${placement}`}
      className={`bg-slate-50 border border-slate-200/90 rounded-2xl p-3 flex items-center justify-between gap-3 text-left my-2 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded">
              Ad
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">
              {info.title}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            {info.subtitle}
          </p>
        </div>
      </div>

      <div className="text-[11px] font-semibold text-blue-700 flex items-center gap-1 flex-shrink-0">
        <span>Sponsored</span>
        <ExternalLink className="w-3 h-3 text-blue-500" />
      </div>
    </div>
  );
}
