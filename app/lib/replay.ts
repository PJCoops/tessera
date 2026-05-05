import { puzzleNumber } from "./rng";

// Resolves the puzzle a request should render given URL params.
//
// `?day=YYYY-MM-DD` is the replay URL. A past date opens that puzzle in
// isolated replay mode (no result/progress writes, no streak update,
// no email signup). Today's date and future dates fall back silently
// to the live puzzle so a tampered URL doesn't reveal upcoming days.
export type Resolved = {
  date: string;       // YYYY-MM-DD UTC
  num: number;        // puzzle number relative to epoch
  replay: boolean;    // true iff we're rendering a past puzzle isolated
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolvePuzzleFromParams(
  params: URLSearchParams,
  todayDate: string,
  epoch: string
): Resolved {
  const today = { date: todayDate, num: puzzleNumber(todayDate, epoch), replay: false };
  const raw = params.get("day");
  if (!raw || !DATE_RE.test(raw)) return today;
  // Reject any date that doesn't round-trip through Date — catches things
  // like 2026-13-40 that pass the regex but aren't real days.
  const [y, m, d] = raw.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  if (Number.isNaN(ms)) return today;
  const round = new Date(ms);
  if (
    round.getUTCFullYear() !== y ||
    round.getUTCMonth() !== m - 1 ||
    round.getUTCDate() !== d
  ) {
    return today;
  }
  if (raw >= todayDate) return today;
  const num = puzzleNumber(raw, epoch);
  if (num < 1) return today;
  return { date: raw, num, replay: true };
}
