export interface DeviceIdProvider {
    getDeviceId(): Promise<string>;
}