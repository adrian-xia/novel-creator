import type { FastifyInstance } from 'fastify';
import {
  buildExportPreview,
  buildGeneratedExport
} from '../../../../packages/agent-runtime/src/export-execution';
import { parseExportBatchPayload } from './validation';

async function getExportExecutionRepository() {
  const { ExportExecutionRepository } = await import(
    '../../../../packages/storage/src/repositories/export-execution-repository'
  );
  return new ExportExecutionRepository();
}

export function registerExportExecutionRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/exportable-chapters', async (request) => {
    const { projectId } = request.params as { projectId: string };
    const repository = await getExportExecutionRepository();

    return {
      items: await repository.listExportableChapters(projectId)
    };
  });

  app.post('/projects/:projectId/exports/preview', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = parseExportBatchPayload(request.body);

    if ('error' in payload) {
      return reply.code(400).send({ message: payload.error });
    }

    const repository = await getExportExecutionRepository();
    const chapters = await repository.loadApprovedChaptersForExport({
      projectId,
      chapterNumbers: payload.chapterNumbers
    });

    return reply.code(200).send(
      buildExportPreview({
        request: {
          projectId,
          chapterNumbers: payload.chapterNumbers,
          format: payload.format
        },
        chapters,
        exportedAt: new Date().toISOString()
      })
    );
  });

  app.post('/projects/:projectId/exports', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = parseExportBatchPayload(request.body);

    if ('error' in payload) {
      return reply.code(400).send({ message: payload.error });
    }

    const repository = await getExportExecutionRepository();
    const chapters = await repository.loadApprovedChaptersForExport({
      projectId,
      chapterNumbers: payload.chapterNumbers
    });
    const generated = await buildGeneratedExport({
      request: {
        projectId,
        chapterNumbers: payload.chapterNumbers,
        format: payload.format
      },
      chapters,
      exportedAt: new Date().toISOString()
    });

    return reply
      .code(200)
      .header('content-type', generated.contentType)
      .header('content-disposition', `attachment; filename="${generated.fileName}"`)
      .send(generated.kind === 'text' ? generated.content : Buffer.from(generated.content));
  });
}
