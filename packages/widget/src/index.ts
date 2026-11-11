import { VERDICT_SCOPE, looksLikeBadge } from '@countersign/shared';

/**
 * Phase 2 placeholder. The real widget will be served from Countersign's own domain, call
 * `GET /verify/:badge?channel=<origin>` and render the verdict with the scope line.
 */
export type WidgetOptions = { badge: string; trustServiceUrl: string; channel?: string };

export function describeWidget(opts: WidgetOptions): string {
  if (!looksLikeBadge(opts.badge)) return 'Invalid badge';
  return `Countersign verify widget for ${opts.badge}. ${VERDICT_SCOPE}`;
}
