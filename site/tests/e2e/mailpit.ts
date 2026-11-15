import { MAILPIT_API } from './env';

export interface Mail {
  id: string;
  subject: string;
  text: string;
}

interface Summary {
  ID: string;
  Created: string;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${MAILPIT_API}${path}`, init);
  if (!response.ok) throw new Error(`Mailpit ${init?.method ?? 'GET'} ${path}: ${response.status}`);
  return response;
}

/** Deletes every message in Mailpit. */
export async function clearMailbox(): Promise<void> {
  await api('/messages', { method: 'DELETE' });
}

/** IDs of all messages to `address`, newest first. */
export async function mailIdsTo(address: string): Promise<string[]> {
  const query = encodeURIComponent(`to:"${address}"`);
  const body = (await (await api(`/search?query=${query}`)).json()) as { messages: Summary[] };
  return body.messages
    .toSorted((a, b) => Date.parse(b.Created) - Date.parse(a.Created))
    .map((m) => m.ID);
}

/**
 * The newest message to `address` whose ID is not in `ignore`, polling for up to 45 seconds
 * (the mail worker sends every 30 seconds).
 */
export async function latestMailTo(
  address: string,
  { ignore = [], timeoutMs = 45_000 }: { ignore?: string[]; timeoutMs?: number } = {},
): Promise<Mail> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const id = (await mailIdsTo(address)).find((candidate) => !ignore.includes(candidate));
    if (id) {
      const message = (await (await api(`/message/${id}`)).json()) as {
        Subject: string;
        Text: string;
      };
      return { id, subject: message.Subject, text: message.Text };
    }
    if (Date.now() > deadline) throw new Error(`no mail to ${address} within ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
