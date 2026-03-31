import { buildApp } from './app';

const app = buildApp();
const port = Number(process.env.PORT ?? '3001');
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ host, port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
