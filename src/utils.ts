/** Format a Date to HH:mm in Asia/Taipei */
export function formatTime(d: Date): string {
    const shifted = new Date(d.getTime() + 8 * 3600000);
    return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

/** Format a Date to YYYY/MM/DD in Asia/Taipei */
export function formatDate(d: Date): string {
    const shifted = new Date(d.getTime() + 8 * 3600000);
    return `${shifted.getUTCFullYear()}/${String(shifted.getUTCMonth() + 1).padStart(2, '0')}/${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Format a Date to full datetime string */
export function formatDateTime(d: Date): string {
    return `${formatDate(d)} ${formatTime(d)}`;
}
