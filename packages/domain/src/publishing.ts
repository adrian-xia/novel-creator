export type ExportFormat = 'plain_text' | 'markdown' | 'bundle';

export interface PublishProfile {
  projectId: string;
  publishEnabled: boolean;
  autoPublishTargets: string[];
  manualExportTargets: string[];
  defaultExportFormat: ExportFormat;
  effectiveFromChapter: number | null;
}

export interface PublishTask {
  id: string;
  projectId: string;
  chapterNumber: number;
  targetPlatform: string;
  mode: 'adapter_publish' | 'manual_export';
  status:
    | 'pending'
    | 'publishing'
    | 'published'
    | 'exporting'
    | 'exported'
    | 'manual_upload_pending'
    | 'manual_upload_confirmed'
    | 'failed';
  payloadSnapshot: Record<string, unknown>;
  artifactId: string | null;
  attemptCount: number;
  lastError: string | null;
}

export interface ExportArtifact {
  id: string;
  projectId: string;
  chapterNumber: number;
  targetPlatform: string;
  format: ExportFormat;
  content: string;
}
