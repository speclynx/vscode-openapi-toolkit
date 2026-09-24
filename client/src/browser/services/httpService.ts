import type { HTTPService } from '../../speclynxClient';

export function getHTTPService(): HTTPService {
  return {
    async getContent(url) {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
        return null;
      }
      const ab = await resp.arrayBuffer();
      return new Uint8Array(ab);
    },
  };
}
