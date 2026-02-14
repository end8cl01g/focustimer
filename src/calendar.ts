import { google, calendar_v3 } from 'googleapis';
import { BookingDetails, TimeSlot } from './types';
import * as dotenv from 'dotenv';
dotenv.config();

export class CalendarManager {
    private calendar: calendar_v3.Calendar | null = null;
    private calendarId: string;

    constructor() {
        this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    }

    private getCalendar(): calendar_v3.Calendar {
        if (!this.calendar) {
            const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

            const auth = new google.auth.GoogleAuth({
                credentials: credentialsJson ? JSON.parse(credentialsJson) : undefined,
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
                timeZone: 'Asia/Taipei', // Fixed timezone as per requirements
            },
            end: {
                dateTime: details.endTime.toISOString(),
                timeZone: 'Asia/Taipei',
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

    // Simple free slot checker (naive implementation)
    async getFreeSlots(date: Date): Promise<TimeSlot[]> {
        // Define working hours, e.g., 09:00 to 18:00
        const startOfDay = new Date(date);
        startOfDay.setHours(9, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(18, 0, 0, 0);

        const events = await this.listEvents(startOfDay, endOfDay);

        const slots: TimeSlot[] = [];
        let currentTime = startOfDay.getTime();
        const endTime = endOfDay.getTime();
        const durationMs = 60 * 60 * 1000; // 1 hour slots

        while (currentTime + durationMs <= endTime) {
            const slotStart = new Date(currentTime);
            const slotEnd = new Date(currentTime + durationMs);

            const isBusy = events.some(event => {
                const eventStart = new Date(event.start?.dateTime || event.start?.date || 0).getTime();
                const eventEnd = new Date(event.end?.dateTime || event.end?.date || 0).getTime();
                return (eventStart < slotEnd.getTime()) && (eventEnd > slotStart.getTime());
            });

            if (!isBusy) {
                slots.push({ start: slotStart, end: slotEnd });
            }

            currentTime += durationMs; // Move by 1 hour
        }
        return slots;
    }
}
