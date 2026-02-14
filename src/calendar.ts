import { BookingDetails, TimeSlot, CalendarEvent } from './types';
import * as dotenv from 'dotenv';
dotenv.config();

const GAS_URL = process.env.GAS_WEBAPP_URL;
const GAS_API_KEY = process.env.GAS_API_KEY || '';

interface GasSlot {
    start: string;
    end: string;
    startTimestamp: number;
}

interface GasEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    htmlLink?: string;
    description?: string;
}

async function gasCall<T>(action: string, body: Record<string, unknown>): Promise<T> {
    if (!GAS_URL) {
        throw new Error('GAS_WEBAPP_URL not configured');
    }

    const url = `${GAS_URL}?action=${action}`;
    const payload = { ...body, apiKey: GAS_API_KEY };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow', // GAS redirects on exec
    });

    if (!response.ok) {
        throw new Error(`GAS bridge error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as T & { error?: string };
    if (data.error) {
        throw new Error(`GAS error: ${data.error}`);
    }

    return data;
}

export class CalendarManager {
    /** Format: YYYY-MM-DD in Asia/Taipei */
    private toDateStr(d: Date): string {
        const shifted = new Date(d.getTime() + 8 * 3600000);
        return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
    }

    async getFreeSlots(date: Date): Promise<TimeSlot[]> {
        const dateStr = this.toDateStr(date);
        const result = await gasCall<{ slots: GasSlot[] }>('getFreeSlots', { date: dateStr });

        return result.slots.map(s => ({
            start: new Date(s.start),
            end: new Date(s.end),
        }));
    }

    async listEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
        const result = await gasCall<{ events: GasEvent[] }>('listEvents', {
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
        });

        return result.events.map(ev => ({
            id: ev.id,
            title: ev.title,
            start: new Date(ev.start),
            end: new Date(ev.end),
            description: ev.description,
        }));
    }

    async createEvent(details: BookingDetails): Promise<GasEvent> {
        return gasCall<GasEvent>('createEvent', {
            summary: details.summary,
            description: details.description || '',
            startTime: details.startTime.toISOString(),
            endTime: details.endTime.toISOString(),
        });
    }
}
