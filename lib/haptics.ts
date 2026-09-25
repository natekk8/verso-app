/**
 * A utility to trigger haptic feedback (vibrations) on mobile devices.
 * Uses the native `navigator.vibrate` API.
 */

type HapticType = "light" | "medium" | "heavy" | "success" | "error";

export function triggerHaptic(type: HapticType = "light") {
  if (typeof window === "undefined" || !navigator.vibrate) {
    return;
  }

  try {
    switch (type) {
      case "light":
        navigator.vibrate(10);
        break;
      case "medium":
        navigator.vibrate(20);
        break;
      case "heavy":
        navigator.vibrate(40);
        break;
      case "success":
        navigator.vibrate([15, 100, 30]);
        break;
      case "error":
        navigator.vibrate([30, 50, 30, 50, 40]);
        break;
      default:
        navigator.vibrate(10);
    }
  } catch (e) {
    // Ignore errors (e.g., if user hasn't interacted with the page yet)
  }
}
