import nodeFetch from 'node-fetch';

import type { HTTPService } from '../../speclynxClient';

const fetchFn = typeof fetch === 'function' ? fetch : (nodeFetch as unknown as typeof fetch);

export function getHTTPService(): HTTPService {
  return {
    async getContent(url) {
      const resp = await fetchFn(url);
      if (!resp.ok) {
        console.error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
        return null;
      }
      const arrayBuffer = await resp.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    },
  };
}
