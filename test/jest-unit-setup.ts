import { register } from 'prom-client';

afterEach(() => {
  register.clear();
});
