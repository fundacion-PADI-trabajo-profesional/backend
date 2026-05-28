import { AsyncLocalStorage } from 'async_hooks';

export interface RLSClaims {
  sub: string;
  email: string;
  role: string;
}

const storage = new AsyncLocalStorage<RLSClaims>();

export const rlsContext = {
  run<T>(claims: RLSClaims, fn: () => T): T {
    return storage.run(claims, fn);
  },
  get(): RLSClaims | undefined {
    return storage.getStore();
  },
};
