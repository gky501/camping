import { formatScore, scoreClass } from '../lib/scoring';

export function ScoreBadge({ score, compact = false }: { score: number | null; compact?: boolean }) {
  return (
    <span className={`score-badge ${scoreClass(score)} ${compact ? 'score-badge-compact' : ''}`}>
      {formatScore(score)}
    </span>
  );
}
