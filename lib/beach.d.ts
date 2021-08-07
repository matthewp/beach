import type { Ocean } from 'https://cdn.spooky.click/ocean/1.0.0/mod.js';

interface BeachOptions {
  document?: any;
  ocean?: Ocean;
}

type FetchCallback = (event: any) => void;

declare class Beach {
  addEventListener: (name: 'fetch', cb: FetchCallback) => void;
  html: (strings: string[], ...values: any[]) => AsyncIterator<string, void, undefined>;
  

  constructor(opts?: BeachOptions);
}

export {
  Beach
};