import path from 'path';
import { nanoid } from 'nanoid';
import { crawlPage } from './siteCrawler.js';
import { analyzeDom } from './domAnalyzer.js';
import { createLlmProvider } from './llmProvider.js';
import { generateEdsProject } from './edsGenerator.js';
import { listFilesRecursive } from '../utils/fileTree.js';

export async function runMigration(input) {
  const jobId = nanoid(10);
  const startedAt = new Date().toISOString();
  const outputDir = path.resolve(process.cwd(), '../../generated', jobId);

  const snapshot = await crawlPage(input.url);
  const domAnalysis = analyzeDom(snapshot);

  const llm = createLlmProvider();
  const migrationPlan = await llm.createMigrationPlan({
    url: input.url,
    projectName: input.projectName,
    prompt: input.prompt,
    domAnalysis
  });

  await generateEdsProject({
    outputDir,
    projectName: input.projectName,
    sourceUrl: input.url,
    aemAuthorUrl: input.aemAuthorUrl || 'https://author.example.adobeaemcloud.com',
    migrationPlan
  });

  const files = await listFilesRecursive(outputDir);

  return {
    jobId,
    status: 'completed',
    startedAt,
    completedAt: new Date().toISOString(),
    sourceUrl: input.url,
    outputDir,
    migrationPlan,
    files
  };
}
