// Marks on the public demo (spec 13 and 23): each server instance keeps its own database, and a session restored on
// another instance never carries marks, so a student there may need to upload them again.

/** True on any host but this machine, which in practice is the public demo deployment. */
export function onPublicDemo(hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname): boolean {
  return !['localhost', '127.0.0.1', '[::1]', ''].includes(hostname);
}

export const PUBLIC_DEMO_MARKS_NOTE =
  'On the public demo, marks stay on the server that received them and are never copied to another, so you may need to upload them again.';
