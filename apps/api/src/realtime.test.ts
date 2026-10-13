import { describe, expect, it, vi } from 'vitest';
import { broadcastSeats, setRealtimeServer } from './realtime.js';

describe('realtime invalidation', () => {
  it('broadcasts seat changes only to the screening room', () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    setRealtimeServer({ to } as any);
    broadcastSeats('showtime-123');
    expect(to).toHaveBeenCalledWith('showtime:showtime-123');
    expect(emit).toHaveBeenCalledWith('seats:changed', { showtimeId: 'showtime-123' });
  });
});
