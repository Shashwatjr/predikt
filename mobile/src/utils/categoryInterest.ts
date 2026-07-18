import api from '../services/api';

/**
 * Records interest in a not-yet-available ("Coming Soon") category.
 *
 * Deliberately lightweight: it reuses the existing whitelisted `feedback_submitted`
 * activity event rather than introducing a new endpoint or subsystem. Fire-and-forget
 * — if the caller is a logged-out visitor the request 401s and is swallowed, which is
 * fine for an optional, dismissable nudge.
 */
export function voteCategoryInterest(categoryKey: string, categoryLabel?: string) {
  return api
    .post('/events', {
      eventType: 'feedback_submitted',
      category: categoryKey,
      metadata: { kind: 'category_interest', category: categoryKey, categoryLabel },
    })
    .catch(() => undefined);
}
