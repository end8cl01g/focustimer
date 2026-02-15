import fs from 'fs';
import path from 'path';
import { TimerState } from './types';

const TIMER_STATE_FILE = path.join(__dirname, '../data/timer_state.json');

export function readTimerState(): TimerState {
    try {
        if (fs.existsSync(TIMER_STATE_FILE)) {
            return JSON.parse(fs.readFileSync(TIMER_STATE_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('Error reading timer state:', e);
    }
    return { activeTaskId: null, timers: {}, lastTick: Date.now() };
}

export function writeTimerState(state: TimerState) {
    try {
        const dir = path.dirname(TIMER_STATE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(TIMER_STATE_FILE, JSON.stringify(state));
    } catch (e) {
        console.error('Error writing timer state:', e);
    }
}

export function catchUpTimerState(state: TimerState): TimerState {
    const now = Date.now();
    const lastTick = state.lastTick || now;
    const diffSec = Math.floor((now - lastTick) / 1000);

    if (state.timers && diffSec > 0) {
        let changed = false;
        for (const id of Object.keys(state.timers)) {
            if (state.timers[id].isRunning) {
                state.timers[id].seconds += diffSec;
                changed = true;
            }
        }
        if (changed) {
            state.lastTick = now;
            writeTimerState(state);
        }
    }
    return state;
}
