import Fastify from 'fastify';
import { registerProjectRoutes } from './routes/projects';
import { registerPromptRoutes } from './routes/prompts';
import { registerProviderCapacityRoutes } from './routes/provider-capacity';

export function buildApp() {
  const app = Fastify();

  registerProjectRoutes(app);
  registerPromptRoutes(app);
  registerProviderCapacityRoutes(app);

  return app;
}
