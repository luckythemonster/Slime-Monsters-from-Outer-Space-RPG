// Chapters: the one place that says where each chapter ends and where the next one begins
// (docs/ROADMAP.md, Foundations). Pure module (no Phaser).
//
// A chapter ends by setting its `completeFlag`, saving, and going to the title. CONTINUE on that save does not
// drop the player back where the chapter ended: the title screen asks nextChapterEntry() and, when the next
// chapter exists, starts Explore on that chapter's `entry` script. The entry script owns the hand-off: the card,
// the first map, `state.chapter`. From Chapter 2 on, data ids carry the chapter prefix (ch02_, ch03_, ...);
// Chapter 1's data keeps ep0_.

/** @type {{n: number, title: string, completeFlag: string, entry: string|null}[]} */
export const CHAPTERS = [
  { n: 1, title: 'Coagulation', completeFlag: 'ch1Complete', entry: null },
  { n: 2, title: 'Gig in the Potato Belt', completeFlag: 'ch2Complete', entry: 'ch02_start' },
];

/** The chapter record for a number, or undefined. */
export function chapter(n) { return CHAPTERS.find((c) => c.n === n); }

/**
 * The entry script to run when a save is continued, or null to resume where the save stands.
 * It is the next chapter's entry when the save's own chapter is complete and the next chapter is in the table.
 * @param {{chapter: number, flags: Record<string, any>}} state
 * @returns {string|null}
 */
export function nextChapterEntry(state) {
  const cur = chapter(state.chapter || 1);
  if (!cur || !state.flags || !state.flags[cur.completeFlag]) return null;
  const next = chapter(cur.n + 1);
  return next && next.entry ? next.entry : null;
}
