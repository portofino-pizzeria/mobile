import Constants from 'expo-constants';
import { Platform } from 'react-native';

// The backend HTTP port (see ../../backend). Override the whole URL with
// EXPO_PUBLIC_API_URL in an .env if the backend lives elsewhere.
const BACKEND_PORT = 4000;

/**
 * A physical phone can't reach "localhost" — that's the phone itself. Expo
 * exposes the dev machine's LAN host via `hostUri` (e.g. "192.168.1.20:8081");
 * we reuse its IP so the app talks to the backend on the same machine.
 */
function devHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig?.hostUri as string | undefined);
  if (hostUri) return hostUri.split(':')[0];
  return 'localhost';
}

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'web'
    ? `http://localhost:${BACKEND_PORT}`
    : `http://${devHost()}:${BACKEND_PORT}`);

/** Port the UI Bridge control server listens on (matches the Qontinui runner). */
export const UI_BRIDGE_PORT = 8087;
