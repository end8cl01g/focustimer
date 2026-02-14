export interface BookingDetails {
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
}

export interface TimeSlot {
    start: Date;
    end: Date;
}

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    description?: string;
}
