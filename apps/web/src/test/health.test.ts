import { describe, expect, it } from 'vitest';
import { GET } from '../app/api/health/route';

describe('Frontend Health Check API Route', () => {
  it('returns status 200 with healthy payload', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('@aether/web');
    expect(body.version).toBe('0.1.0');
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });
});
