import { describe, expect, it } from 'vitest';

import { testQuadTree } from './TestQuadTree';

describe('QuadTree', () => {
  it('passes the existing quadtree validation suite', () => {
    expect(testQuadTree()).toBe(true);
  });
});
