import test from 'node:test';
import assert from 'node:assert/strict';

import { formatFilenameDate, getDefaultWeeklyWindow } from '../src/time.ts';

test('computes Monday 00:00 weekly boundary in the selected timezone', () => {
  const now = new Date('2026-05-06T12:00:00.000Z');
  const window = getDefaultWeeklyWindow('Asia/Shanghai', now);

  assert.equal(window.since.toISOString(), '2026-05-03T16:00:00.000Z');
  assert.equal(window.until.toISOString(), '2026-05-06T12:00:00.000Z');
});

test('formats dates for report filenames in the selected timezone', () => {
  assert.equal(
    formatFilenameDate(new Date('2026-05-03T16:00:00.000Z'), 'Asia/Shanghai'),
    '20260504',
  );
});
