import { Platform } from 'react-native';

/**
 * The screenshot/share loop is My Prediktion's growth mechanic: a Chaos Bot line copied
 * into a group chat. One brand attribution keeps every shared line recognisable.
 */
/** Fallback attribution when a personality name is missing. */
export const CHAOS_BOT_ATTRIBUTION = 'Chaos Bot on My Prediktion';

/** `{PersonalityName} on My Prediktion`, falling back to "Chaos Bot" when unknown. */
export function attributionFor(personality?: string | null): string {
  const name = personality && personality.trim() ? personality.trim() : 'Chaos Bot';
  return `${name} on My Prediktion`;
}

/** Formats a line for pasting into a chat: `"line" — {Personality} on My Prediktion` */
export function formatLineForShare(line: string, personality?: string | null): string {
  const trimmed = line.trim().replace(/^["“”]+|["“”]+$/g, '');
  return `"${trimmed}" — ${attributionFor(personality)}`;
}

/**
 * Copies text to the clipboard. Web-first (the MVP ships as Expo Web to
 * mobile Safari / mobile Chrome / desktop Chrome). Uses the async Clipboard API
 * with an execCommand fallback for older Safari. Returns false if unavailable
 * (e.g. native without a clipboard module) so callers can degrade gracefully.
 * No new dependency is added.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === 'web' || typeof navigator !== 'undefined') {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to the legacy path.
    }
    try {
      if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
      }
    } catch {
      // Fall through.
    }
  }
  return false;
}
