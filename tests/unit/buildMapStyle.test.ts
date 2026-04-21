import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMapStyle } from '../../src/app/map/buildMapStyle.js';

test('buildMapStyle uses OSM HTTPS tiles when no local prefix is provided', () => {
    const style = buildMapStyle({ localTilesPrefix: null });
    const source = style.sources['osm-raster'];
    assert.ok(source);
    assert.equal(source.tiles.length, 1);
    assert.match(source.tiles[0], /^https:\/\/tile\.openstreetmap\.org\//);
    assert.equal(source.minzoom, 0);
    assert.equal(source.maxzoom, 19);
});

test('buildMapStyle uses file:// URL template when local tiles are available', () => {
    const style = buildMapStyle({
        localTilesPrefix: 'file:///var/mobile/.../map-tiles',
        minZoom: 10,
        maxZoom: 14,
    });
    const source = style.sources['osm-raster'];
    assert.equal(source.tiles[0], 'file:///var/mobile/.../map-tiles/{z}/{x}/{y}.png');
    assert.equal(source.minzoom, 10);
    assert.equal(source.maxzoom, 14);
});

test('buildMapStyle emits a background layer plus the raster overlay', () => {
    const style = buildMapStyle({ localTilesPrefix: null });
    assert.equal(style.layers.length, 2);
    assert.equal(style.layers[0].type, 'background');
    assert.equal(style.layers[1].type, 'raster');
});

test('buildMapStyle always includes an OSM attribution', () => {
    const withLocal = buildMapStyle({ localTilesPrefix: 'file:///tmp/x' });
    const withRemote = buildMapStyle({ localTilesPrefix: null });
    assert.match(withLocal.sources['osm-raster'].attribution ?? '', /OpenStreetMap/);
    assert.match(withRemote.sources['osm-raster'].attribution ?? '', /OpenStreetMap/);
});
