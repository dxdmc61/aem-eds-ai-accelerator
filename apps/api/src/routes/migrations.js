import express from 'express';
import { z } from 'zod';
import { runMigration } from '../services/migrationOrchestrator.js';

const jobs = new Map();

const CreateMigrationSchema = z.object({
  url: z.string().url(),
  projectName: z.string().min(2).default('eds-migrated-site'),
  prompt: z.string().optional(),
  aemAuthorUrl: z.string().optional()
});

export function createMigrationRouter() {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    try {
      const input = CreateMigrationSchema.parse(req.body);
      const job = await runMigration(input);
      jobs.set(job.jobId, job);
      res.status(201).json(job);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Migration job not found' });
    }
    return res.json(job);
  });

  return router;
}
