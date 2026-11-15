// @vitest-environment happy-dom
// On the public demo, parallel requests wake server instances that do not have the session, so the client sends one
// API request at a time, in order, and a streamed chat reply holds its turn until the stream ends.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, sendMessage } from './api.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A fetch whose responses the test releases one by one, recording when each request starts. */
function heldFetch() {
  const started: string[] = [];
  const release: (() => void)[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = String(input);
    started.push(path);
    return new Promise<Response>((resolve) => {
      release.push(() => resolve(new Response(JSON.stringify({ path }), { status: 200 })));
    });
  });
  return { started, release };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the API queue', () => {
  it('never has two requests in flight, and sends them first in, first out', async () => {
    const { started, release } = heldFetch();
    const first = api.getSession('s1');
    const second = api.recommendations('s1');
    const third = api.modules();
    await tick();
    expect(started).toEqual(['/api/sessions/s1']);

    release[0]!();
    await first;
    await tick();
    expect(started).toEqual(['/api/sessions/s1', '/api/sessions/s1/recommendations']);

    release[1]!();
    await second;
    await tick();
    release[2]!();
    await third;
    expect(started).toEqual(['/api/sessions/s1', '/api/sessions/s1/recommendations', '/api/modules']);
  });

  it('moves on after a failed request', async () => {
    const started: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      started.push(String(input));
      return started.length === 1 ? new Response('boom', { status: 500 }) : new Response('[]', { status: 200 });
    });
    await expect(api.modules()).rejects.toThrow('500 boom');
    await expect(api.pathways()).resolves.toEqual([]);
    expect(started).toEqual(['/api/modules', '/api/pathways']);
  });

  it('holds the slot while a chat reply streams, and sends the next request once the stream ends', async () => {
    const started: string[] = [];
    let push: (text: string) => void = () => {};
    let end: () => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      started.push(String(input));
      if (String(input).endsWith('/messages')) {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const enc = new TextEncoder();
            push = (text) => controller.enqueue(enc.encode(text));
            end = () => controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      }
      return new Response('[]', { status: 200 });
    });
    const events: string[] = [];
    const reply = sendMessage('s1', { content: 'hi' }, (e) => events.push(e.type));
    const after = api.pathways();
    await tick();
    push('data: {"type":"token","text":"Hello","agent":"interviewer"}\n\n');
    await tick();
    expect(started).toEqual(['/api/sessions/s1/messages']);

    push('data: {"type":"done","messageId":"m1","widget":null}\n\n');
    end();
    await reply;
    await after;
    expect(events).toEqual(['token', 'done']);
    expect(started).toEqual(['/api/sessions/s1/messages', '/api/pathways']);
  });
});
