/**
 * Focus Timer Bot — Google Apps Script Calendar Bridge
 * 
 * Deploy as Web App:
 *   1. Open https://script.google.com → New Project
 *   2. Paste this entire file
 *   3. Deploy → New Deployment → Web App
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   4. Copy the URL → set as GAS_WEBAPP_URL in .env
 *
 * Endpoints (all POST with JSON body):
 *   ?action=getFreeSlots  { date: "YYYY-MM-DD" }
 *   ?action=createEvent   { summary, description, startTime, endTime }
 *   ?action=listEvents    { timeMin, timeMax }
 *
 * Security: Set API_KEY below and pass it in the request header or body.
 */

// ─── Config ───
const CALENDAR_ID = 'primary';
const TIMEZONE = 'Asia/Taipei';
const WORK_START = 9;  // 09:00
const WORK_END = 18;   // 18:00
const SLOT_DURATION_MIN = 60; // minutes
const API_KEY = ''; // Set a secret key here, leave empty to disable auth

// ─── Entry Points ───

function doPost(e) {
    try {
        const body = JSON.parse(e.postData.contents || '{}');
        const action = e.parameter.action || body.action;

        // Auth check
        if (API_KEY && body.apiKey !== API_KEY) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        switch (action) {
            case 'getFreeSlots':
                return jsonResponse(handleGetFreeSlots(body));
            case 'createEvent':
                return jsonResponse(handleCreateEvent(body));
            case 'listEvents':
                return jsonResponse(handleListEvents(body));
            default:
                return jsonResponse({ error: `Unknown action: "${action}"` }, 400);
        }
    } catch (err) {
        return jsonResponse({ error: err.message }, 500);
    }
}

function doGet(e) {
    const action = e.parameter.action;
    if (action === 'health') {
        return jsonResponse({ status: 'ok', calendar: CALENDAR_ID });
    }
    return jsonResponse({ error: 'Use POST for API calls. GET ?action=health for status.' }, 400);
}

// ─── Handlers ───

function handleGetFreeSlots(body) {
    const dateStr = body.date; // "YYYY-MM-DD"
    if (!dateStr) throw new Error(`Missing "date" parameter for action "getFreeSlots"`);

    const startOfDay = new Date(`${dateStr}T${pad(WORK_START)}:00:00`);
    const endOfDay = new Date(`${dateStr}T${pad(WORK_END)}:00:00`);
    const now = new Date();

    const events = CalendarApp.getCalendarById(CALENDAR_ID).getEvents(startOfDay, endOfDay);

    const slots = [];
    const slotMs = SLOT_DURATION_MIN * 60 * 1000;
    let cursor = startOfDay.getTime();

    while (cursor + slotMs <= endOfDay.getTime()) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor + slotMs);

        // Skip past slots
        if (slotEnd.getTime() <= now.getTime()) {
            cursor += slotMs;
            continue;
        }

        const isBusy = events.some(ev => {
            const evStart = ev.getStartTime().getTime();
            const evEnd = ev.getEndTime().getTime();
            return evStart < slotEnd.getTime() && evEnd > slotStart.getTime();
        });

        if (!isBusy) {
            slots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
                startTimestamp: slotStart.getTime(),
            });
        }

        cursor += slotMs;
    }

    return { slots, date: dateStr, count: slots.length };
}

function handleCreateEvent(body) {
    const { summary, description, startTime, endTime } = body;
    if (!summary || !startTime || !endTime) {
        throw new Error('Missing required fields: summary, startTime, endTime');
    }

    const cal = CalendarApp.getCalendarById(CALENDAR_ID);
    const start = new Date(startTime);
    const end = new Date(endTime);

    const event = cal.createEvent(summary, start, end, {
        description: description || '',
    });

    return {
        id: event.getId(),
        title: event.getTitle(),
        start: start.toISOString(),
        end: end.toISOString(),
        htmlLink: `https://calendar.google.com/calendar/event?eid=${Utilities.base64Encode(event.getId() + ' ' + CALENDAR_ID)}`,
    };
}

function handleListEvents(body) {
    const { timeMin, timeMax } = body;
    if (!timeMin || !timeMax) {
        throw new Error('Missing required fields: timeMin, timeMax');
    }

    const cal = CalendarApp.getCalendarById(CALENDAR_ID);
    const events = cal.getEvents(new Date(timeMin), new Date(timeMax));

    return {
        events: events.map(ev => ({
            id: ev.getId(),
            title: ev.getTitle(),
            start: ev.getStartTime().toISOString(),
            end: ev.getEndTime().toISOString(),
            description: ev.getDescription(),
        })),
        count: events.length,
    };
}

// ─── Utilities ───

function jsonResponse(data, code) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

function pad(n) {
    return String(n).padStart(2, '0');
}
