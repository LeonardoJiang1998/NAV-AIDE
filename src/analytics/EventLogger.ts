export interface AnalyticsEvent {
    eventName: string;
    deviceId: string;
    occurredAt: string;
    payload: Record<string, unknown>;
}

export class EventLogger {
    private readonly events: AnalyticsEvent[] = [];

    public log(event: AnalyticsEvent): void {
        this.events.push(event);
    }

    public readAll(): AnalyticsEvent[] {
        return [...this.events];
    }
}