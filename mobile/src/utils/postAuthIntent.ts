import type { RootStackParamList } from '../navigation/types';

/**
 * A one-shot navigation intent handed from a pre-auth screen to the authenticated
 * navigator. When a guest logs in mid-flow, the auth-stack swap remounts the
 * navigator — navigating across that boundary from the old (unmounting) screen is
 * dropped. Instead we stash the target here and let AppNavigator route to it once
 * the authenticated stack mounts. In-memory is sufficient: the handoff happens in
 * one JS session with no reload.
 */
type PostAuthIntent = { screen: keyof RootStackParamList; params?: object } | null;

let pending: PostAuthIntent = null;

export function setPostAuthIntent(intent: PostAuthIntent) {
  pending = intent;
}

export function consumePostAuthIntent(): PostAuthIntent {
  const intent = pending;
  pending = null;
  return intent;
}
