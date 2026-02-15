/**
 * Focus Timer Bot — Google Apps Script Calendar Bridge
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
            case 'deleteEvent':
                return jsonResponse(handleDeleteEvent(body));
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

    // Conflict Check
    const conflicts = cal.getEvents(start, end);
    if (conflicts.length > 0) {
        return {
            error: 'CONFLICT',
            message: '時段與現有行程衝突',
            conflicts: conflicts.map(c => c.getTitle())
        };
    }

    const event = cal.createEvent(summary, start, end, {
        description: description || '',
    });

    return {
        id: event.getId(),
        title: event.getTitle(),
        start: start.toISOString(),
        end: end.toISOString(),
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

function handleDeleteEvent(body) {
    const { eventId } = body;
    if (!eventId) {
        throw new Error('Missing required field: eventId');
    }

    const cal = CalendarApp.getCalendarById(CALENDAR_ID);
    const event = cal.getEventById(eventId);

    if (!event) {
        return { error: 'NOT_FOUND', message: '找不到該行程' };
    }

    event.deleteEvent();
    return { success: true, id: eventId };
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
