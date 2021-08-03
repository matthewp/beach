import type { Ocean } from 'https://cdn.spooky.click/ocean/1.0.0/mod.js';

interface BeachOptions {
  document?: any;
  ocean?: Ocean;
}

type FetchCallback = (event: any) => void;

/*
export const addEventListener = beach.addEventListener;
export const html = beach.html;
export const route = beach.route;
export const startServer = beach.startServer;
*/

declare class Beach {
  addEventListener: (name: 'fetch', cb: FetchCallback) => void;
  html: (strings: string[], ...values: any[]) => AsyncIterator<string, void, undefined>;
  

  constructor(opts?: BeachOptions);
}

export {
  Beach
};