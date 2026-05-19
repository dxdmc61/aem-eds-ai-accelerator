import express from 'express';
import { z } from 'zod';
import { runMigration, jobStore } from '../services/migrationOrchestrator.js';

// Define the input validation schema using Zod
const CreateMigrationSchema = z.object({
  url: z.string().url(),
  projectName: z.string().min(2).default('eds-migrated-site'),
  prompt: z.string().optional(),
  aemAuthorUrl: z.string().optional()
});

export function createMigrationRouter() {
  const router = express.Router();

  // POST /api/migrations - Starts a new migration job
  router.post('/', async (req, res, next) => {
    try {
      // Validate incoming request body
      const input = CreateMigrationSchema.parse(req.body);
      
      // runMigration now registers the job, kicks off the background process, 
      // and immediately returns an initial job receipt status
      const jobReceipt = await runMigration(input);
      
      // HTTP 201 Created status
      res.status(201).json(jobReceipt);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/migrations/:jobId - Fetches status, plan, and file tree for the UI
  router.get('/:jobId', (req, res) => {
    const job = jobStore.get(req.params.jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Migration job not found' });
    }
    
    return res.json(job);
  });

  return router;
}