import type { CSSProperties } from 'react';
import { palette } from '../../../theme/palette';
import type { TripIcon } from '../types';

/**
 * Cover gradients per trip icon. Built from the shared palette (not Tailwind
 * arbitrary-value classes) because Tailwind's class scanner only recognizes
 * literal class strings — it can't see colors interpolated from a JS import.
 */
export const ICON_GRADIENT_STYLE: Record<TripIcon, CSSProperties> = {
  landmark: { backgroundImage: `linear-gradient(160deg, ${palette.oceanLight}, ${palette.ocean})` },
  beach: { backgroundImage: `linear-gradient(160deg, ${palette.amberLight}, ${palette.amber})` },
  lantern: { backgroundImage: `linear-gradient(160deg, ${palette.coralLight}, ${palette.coral})` },
  settlement: { backgroundImage: `linear-gradient(160deg, ${palette.violetLight}, ${palette.violet})` },
  noodles: { backgroundImage: `linear-gradient(160deg, ${palette.mintLight}, ${palette.mint})` },
  ski: { backgroundImage: `linear-gradient(160deg, ${palette.ideaLight}, ${palette.idea})` },
};
