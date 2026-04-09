import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getDefaultConfig, mergeConfig } from '@react-native/metro-config';

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = {};

export default mergeConfig(getDefaultConfig(__dirname), config);
