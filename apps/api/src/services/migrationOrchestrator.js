// services/migrationOrchestrator.js
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import { mergeBlocksToBoilerplate } from './edsGenerator.js';
import { provisionFranklinAemPage } from './aemAutomation.js';

// Initialize and explicitly export the shared global in-memory map to hold job states
export const jobStore = new Map();

/**
 * Main background orchestration sequence pipeline loop.
 * Clones the boilerplate repository, creates a feature branch, design-checks/merges block definitions,
 * pushes modifications to GitHub, and automatically registers content layout trees in AEM Author.
 * @param {string} jobId - Unique execution identifier string for monitoring progress
 * @param {Object} input - Execution context parameters
 * @param {string} input.projectName - Tenant configuration namespace mapping (e.g. "suncrop")
 * @param {string|Object} input.targetUrl - Scraped webpage destination URL string or object wrapper
 * @param {string} input.aemAuthorUrl - URL of your target cloud author environment
 * // 1. UPDATED: Replaced input.aemOauthToken parameter references with Basic Auth credentials
 * @param {string} input.aemUser - Author local service username profile
 * @param {string} input.aemPassword - Author local service password profile
 * @param {string} input.githubOwner - Profile org context parameter containing target repository
 * @param {string} input.githubRepo - Target codebase repo matching boilerplate specification
 * @param {string} input.githubToken - Installation Access Token or Personal Developer Access Key
 * @param {Object} input.migrationPlan - Scraped blocks list model definition payload arrays 
 */
export async function executeAutomatedMigrationTask(jobId, input) {
  // Establish an operational workflow baseline in the shared tracking log
  jobStore.set(jobId, {
    status: 'PROCESSING',
    progress: 10,
    message: 'Initializing local scratch workspace environment directories...',
    error: null,
    timestamp: new Date().toISOString()
  });

  const workspacePath = path.join('/tmp', 'aem-migration-jobs', jobId);

  try {
    // Clean directory out if remnants of an earlier broken session path exist
    await fs.remove(workspacePath).catch(() => {});
    await fs.ensureDir(workspacePath);

    // Authenticate and Clone the existing boilerplate repository
    jobStore.set(jobId, {
      status: 'PROCESSING',
      progress: 30,
      message: 'Authenticating secure connection and cloning baseline boilerplate repository from GitHub...',
      error: null,
      timestamp: new Date().toISOString()
    });

    const owner = input.githubOwner;
    const repo = input.githubRepo;
    const gitUrl = `https://x-access-token:${input.githubToken}@github.com/${owner}/${repo}.git`;
    
    const git = simpleGit();
    console.log(`[Orchestrator] Cloning target repository: ${owner}/${repo}`);
    await git.clone(gitUrl, workspacePath);
    
    const localGit = simpleGit(workspacePath);

    // Configure developer git signature profile parameters for the isolation instance execution context
    await localGit.addConfig('user.name', 'AEM EDS AI Accelerator');
    await localGit.addConfig('user.email', 'accelerator-bot@wipro.com');

    // Establish a unique code isolation branch
    const newFeatureBranch = `migration-feature/job-${jobId}`;
    await localGit.checkoutLocalBranch(newFeatureBranch);
    console.log(`[Orchestrator] Switched codebase operational view index to branch: ${newFeatureBranch}`);

    // Run the Deduplication, Selection, and AI Synthesis Merge Layer
    jobStore.set(jobId, {
      status: 'PROCESSING',
      progress: 55,
      message: 'Comparing asset inventories, skipping existing blocks, and generating missing UI fragments...',
      error: null,
      timestamp: new Date().toISOString()
    });

    await mergeBlocksToBoilerplate({
      repoLocalPath: workspacePath,
      projectName: input.projectName,
      migrationPlan: input.migrationPlan
    });

    // Package changes and commit them cleanly back to origin
    jobStore.set(jobId, {
      status: 'PROCESSING',
      progress: 75,
      message: 'Assembling formatted changes and pushing feature branch updates up to GitHub...',
      error: null,
      timestamp: new Date().toISOString()
    });

    await localGit.add('./*');
    
    // Check if files actually changed before attempting a commit payload operation
    const statusSummary = await localGit.status();
    if (statusSummary.staged.length > 0) {
      await localGit.commit(`feat(migration): integrated dynamically engineered block extensions for job ${jobId}`);
      await localGit.push('origin', newFeatureBranch);
      console.log(`[Orchestrator] Feature code successfully pushed to remote repository.`);
    } else {
      console.log(`[Orchestrator] No unique UI block adjustments needed. Clean tree baseline inherited.`);
    }

    // Execute Content Node Hydration via Franklin / Crosswalk Sling REST API
    jobStore.set(jobId, {
      status: 'PROCESSING',
      progress: 90,
      message: 'Compiling structured JCR nodes and injecting Franklin data cells into AEM Author...',
      error: null,
      timestamp: new Date().toISOString()
    });

    // --- HARDENED DEFENSIVE STRING CHECK FOR targetUrl ---
    let rawUrl = '';
    if (typeof input.targetUrl === 'string') {
      rawUrl = input.targetUrl;
    } else if (input.targetUrl && typeof input.targetUrl === 'object') {
      // Extract common fields if it's a URL instance or a custom data structure wrapper object
      rawUrl = input.targetUrl.url || input.targetUrl.href || String(input.targetUrl);
    }

    // Fail early with explicit diagnostics if the fallback string casting evaluates poorly
    if (!rawUrl || rawUrl === '[object Object]' || rawUrl.includes('object Object')) {
      throw new TypeError(`The "targetUrl" parameter could not be evaluated to a valid URL string. Received: ${JSON.stringify(input.targetUrl)}`);
    }

    const pageUrlObj = new URL(rawUrl);
    const pageSlug = pageUrlObj.pathname.split('/').filter(Boolean).pop() || 'index';

    // 2. UPDATED: Passing down credentials directly into the provision utility file configuration payload block mapping
    const automationResult = await provisionFranklinAemPage({
      aemAuthorUrl: input.aemAuthorUrl,
      projectName: input.projectName,
      pageSlug: pageSlug,
      pageTitle: `${input.projectName} - Autogenerated ${pageSlug}`,
      migrationPlan: input.migrationPlan,
      // Pass basic authentication fields forward
      aemUser: input.aemUser,
      aemPassword: input.aemPassword
    });

    // Mark operations as finalized and update execution indicators
    const finalResultPayload = {
      status: 'COMPLETED',
      progress: 100,
      message: 'Migration process executed successfully!',
      error: null,
      timestamp: new Date().toISOString(),
      result: {
        githubBranch: newFeatureBranch,
        githubPullRequestUrl: `https://github.com/${owner}/${repo}/pull/new/${newFeatureBranch}`,
        aemPagePath: automationResult.path
      }
    };

    jobStore.set(jobId, finalResultPayload);
    console.log(`[Orchestrator] Full migration pipeline execution loop complete for Job ID: ${jobId}`);
    return finalResultPayload;

  } catch (error) {
    console.error(`[Orchestrator] Critical Exception caught during background automation:`, error.message);
    
    const errorPayload = {
      status: 'FAILED',
      progress: 100,
      message: `Pipeline execution halted early due to an internal error.`,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    jobStore.set(jobId, errorPayload);
    throw error;
  } finally {
    // Securely flush directory context out of active system disk blocks to reclaim memory space
    console.log(`[Orchestrator] Cleaning sandbox working execution folder for job ${jobId}`);
    await fs.remove(workspacePath).catch(() => {});
  }
}

/**
 * Legacy wrapper function pointer to ensure drop-in routing backwards-compatibility
 * if migrations.js targets runMigration explicitly.
 */
export async function runMigration(jobId, input) {
  // Automatically offload execution task onto the asynchronous background thread processor loop
  executeAutomatedMigrationTask(jobId, input).catch(err => {
    console.error(`[Orchestrator Tracking Wrapper] Managed async sub-process exception:`, err.message);
  });
  
  // Return early to the Express HTTP routing engine client thread tracking state immediately
  return { status: 'PENDING', jobId };
}