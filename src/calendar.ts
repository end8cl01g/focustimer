import { google } from 'googleapis';
import { DateTime } from 'luxon';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TIMEZONE = 'Asia/Taipei';

export class CalendarService {
  private calendar = google.calendar('v3');
  private auth: any;
  private calendarId: string;

  constructor() {
    this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || '{}');
      if (credentials.client_email && credentials.private_key) {
        this.auth = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: SCOPES
        });
      } else {
        console.warn('GOOGLE_CREDENTIALS_JSON is not properly set.');
      }
    } catch (e) {
      console.error('Failed to parse GOOGLE_CREDENTIALS_JSON', e);
    }
  }

  async getFreeSlots(date: string, durationMinutes: number = 60) {
    if (!this.auth) throw new Error('Calendar Service not authenticated');

    const startOfDay = DateTime.fromISO(date).setZone(TIMEZONE).set({ hour: 9, minute: 0, second: 0 });
    const endOfDay = DateTime.fromISO(date).setZone(TIMEZONE).set({ hour: 21, minute: 0, second: 0 });

    const response = await this.calendar.freebusy.query({
      auth: this.auth,
      requestBody: {
        timeMin: startOfDay.toISO()!,
        timeMax: endOfDay.toISO()!,
        items: [{ id: this.calendarId }],
      },
    });

    const busy = response.data.calendars?.[this.calendarId]?.busy || [];

    const slots = [];
    let current = startOfDay;
    while (current.plus({ minutes: durationMinutes }) <= endOfDay) {
      const slotEnd = current.plus({ minutes: durationMinutes });
      const isBusy = busy.some(b => {
        const bStart = DateTime.fromISO(b.start!);
        const bEnd = DateTime.fromISO(b.end!);
        return (current < bEnd && slotEnd > bStart);
      });

      if (!isBusy) {
        slots.push(current);
      }
      current = current.plus({ minutes: 30 });
    }

    return slots;
  }

  async createEvent(summary: string, start: DateTime, durationMinutes: number) {
    if (!this.auth) throw new Error('Calendar Service not authenticated');

    const end = start.plus({ minutes: durationMinutes });
    const response = await this.calendar.events.insert({
      auth: this.auth,
      calendarId: this.calendarId,
      requestBody: {
        summary,
        start: { dateTime: start.toISO()!, timeZone: TIMEZONE },
        end: { dateTime: end.toISO()!, timeZone: TIMEZONE },
      },
    });
    return response.data;
  }

  async listUserEvents(userId: string) {
    if (!this.auth) throw new Error('Calendar Service not authenticated');

    const response = await this.calendar.events.list({
      auth: this.auth,
      calendarId: this.calendarId,
      timeMin: DateTime.now().setZone(TIMEZONE).toISO()!,
      singleEvents: true,
      orderBy: 'startTime',
      q: `tg_user_${userId}`,
    });
    return response.data.items || [];
  }

  async deleteEvent(eventId: string) {
    if (!this.auth) throw new Error('Calendar Service not authenticated');

    await this.calendar.events.delete({
      auth: this.auth,
      calendarId: this.calendarId,
      eventId,
    });
  }
}
