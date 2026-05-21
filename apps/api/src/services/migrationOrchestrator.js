import path from 'path';
import { nanoid } from 'nanoid';
import * as cheerio from 'cheerio';
import { crawlPage } from './siteCrawler.js'; // Upgraded Playwright scraper
import { createLlmProvider } from './llmProvider.js'; // Updated Gemini Provider
import { generateEdsProject } from './edsGenerator.js';
import { listFilesRecursive } from '../utils/fileTree.js';

// In-memory job state repository to track real-time processing updates
export const jobStore = new Map();

/**
 * Initiates the structural parsing migration sequence.
 * Registers the job layout tracking payload and instantly returns 
 * a receipt back to the router layer to prevent network timeouts.
 * * @param {Object} input - Validated properties provided by the Zod Schema definitions.
 * @returns {Promise<Object>} Immediate job receipt token context.
 */
export async function runMigration(input) {
  const jobId = nanoid(10);
  const startedAt = new Date().toISOString();
  const outputDir = path.resolve(process.cwd(), '../../generated', jobId);

  // 1. Establish the base active runtime tracking payload
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

  // 2. Persist the job entry into memory tracking state
  jobStore.set(jobId, initialJobContext);

  // 3. Spawn the heavy asynchronous backend processing loop
  processBackgroundMigration(jobId, input, outputDir).catch((err) => {
    console.error(`[Orchestrator] Unhandled system pipeline failure on Job ID: ${jobId}`, err);
  });

  // 4. Return an instantaneous receipt payload back to the web UI client
  return {
    jobId,
    status: 'processing',
    sourceUrl: input.url,
    projectName: input.projectName
  };
}

/**
 * Coordinates headless crawling, layout element cleaning, 
 * Gemini prompt parsing, and local file generation in the background.
 */
async function processBackgroundMigration(jobId, input, outputDir) {
  const activeJobRecord = jobStore.get(jobId);
  if (!activeJobRecord) return;

  try {
    // Step A: Perform full headless browser crawl via Playwright (Handles dynamic CSR / SPAs)
    const rawHtmlPayload = await crawlPage(input.url);
    
    console.log(`[Orchestrator] Cleaning up extracted DOM structure for Job: ${jobId}`);

    // Step B: Sanitize the HTML payload using Cheerio to strip firewall/analytics bloat
    const $ = cheerio.load(rawHtmlPayload);
    
    // Remove heavy interactive scripts, iframe sandboxes, and structural noise 
    // that clutter context tokens or confuse structural analysis
    $('script, style, iframe, noscript, svg, link, meta, head, header, footer').remove();
    
    // Extract a cleaner visual body DOM string
    const sanitizedHtmlContent = $('body').html() || '';

    // Step C: Build a mock representation format matching the expected pipeline interface
    const optimizedDomAnalysis = {
      rawHtml: sanitizedHtmlContent.trim(),
      extractedAt: new Date().toISOString(),
      sectionsCountEstimate: $('div, section').length
    };

    // Step D: Initialize the dynamic LLM instance module (Gemini)
    const llm = createLlmProvider();
    
    console.log(`[Orchestrator] Invoking Gemini engine to build AEM EDS blocks roadmap...`);

    // Step E: Fetch the structured project plan directly from Gemini
    const migrationPlan = await llm.createMigrationPlan({
      url: input.url,
      projectName: input.projectName,
      prompt: input.prompt,
      domAnalysis: optimizedDomAnalysis
    });

    console.log(`[Orchestrator] Compiling migration plan into file tree layout under: ${outputDir}`);

    // Step F: Map schema structures into localized files (Omits paths.json for Universal Editor)
    await generateEdsProject({
      outputDir,
      projectName: input.projectName,
      sourceUrl: input.url,
      aemAuthorUrl: input.aemAuthorUrl || 'https://author.example.adobeaemcloud.com',
      migrationPlan
    });

    // Step G: Map the recursive generated file configurations list for UI explorer tree layout
    const files = await listFilesRecursive(outputDir);

    // Step H: Finalize state records tracking parameters on successful completion
    activeJobRecord.status = 'completed';
    activeJobRecord.completedAt = new Date().toISOString();
    activeJobRecord.migrationPlan = migrationPlan;
    activeJobRecord.files = files;

    jobStore.set(jobId, activeJobRecord);
    console.log(`[Orchestrator] Successfully completed full migration stack for Job ID: ${jobId}`);

  } catch (error) {
    console.error(`[Orchestrator] Pipeline execution broken on Job ID ${jobId}:`, error);
    
    // Handle status rollback settings to inform the frontend of tracking faults
    activeJobRecord.status = 'failed';
    activeJobRecord.completedAt = new Date().toISOString();
    activeJobRecord.error = error.message || 'An unexpected runtime error derailed the backend process.';
    
    jobStore.set(jobId, activeJobRecord);
  }
}