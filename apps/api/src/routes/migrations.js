// routes/migrations.js
import express from 'express';
import { z } from 'zod';
import { runMigration, jobStore } from '../services/migrationOrchestrator.js';

// Define a structural schema for individual component block models
const BlockFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  value: z.any().optional()
});

const BlockSchema = z.object({
  name: z.string(),
  fields: z.array(BlockFieldSchema)
});

const MigrationPlanSchema = z.object({
  blocks: z.array(BlockSchema)
}).default({ blocks: [] });

// Complete Edge Delivery Services input validation validation layout schema
const CreateMigrationSchema = z.object({
  url: z.string().url().optional(), // targetUrl fallback mapping
  projectName: z.string().min(2).optional(),
  aemAuthorUrl: z.string().optional(),
  // 1. UPDATED: Replaced aemOauthToken schema validation rule with Basic Auth user profiles
  aemUser: z.string().optional(),
  aemPassword: z.string().optional(),
  githubOwner: z.string().optional(),
  githubRepo: z.string().optional(),
  githubToken: z.string().optional(),
  migrationPlan: MigrationPlanSchema.optional()
});

export function createMigrationRouter() {
  const router = express.Router();

  // POST /api/migrations - Starts a new migration job
  router.post('/', async (req, res, next) => {
    try {
      // Sanitize incoming payload body properties against Zod specifications
      const parsedInput = CreateMigrationSchema.parse(req.body);

      // Provision an explicit tracking identifier
      const jobId = req.body.jobId || `job-${Date.now()}`;

      // 2. UPDATED: Extract and apply basic auth operational fallbacks natively from your active .env file
      const projectName = parsedInput.projectName || process.env.AEM_PROJECT_NAME || 'eds-migrated-site';
      const targetUrl = parsedInput.url || process.env.TEST_TARGET_URL || 'https://main--directlinegroup--dxdmc61.aem.live/';
      const aemAuthorUrl = parsedInput.aemAuthorUrl || process.env.AEM_AUTHOR_URL || '';
      const aemUser = parsedInput.aemUser || process.env.AEM_USER || '';
      const aemPassword = parsedInput.aemPassword || process.env.AEM_PASSWORD || '';
      const githubOwner = parsedInput.githubOwner || process.env.GITHUB_OWNER || '';
      const githubRepo = parsedInput.githubRepo || process.env.GITHUB_REPO || '';
      const githubToken = parsedInput.githubToken || process.env.GITHUB_TOKEN || '';

      // Safely evaluate and unpack the stringified or structural JSON migrationPlan layout tree
      let migrationPlan = parsedInput.migrationPlan;
      
      if ((!migrationPlan || !migrationPlan.blocks || migrationPlan.blocks.length === 0) && process.env.TEST_MIGRATION_PLAN) {
        try {
          migrationPlan = JSON.parse(process.env.TEST_MIGRATION_PLAN);
        } catch (parseErr) {
          console.warn("[Router Warning] Failed to parse TEST_MIGRATION_PLAN fallback string from .env context configurations:", parseErr.message);
          migrationPlan = { blocks: [] };
        }
      }

      console.log(`[Router Action] Dispatched unified configuration payload to background thread orchestrator pipeline for Job: ${jobId}`);

      // 3. UPDATED: Pass basic auth credentials down to the orchestrator background worker thread engine loop
      const jobReceipt = await runMigration(jobId, {
        projectName,
        targetUrl,
        aemAuthorUrl,
        aemUser,
        aemPassword,
        githubOwner,
        githubRepo,
        githubToken,
        migrationPlan
      });
      
      // Return HTTP 201 Created status receipt to client early, processing tasks in background threads
      res.status(201).json({
        ...jobReceipt,
        jobId,
        metaContext: {
          projectName,
          githubRepo,
          targetUrl
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Payload verification exception matched against active constraints.", details: error.errors });
      }
      next(error);
    }
  });

  // GET /api/migrations/:jobId - Fetches status, plan, and file tree progress traces for the active dashboard UI view
  router.get('/:jobId', (req, res) => {
    const job = jobStore.get(req.params.jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Specified migration job execution tracking frame context not found' });
    }
    
    return res.json(job);
  });

  return router;
}