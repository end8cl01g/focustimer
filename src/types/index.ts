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

export interface TimerState {
    activeTaskId: string | null;
    timers: Record<string, {
        seconds: number;
        isRunning: boolean;
        autoStarted?: boolean;
    }>;
    lastTick: number;
}
