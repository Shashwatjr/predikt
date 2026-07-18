export const DEMO_ACCOUNT_EMAIL = 'test@predikt.ai';
export const DEMO_ACCOUNT_HANDLE = 'predikt.demo';

export type DemoScenario = {
  key: string;
  inviteCode: string;
  title: string;
  subtitle: string;
  icon: string;
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: 'result',
    inviteCode: 'HUBA1',
    title: 'See a result',
    subtitle: 'Completed journey with rankings, Aura, and commentary',
    icon: '🏆',
  },
  {
    key: 'predict',
    inviteCode: 'HUBJ8',
    title: 'Submit a prediction',
    subtitle: 'Joined room waiting for your guess before lock',
    icon: '✍️',
  },
  {
    key: 'live',
    inviteCode: 'HUBB2',
    title: 'Watch a live journey',
    subtitle: 'Route in progress with approximate ETA and progress',
    icon: '📡',
  },
  {
    key: 'fair_close',
    inviteCode: 'HUBD4',
    title: 'See fair closure',
    subtitle: 'Plans changed — the room closed without a loss',
    icon: '🤝',
  },
];

export function isDemoAccount(user?: { email?: string | null; prediktHandle?: string | null } | null) {
  if (!user) return false;
  const email = user.email?.trim().toLowerCase();
  return email === DEMO_ACCOUNT_EMAIL || user.prediktHandle === DEMO_ACCOUNT_HANDLE;
}
