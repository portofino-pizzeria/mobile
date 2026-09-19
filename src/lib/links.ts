import { Linking, Platform } from 'react-native';

/**
 * Opens a tel:, mailto: or web link. A device with no dialer or mail app
 * rejects the link; that is not an error worth surfacing, because the number
 * or address stays visible on screen. On web a tel:/mailto: link opens in the
 * same tab, so no blank tab is left behind.
 */
export function openLink(url: string): void {
  if (Platform.OS === 'web') {
    const sameTab = url.startsWith('tel:') || url.startsWith('mailto:');
    window.open(url, sameTab ? '_self' : '_blank', 'noopener');
    return;
  }
  Linking.openURL(url).catch(() => {});
}
