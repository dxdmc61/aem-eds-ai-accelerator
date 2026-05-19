import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createMigrationRouter } from './routes/migrations.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aem-eds-ai-accelerator-api' });
});

app.use('/api/migrations', createMigrationRouter());

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Unexpected server error'
  });
});

app.listen(port, () => {
  console.log(`AEM EDS AI Accelerator API running at http://localhost:${port}`);
});
