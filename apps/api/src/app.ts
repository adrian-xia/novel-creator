import Fastify from 'fastify';
import { registerDecisionSessionRoutes } from './routes/decision-sessions';
import { registerProjectRoutes } from './routes/projects';
import { registerPromptRoutes } from './routes/prompts';
import { registerProviderCapacityRoutes } from './routes/provider-capacity';
import { registerPublishingRoutes } from './routes/publishing';
import { registerStoryProductionRoutes } from './routes/story-production';
import { registerWorkflowRunRoutes } from './routes/workflow-runs';

export function buildApp() {
  const app = Fastify();

  registerProjectRoutes(app);
  registerPromptRoutes(app);
  registerProviderCapacityRoutes(app);
  registerStoryProductionRoutes(app);
  registerDecisionSessionRoutes(app);
  registerPublishingRoutes(app);
  registerWorkflowRunRoutes(app);

  return app;
}
