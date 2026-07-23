export type SponsoredPlacement = {
  id: string;
  label: 'Sponsored' | 'Partner' | 'Promoted';
  title: string;
  description: string;
  ctaLabel?: string;
  targetType: 'external_url' | 'internal_route' | 'none';
  target?: string;
  placement:
    | 'landing_left'
    | 'landing_right'
    | 'dashboard_left'
    | 'dashboard_right'
    | 'help_right'
    | 'result_side';
  enabled: boolean;
  startsAt?: string;
  endsAt?: string;
  category?: string;
};

export const sponsoredPlacements: SponsoredPlacement[] = [
  {
    id: 'landing-partner-perk',
    label: 'Sponsored',
    title: 'Partner Perk',
    description: 'Unlock a coffee perk after your next Prediction Room.',
    ctaLabel: 'Learn more',
    targetType: 'none',
    placement: 'landing_left',
    enabled: true,
    category: 'partner_perk',
  },
  {
    id: 'landing-brand-challenge',
    label: 'Sponsored',
    title: 'Delivery Dash Challenge',
    description: 'Join this week’s Delivery Dash challenge with friends.',
    ctaLabel: 'View challenge',
    targetType: 'none',
    placement: 'landing_right',
    enabled: true,
    category: 'brand_challenge',
  },
  {
    id: 'dashboard-creator-boost',
    label: 'Promoted',
    title: 'Featured creators',
    description: 'Follow creators running live Prediction Rooms this week.',
    ctaLabel: 'View creators',
    targetType: 'none',
    placement: 'dashboard_left',
    enabled: true,
    category: 'creator_boost',
  },
  {
    id: 'dashboard-community-partner',
    label: 'Partner',
    title: 'Community hosts',
    description: 'Local gyms can host private Prediktion challenges.',
    ctaLabel: 'Explore',
    targetType: 'none',
    placement: 'dashboard_right',
    enabled: true,
    category: 'community_partner',
  },
  {
    id: 'help-route-guide',
    label: 'Partner',
    title: 'Privacy-safe route play',
    description: 'Partner cards are separate from My Prediktion results and scoring.',
    ctaLabel: 'Learn more',
    targetType: 'none',
    placement: 'help_right',
    enabled: true,
    category: 'education',
  },
  {
    id: 'result-side-note',
    label: 'Sponsored',
    title: 'Moment Card themes',
    description: 'Partner placements never affect Aura, Clout, Credits, or results.',
    ctaLabel: 'Learn more',
    targetType: 'none',
    placement: 'result_side',
    enabled: true,
    category: 'result_side',
  },
];

export function getActiveSponsoredPlacement(placement: SponsoredPlacement['placement']) {
  const now = Date.now();
  return sponsoredPlacements.find((item) => {
    if (!item.enabled || item.placement !== placement) return false;
    if (item.startsAt && new Date(item.startsAt).getTime() > now) return false;
    if (item.endsAt && new Date(item.endsAt).getTime() < now) return false;
    return true;
  });
}
