const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Returns a new Date object shifted to Asia/Taipei time for formatting purposes */
export function getTaipeiDate(d: Date = new Date()): Date {
    return new Date(d.getTime() + TAIPEI_OFFSET_MS);
}

/** Returns the UTC Date corresponding to the start of the day (00:00) in Asia/Taipei */
export function getTaipeiStartOfDay(d: Date = new Date()): Date {
    const taipei = getTaipeiDate(d);
    return new Date(Date.UTC(taipei.getUTCFullYear(), taipei.getUTCMonth(), taipei.getUTCDate(), -8, 0, 0, 0));
}

/** Returns the UTC Date corresponding to the end of the day (23:59:59.999) in Asia/Taipei */
export function getTaipeiEndOfDay(d: Date = new Date()): Date {
    const taipei = getTaipeiDate(d);
    return new Date(Date.UTC(taipei.getUTCFullYear(), taipei.getUTCMonth(), taipei.getUTCDate(), 15, 59, 59, 999));
}

/** Format a Date to HH:mm in Asia/Taipei */
export function formatTime(d: Date): string {
    const shifted = getTaipeiDate(d);
    return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

/** Format a Date to YYYY/MM/DD in Asia/Taipei */
export function formatDate(d: Date): string {
    const shifted = getTaipeiDate(d);
    return `${shifted.getUTCFullYear()}/${String(shifted.getUTCMonth() + 1).padStart(2, '0')}/${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Format a Date to YYYY-MM-DD in Asia/Taipei */
export function formatDateISO(d: Date): string {
    const shifted = getTaipeiDate(d);
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Format a Date to full datetime string */
export function formatDateTime(d: Date): string {
    return `${formatDate(d)} ${formatTime(d)}`;
}
