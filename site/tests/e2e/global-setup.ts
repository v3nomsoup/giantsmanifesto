import { MAILPIT_API } from './env';
import { clearMailbox } from './mailpit';

export default async function globalSetup() {
  try {
    await clearMailbox();
  } catch (error) {
    throw new Error(
      `Mailpit is not reachable at ${MAILPIT_API}. Start it with ` +
        '`podman run --rm -d -p 1025:1025 -p 8025:8025 --name mailpit axllent/mailpit`.',
      { cause: error },
    );
  }
}
