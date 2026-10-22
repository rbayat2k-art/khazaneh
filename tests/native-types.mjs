// The installed Node runtime strips TypeScript; resolve this project's extensionless
// relative imports for isolated tests, without a transpiler process or auth mocks.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || !context.parentURL?.startsWith(root)) throw error;
      const candidate = new URL(specifier + '.ts', context.parentURL);
      if (!candidate.href.startsWith(root) || candidate.href.includes('/node_modules/') || !existsSync(fileURLToPath(candidate))) throw error;
      return nextResolve(candidate.href, context);
    }
  },
});
