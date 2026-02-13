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
