import { beforeEach, describe, expect, it, vi } from 'vitest';

const createProjectRecordMock = vi.fn();
const getProjectDecisionAndPublishingDetailMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/project-repository', () => ({
  ProjectRepository: class {
    create = createProjectRecordMock;
    getProjectDecisionAndPublishingDetail = getProjectDecisionAndPublishingDetailMock;
  }
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('projects route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('creates a project', async () => {
    createProjectRecordMock.mockResolvedValue({
      id: 'project-persisted',
      title: '寒江伏魔录',
      genre: '仙侠',
      premise: '小城捕快卷入仙门秘案',
      targetChapterCount: 180,
      chaptersPerDay: 2,
      status: 'draft'
    });

    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: '寒江伏魔录',
        genre: '仙侠',
        premise: '小城捕快卷入仙门秘案',
        targetChapterCount: 180,
        chaptersPerDay: 2
      }
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body).toEqual({
      id: 'project-persisted',
      title: '寒江伏魔录',
      genre: '仙侠',
      premise: '小城捕快卷入仙门秘案',
      targetChapterCount: 180,
      chaptersPerDay: 2,
      status: 'draft'
    });
    expect(createProjectRecordMock).toHaveBeenCalledTimes(1);
    expect(createProjectRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '寒江伏魔录',
        genre: '仙侠',
        premise: '小城捕快卷入仙门秘案',
        targetChapterCount: 180,
        chaptersPerDay: 2,
        status: 'draft',
        id: expect.any(String)
      })
    );
  });

  it('returns story production detail for a project', async () => {
    getProjectDecisionAndPublishingDetailMock.mockResolvedValue({
      id: 'project-1',
      storyState: {
        outline: { title: '总纲' },
        volumePlans: [{ volumeNumber: 1, title: '第一卷' }]
      },
      chapterStateRecords: [
        {
          projectId: 'project-1',
          chapterNumber: 8,
          status: 'approved'
        }
      ],
      reviewOutcomeRecords: [
        {
          chapterNumber: 8,
          payload: {
            decision: 'approve',
            issues: []
          }
        }
      ],
      agentRunRecords: [
        {
          projectId: 'project-1',
          chapterNumber: 8,
          agentType: 'chapter-writer',
          status: 'succeeded',
          createdAt: new Date('2026-04-03T00:00:00.000Z')
        }
      ],
      publishProfile: {
        publishEnabled: true,
        autoPublishTargets: ['alpha'],
        manualExportTargets: ['beta'],
        defaultExportFormat: 'bundle',
        effectiveFromChapter: 3
      }
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/projects/project-1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projectId: 'project-1',
      outline: { title: '总纲' },
      volumePlans: [{ volumeNumber: 1, title: '第一卷' }],
      chapters: [
        {
          chapterNumber: 8,
          status: 'approved',
          latestReviewDecision: 'approve'
        }
      ],
      recentAgentRuns: [
        {
          projectId: 'project-1',
          chapterNumber: 8,
          agentType: 'chapter-writer',
          status: 'succeeded',
          createdAt: '2026-04-03T00:00:00.000Z'
        }
      ],
      publishProfile: {
        publishEnabled: true,
        autoPublishTargets: ['alpha'],
        manualExportTargets: ['beta'],
        defaultExportFormat: 'bundle',
        effectiveFromChapter: 3
      }
    });
    expect(getProjectDecisionAndPublishingDetailMock).toHaveBeenCalledWith('project-1');

    await app.close();
  });
});
