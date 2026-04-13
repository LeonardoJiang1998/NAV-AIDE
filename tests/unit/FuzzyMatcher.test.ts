import test from 'node:test';
import assert from 'node:assert/strict';

import { FuzzyMatcher } from '../../src/core/poi/FuzzyMatcher.js';

const matcher = new FuzzyMatcher();

// --- normalize ---

test('normalize lowercases and strips diacritics', () => {
    assert.equal(matcher.normalize('Café'), 'cafe');
});

test('normalize applies NFKD decomposition for accented characters', () => {
    assert.equal(matcher.normalize('Zürich Hauptbahnhof'), 'zurich hauptbahnhof');
});

test('normalize collapses non-alphanumeric characters into single spaces', () => {
    assert.equal(matcher.normalize('Baker   Street---Station'), 'baker street station');
});

test('normalize trims leading and trailing whitespace', () => {
    assert.equal(matcher.normalize('  Waterloo  '), 'waterloo');
});

test('normalize returns empty string for empty input', () => {
    assert.equal(matcher.normalize(''), '');
});

test('normalize handles purely symbolic input', () => {
    assert.equal(matcher.normalize('!!!'), '');
});

// --- score ---

test('score returns 1 for exact match after normalization', () => {
    assert.equal(matcher.score('Waterloo', 'waterloo'), 1);
});

test('score returns 1 for identical strings', () => {
    assert.equal(matcher.score('Baker Street', 'Baker Street'), 1);
});

test('score returns 0.9 when candidate contains the query', () => {
    assert.equal(matcher.score('Baker', 'Baker Street Station'), 0.9);
});

test('score returns 0.9 when query contains the candidate', () => {
    assert.equal(matcher.score('Baker Street Station', 'Baker'), 0.9);
});

test('score returns 0 when either input normalizes to empty', () => {
    assert.equal(matcher.score('', 'Waterloo'), 0);
    assert.equal(matcher.score('Waterloo', ''), 0);
    assert.equal(matcher.score('!!!', 'Waterloo'), 0);
});

test('score returns a value between 0 and 1 for partial matches', () => {
    const result = matcher.score('Waterlou', 'Waterloo');
    assert.ok(result > 0, `Expected > 0, got ${result}`);
    assert.ok(result < 1, `Expected < 1, got ${result}`);
});

test('score for close misspelling is higher than distant mismatch', () => {
    const close = matcher.score('Waterlou', 'Waterloo');
    const distant = matcher.score('Paddington', 'Waterloo');
    assert.ok(close > distant, `Expected ${close} > ${distant}`);
});

test('score rewards token overlap', () => {
    const withOverlap = matcher.score('Green Park', 'Green Park Station');
    const withoutOverlap = matcher.score('Blue Lake', 'Green Park Station');
    assert.ok(withOverlap > withoutOverlap, `Expected ${withOverlap} > ${withoutOverlap}`);
});

// --- rank ---

test('rank orders items by descending score', () => {
    const items = ['Waterloo', 'Westminster', 'Baker Street'];
    const results = matcher.rank('waterloo', items, (item) => [item]);

    assert.equal(results[0].item, 'Waterloo');
    assert.equal(results[0].score, 1);
});

test('rank uses best score from multiple extracted values', () => {
    const items = [
        { name: 'British Museum', aliases: ['The British Museum', 'BM'] },
    ];

    const results = matcher.rank('British Museum', items, (item) => [item.name, ...item.aliases]);
    assert.equal(results[0].score, 1);
    assert.equal(results[0].matchedValue, 'British Museum');
});

test('rank returns all items even with zero scores', () => {
    const items = ['Waterloo', 'Baker Street'];
    const results = matcher.rank('zzzzz', items, (item) => [item]);

    assert.equal(results.length, 2);
});

test('rank returns empty array for empty items', () => {
    const results = matcher.rank('Waterloo', [], (item) => [item]);
    assert.equal(results.length, 0);
});
