/**
 * six_inch_stage_ext — `six_inch_stage` heard from outside Palmer's: the same
 * song object with the pulse2 melody at volume 0 (the vocal does not get
 * through the wall; the boogie, the bass and the kit do). Shares every pattern
 * and the order with six_inch_stage.
 */
import inside from './six_inch_stage.js';

export default {
  ...inside,
  id: 'six_inch_stage_ext',
  title: 'Six-Inch Stage (outside)',
  channels: { ...inside.channels, pulse2: { ...inside.channels.pulse2, volume: 0 } },
};
