import { Colors } from '@/constants/theme';

/**
 * The app's colours. One palette: the declared design is light-only, so there
 * is no scheme to follow. Kept as a hook so a declared dark palette later is a
 * change here rather than at every screen.
 */
export function useTheme() {
  return Colors;
}
