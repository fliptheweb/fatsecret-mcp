import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_IMAGE_B64_LENGTH, resolveImageB64 } from '../src/image.js';

const fakeRead = (bytes: number) => () => Buffer.alloc(bytes, 1);

test('resolveImageB64 base64-encodes an image file', () => {
  assert.equal(resolveImageB64({ image_path: '/tmp/a.JPG' }, () => Buffer.from('hi')), 'aGk=');
});

test('resolveImageB64 refuses non-image paths', () => {
  assert.throws(() => resolveImageB64({ image_path: '/Users/me/.ssh/id_rsa' }, fakeRead(10)), /must be a \.jpg/);
});

test('resolveImageB64 strips a data URL prefix from image_b64', () => {
  assert.equal(resolveImageB64({ image_b64: 'data:image/png;base64,AAAA' }), 'AAAA');
});

test('resolveImageB64 enforces the FatSecret size limit', () => {
  const tooBig = Math.ceil((MAX_IMAGE_B64_LENGTH + 4) / 4) * 3;
  assert.throws(() => resolveImageB64({ image_path: 'big.png' }, fakeRead(tooBig)), /too large/);
});

test('resolveImageB64 needs an image', () => {
  assert.throws(() => resolveImageB64({}), /Provide image_path or image_b64/);
});
