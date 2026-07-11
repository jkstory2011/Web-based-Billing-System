import '@testing-library/jest-dom/vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mock-server';

// jsdom's Blob implementation doesn't support .stream(), which msw's
// undici-based interceptor needs when constructing binary HttpResponse
// bodies. Node's Buffer Blob is spec-compliant, so swap it in for tests.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
