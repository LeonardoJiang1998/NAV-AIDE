import assert from 'node:assert/strict';

import { assertNoHallucinatedPlaceNames } from '../../../src/core/llm/ResponseRenderer.js';

export function assertGoldenOutputHasNoHallucinations(referencedPlaceNames: string[], allowedPlaceNames: string[]): void {
    assert.doesNotThrow(() => assertNoHallucinatedPlaceNames(referencedPlaceNames, allowedPlaceNames));
}