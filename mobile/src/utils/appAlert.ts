import { Alert, AlertButton, AlertOptions, Platform } from 'react-native';

/**
 * Cross-platform replacement for React Native's `Alert.alert`.
 *
 * react-native-web does NOT implement `Alert.alert` — on web it is a no-op, so
 * any alert (validation messages, request errors, confirmations) silently
 * vanishes. That made flows like "Lock it in" appear to do nothing in the
 * browser. This helper falls back to the browser's `window.alert` /
 * `window.confirm` on web and delegates to the native `Alert.alert` elsewhere.
 *
 * It is a drop-in for the common signatures we use:
 *   appAlert('Title', 'Message')
 *   appAlert('Title', 'Message', [{ text, onPress, style }])
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons, options);
    return;
  }

  const body = [title, message].filter(Boolean).join('\n\n');

  // No buttons, or a single informational button → simple alert.
  if (!buttons || buttons.length <= 1) {
    if (typeof window !== 'undefined') window.alert(body);
    buttons?.[0]?.onPress?.();
    return;
  }

  // Two-or-more buttons → treat as confirm. The last button is the primary
  // (confirm) action, matching how iOS renders the affirmative button last;
  // the first "cancel"-styled button becomes the Cancel path.
  const confirmButton =
    buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
  const cancelButton = buttons.find((b) => b.style === 'cancel') ?? buttons[0];

  const confirmed = typeof window !== 'undefined' ? window.confirm(body) : true;
  if (confirmed) confirmButton?.onPress?.();
  else cancelButton?.onPress?.();
}

export default appAlert;
