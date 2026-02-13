import { CalendarService } from '../calendar';
import { DateTime } from 'luxon';

// Mock googleapis
jest.mock('googleapis', () => {
  const mockFreeBusy = jest.fn().mockResolvedValue({
    data: {
      calendars: {
        primary: {
          busy: [
            { start: '2023-10-27T10:00:00+08:00', end: '2023-10-27T11:00:00+08:00' }
          ]
        }
      }
    }
  });

  return {
    google: {
      calendar: jest.fn().mockReturnValue({
        freebusy: {
          query: mockFreeBusy
        }
      }),
      auth: {
        JWT: jest.fn().mockImplementation(() => ({}))
      }
    }
  };
});

describe('CalendarService', () => {
  beforeEach(() => {
    process.env.GOOGLE_CREDENTIALS_JSON = JSON.stringify({ client_email: 'test@test.com', private_key: 'key' });
    process.env.GOOGLE_CALENDAR_ID = 'primary';
  });

  it('should find free slots while excluding busy ones', async () => {
    const service = new CalendarService();
    const slots = await service.getFreeSlots('2023-10-27', 60);

    // Check for some expected free slots
    const slotStrings = slots.map(s => s.toFormat('HH:mm'));

    expect(slotStrings).toContain('09:00');
    expect(slotStrings).not.toContain('09:30'); // Overlaps with 10:00-11:00 busy period (9:30-10:30)
    expect(slotStrings).not.toContain('10:00'); // Exactly busy
    expect(slotStrings).not.toContain('10:30'); // Overlaps with 10:00-11:00 busy period (10:30-11:30)
    expect(slotStrings).toContain('11:00');
  });
});
