import { google, calendar_v3 } from 'googleapis';
import { BookingDetails, TimeSlot } from './types';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const TZ = 'Asia/Taipei';
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const SLOT_DURATION_MS = 60 * 60 * 1000; // 1 hour

export class CalendarManager {
    private calendar: calendar_v3.Calendar | null = null;
    private calendarId: string;

    constructor() {
        this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    }

    private getCalendar(): calendar_v3.Calendar {
        if (!this.calendar) {
            const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
            const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

            let credentials: Record<string, unknown> | undefined;

            if (credentialsJson) {
                // Cloud Run: credentials injected as JSON string
                credentials = JSON.parse(credentialsJson);
            } else if (credentialsPath && fs.existsSync(credentialsPath)) {
                // Local dev: credentials from file
                credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
            }
            // else: falls back to ADC (Application Default Credentials)

            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/calendar'],
            });

            this.calendar = google.calendar({ version: 'v3', auth });
        }
        return this.calendar;
    }

    async listEvents(timeMin: Date, timeMax: Date): Promise<calendar_v3.Schema$Event[]> {
        try {
            const response = await this.getCalendar().events.list({
                calendarId: this.calendarId,
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });
            return response.data.items || [];
        } catch (error) {
            console.error('Error listing events:', error);
            throw error;
        }
    }

    async createEvent(details: BookingDetails): Promise<calendar_v3.Schema$Event> {
        const event: calendar_v3.Schema$Event = {
            summary: details.summary,
            description: details.description,
            start: {
                dateTime: details.startTime.toISOString(),
                timeZone: TZ,
            },
            end: {
                dateTime: details.endTime.toISOString(),
                timeZone: TZ,
            },
        };

        try {
            const response = await this.getCalendar().events.insert({
                calendarId: this.calendarId,
                requestBody: event,
            });
            return response.data;
        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }
    }

    /**
     * Get available time slots for a given date (Asia/Taipei timezone).
     * Only returns future slots if querying today.
     */
    async getFreeSlots(date: Date): Promise<TimeSlot[]> {
        // Build start/end in Asia/Taipei
        const dateStr = date.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
        const startOfDay = new Date(`${dateStr}T${String(WORK_START_HOUR).padStart(2, '0')}:00:00+08:00`);
        const endOfDay = new Date(`${dateStr}T${String(WORK_END_HOUR).padStart(2, '0')}:00:00+08:00`);

        const events = await this.listEvents(startOfDay, endOfDay);
        const now = Date.now();

        const slots: TimeSlot[] = [];
        let currentTime = startOfDay.getTime();
        const endTime = endOfDay.getTime();

        while (currentTime + SLOT_DURATION_MS <= endTime) {
            const slotStart = new Date(currentTime);
            const slotEnd = new Date(currentTime + SLOT_DURATION_MS);

            // Skip past slots
            if (slotEnd.getTime() <= now) {
                currentTime += SLOT_DURATION_MS;
                continue;
            }

            const isBusy = events.some(event => {
                const eventStart = new Date(event.start?.dateTime || event.start?.date || 0).getTime();
                const eventEnd = new Date(event.end?.dateTime || event.end?.date || 0).getTime();
                return eventStart < slotEnd.getTime() && eventEnd > slotStart.getTime();
            });

            if (!isBusy) {
                slots.push({ start: slotStart, end: slotEnd });
            }

            currentTime += SLOT_DURATION_MS;
        }
        return slots;
    }
}
