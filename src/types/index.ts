export interface BookingSlot {
  start: Date;
  end: Date;
}

export interface UserSession {
  selectedDate?: string;
  selectedTime?: string;
  duration?: number;
  action?: 'booking' | 'managing';
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  start: string;
  end: string;
}
