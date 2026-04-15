import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRouteNarrative, displayNameForLine } from '../../src/core/pipeline/RouteNarrative.js';

test('displayNameForLine maps known line ids', () => {
    assert.equal(displayNameForLine('jubilee'), 'Jubilee line');
    assert.equal(displayNameForLine('hammersmith-city'), 'Hammersmith & City line');
    assert.equal(displayNameForLine('dlr'), 'DLR');
    assert.equal(displayNameForLine('elizabeth'), 'Elizabeth line');
});

test('displayNameForLine falls back to a generic name for unknown ids', () => {
    assert.equal(displayNameForLine('some-new-line'), 'some-new-line line');
});

test('buildRouteNarrative handles single-segment journeys with intermediate stops', () => {
    const segments = [
        {
            lineId: 'jubilee',
            stations: ['Waterloo', 'Westminster', 'Green Park', 'Bond Street', 'Baker Street'],
        },
    ];

    const narrative = buildRouteNarrative('Waterloo', 'Baker Street', segments, 8);

    assert.ok(narrative.includes('Jubilee line 4 stops'));
    assert.ok(narrative.includes('Stops on the way: Westminster, Green Park, Bond Street.'));
    assert.ok(narrative.endsWith('Total travel time: 8 minutes.'));
});

test('buildRouteNarrative condenses stops on long single-segment journeys', () => {
    const stations = Array.from({ length: 12 }, (_, index) => `Station ${index}`);
    const segments = [{ lineId: 'elizabeth', stations }];

    const narrative = buildRouteNarrative('Station 0', 'Station 11', segments, 22);

    assert.ok(narrative.includes('Elizabeth line 11 stops'));
    assert.ok(narrative.includes('…'));
    assert.ok(narrative.endsWith('Total travel time: 22 minutes.'));
});

test('buildRouteNarrative describes interchanges for multi-segment journeys', () => {
    const segments = [
        { lineId: 'elizabeth', stations: ['Stratford', 'Whitechapel', 'Liverpool Street'] },
        { lineId: 'central', stations: ['Liverpool Street', 'Bank', 'Tottenham Court Road'] },
    ];

    const narrative = buildRouteNarrative('Stratford', 'Tottenham Court Road', segments, 14);

    assert.ok(narrative.startsWith('Start at Stratford.'));
    assert.ok(narrative.includes('Take the Elizabeth line 2 stops to Liverpool Street.'));
    assert.ok(narrative.includes('Change to the Central line and ride 2 stops to Tottenham Court Road.'));
    assert.ok(narrative.endsWith('Total travel time: 14 minutes.'));
});

test('buildRouteNarrative handles same-station queries gracefully', () => {
    const narrative = buildRouteNarrative('Waterloo', 'Waterloo', [], 0);
    assert.equal(narrative, "You're already at Waterloo.");
});

test('buildRouteNarrative reports when no tube route is possible', () => {
    const narrative = buildRouteNarrative('Waterloo', 'Canary Wharf', [], 0);
    assert.equal(narrative, 'No tube route was found from Waterloo to Canary Wharf.');
});
