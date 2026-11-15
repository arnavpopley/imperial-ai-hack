// Could item 14: society matching. The top five by interest alignment (spec 8.1 over society topics),
// plus one wildcard from outside the student's top interests.
import type { Society, SocietyMatch, StudentProfile } from '@modulematch/shared';
import { interestAlignment, topicWeightedShare, type TopicWeights } from './scoring.ts';
import { compareIds, topicLabel } from './util.ts';

export const TOP_SOCIETIES = 5;
/** How many of the student's strongest interests count as "top interests" for the wildcard. */
export const TOP_INTEREST_COUNT = 3;
/** An interest below this is one the student said to avoid (the extractor's dislike values sit around 0.1). */
export const DISLIKE_BELOW = 0.3;
/** A wildcard may touch a disliked topic only lightly: no topic the student avoids may weigh this much or more. */
export const WILDCARD_DISLIKE_WEIGHT = 0.3;
/** How many shared topics a match reason names. */
const REASON_TOPICS = 2;

interface ScoredSociety {
  society: Society;
  alignment: number;
}

/** Topic ids sorted by weight, heaviest first, ignoring zero weights. */
const heaviestTopics = (weights: TopicWeights): string[] =>
  Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .sort(([topicA, a], [topicB, b]) => b - a || compareIds(topicA, topicB))
    .map(([topic]) => topic);

function matchReason(interests: TopicWeights, society: Society): string {
  const shared = Object.fromEntries(
    Object.entries(society.topics).map(([topic, weight]) => [topic, weight * (interests[topic] ?? 0)]),
  );
  const named = heaviestTopics(shared).slice(0, REASON_TOPICS).map(topicLabel);
  return named.length > 0 ? `Shares your interests: ${named.join(' and ')}.` : 'No overlap with your stated interests yet.';
}

/** Says the wildcard is outside the top interests only when none of its topics are among them. */
function wildcardReason(society: Society, topInterests: TopicWeights): string {
  const topics = heaviestTopics(society.topics);
  const [main] = topics;
  if (main === undefined) return 'Something different from your top interests.';
  return topics.some((topic) => Object.hasOwn(topInterests, topic))
    ? `The most different option left: centred on ${topicLabel(main)}, though it shares some of your top interests.`
    : `Something different: centred on ${topicLabel(main)}, outside your top interests.`;
}

const toMatch = ({ society, alignment }: ScoredSociety, wildcard: boolean, reason: string): SocietyMatch => ({
  societyId: society.id,
  fit: Math.round(100 * alignment),
  wildcard,
  reason,
});

/**
 * Top TOP_SOCIETIES societies by interest alignment, then a wildcard: of the rest that give no real weight to a
 * topic the student said to avoid (interest under DISLIKE_BELOW), the one whose topic weight overlaps least with
 * the student's top interests, breaking ties by alignment and then id. No wildcard when every one is excluded.
 */
export function matchSocieties(profile: StudentProfile, societies: readonly Society[]): SocietyMatch[] {
  const scored = societies
    .map((society) => ({ society, alignment: interestAlignment(profile.interests, society.topics) }))
    .sort((a, b) => b.alignment - a.alignment || compareIds(a.society.id, b.society.id));

  const topInterests = Object.fromEntries(
    heaviestTopics(profile.interests)
      .slice(0, TOP_INTEREST_COUNT)
      .map((topic) => [topic, 1]),
  );
  // Issue 117: a wildcard stretches the student, but never towards something they said they would avoid.
  const disliked = new Set(
    Object.entries(profile.interests)
      .filter(([, weight]) => weight < DISLIKE_BELOW)
      .map(([topic]) => topic),
  );
  const avoidsDislikes = (society: Society) =>
    Object.entries(society.topics).every(([topic, weight]) => !disliked.has(topic) || weight < WILDCARD_DISLIKE_WEIGHT);
  const wildcard = scored
    .slice(TOP_SOCIETIES)
    .filter((entry) => avoidsDislikes(entry.society))
    .map((entry) => ({ entry, overlap: topicWeightedShare(topInterests, entry.society.topics) ?? 0 }))
    .sort(
      (a, b) =>
        a.overlap - b.overlap ||
        b.entry.alignment - a.entry.alignment ||
        compareIds(a.entry.society.id, b.entry.society.id),
    )[0]?.entry;

  return [
    ...scored.slice(0, TOP_SOCIETIES).map((entry) => toMatch(entry, false, matchReason(profile.interests, entry.society))),
    ...(wildcard ? [toMatch(wildcard, true, wildcardReason(wildcard.society, topInterests))] : []),
  ];
}
