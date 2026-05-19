import path from 'path';
import { nanoid } from 'nanoid';
import { crawlPage } from './siteCrawler.js';
import { analyzeDom } from './domAnalyzer.js';
import { createLlmProvider } from './llmProvider.js';
import { generateEdsProject } from './edsGenerator.js';
import { listFilesRecursive } from '../utils/fileTree.js';

// In-memory job state repository accessible by the router layer
export const jobStore = new Map();

/**
 * Creates and registers a migration job.
 * Immediately returns a processing status token to clear the Express routing lifecycle.
 * * @param {Object} input - Validated properties from the router layer
 * @returns {Promise<Object>} The initial execution status receipt object
 */
export async function runMigration(input) {
  const jobId = nanoid(10);
  const startedAt = new Date().toISOString();
  const outputDir = path.resolve(process.cwd(), '../../generated', jobId);

  // 1. Establish the base active runtime record tracking payload
  const initialJobContext = {
    jobId,
    status: 'processing',
    startedAt,
    completedAt: null,
    sourceUrl: input.url,
    projectName: input.projectName,
    outputDir,
    migrationPlan: null,
    files: [],
    error: null
  };

  // 2. Persist the job entry into memory tracking
  jobStore.set(jobId, initialJobContext);

  // 3. Defer the heavy execution pipeline to run asynchronously in the background
  processBackgroundMigration(jobId, input, outputDir).catch((err) => {
    console.error(`Fatal unexpected pipeline runtime error on Job ID: ${jobId}`, err);
  });

  // 4. Return an instantaneous receipt payload back to the web UI controller
  return {
    jobId,
    status: 'processing',
    sourceUrl: input.url,
    projectName: input.projectName
  };
}

/**
 * Handles the sequential compilation chain asynchronously.
 * Updates the global jobStore record lifecycle statuses automatically.
 */
async function processBackgroundMigration(jobId, input, outputDir) {
  const activeJobRecord = jobStore.get(jobId);
  if (!activeJobRecord) return;

  try {
    // A. Perform live page asset scraping
    const snapshot = await crawlPage(input.url);
    
    // B. Analyze semantic layout elements
    const domAnalysis = analyzeDom(snapshot);

    // C. Initialize LLM Provider Module Instance (Configured with Gemini 2.5 Flash)
    const llm = createLlmProvider();
    
    // D. Fetch structured block specifications from LLM
    const migrationPlan = await llm.createMigrationPlan({
      url: input.url,
      projectName: input.projectName,
      prompt: input.prompt,
      domAnalysis
    });

    // E. Map schema structures into localized code file outputs (Omitting paths.json)
    await generateEdsProject({
      outputDir,
      projectName: input.projectName,
      sourceUrl: input.url,
      aemAuthorUrl: input.aemAuthorUrl || 'https://author.example.adobeaemcloud.com',
      migrationPlan
    });

    // F. Map the recursive generated file configurations list
    const files = await listFilesRecursive(outputDir);

    // G. Transition job state context records to 'completed' status
    activeJobRecord.status = 'completed';
    activeJobRecord.completedAt = new Date().toISOString();
    activeJobRecord.migrationPlan = migrationPlan;
    activeJobRecord.files = files;

    jobStore.set(jobId, activeJobRecord);
    console.log(`[Migration Engine] Successfully compiled job ${jobId}`);

  } catch (error) {
    console.error(`[Migration Engine] Execution halted on Job ${jobId} due to:`, error);
    
    // Fallback error status state mitigation rules tracking handling
    activeJobRecord.status = 'failed';
    activeJobRecord.completedAt = new Date().toISOString();
    activeJobRecord.error = error.message || 'An unexpected operational failure occurred inside the background pipeline.';
    
    jobStore.set(jobId, activeJobRecord);
  }
}