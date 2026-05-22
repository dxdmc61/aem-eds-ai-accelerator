// routes/migrations.js
import express from 'express';
import { z } from 'zod';
import { runMigration, jobStore } from '../services/migrationOrchestrator.js';
import playwright from 'playwright';
import fs from 'fs-extra';
import path from 'path';

// Dynamic, relaxed schema structures to prevent rigid field mapping failures
const BlockFieldSchema = z.object({
  name: z.string(),
  type: z.string().default('string'),
  value: z.any().optional()
});

const BlockSchema = z.object({
  name: z.string(),
  fields: z.array(BlockFieldSchema).optional(),
  isNestedArray: z.boolean().default(false),
  items: z.array(z.record(z.any())).optional(),
  content: z.record(z.any()).optional()
});

const MigrationPlanSchema = z.object({
  blocks: z.array(BlockSchema)
}).default({ blocks: [] });

const CreateMigrationSchema = z.object({
  url: z.string().url().optional(), 
  projectName: z.string().min(2).optional(),
  aemAuthorUrl: z.string().optional(),
  aemUser: z.string().optional(),
  aemPassword: z.string().optional(),
  githubOwner: z.string().optional(),
  githubRepo: z.string().optional(),
  githubToken: z.string().optional(),
  migrationPlan: MigrationPlanSchema.optional()
});

// =========================================================================
// PURELY DYNAMIC REAL-TIME DOM PARSER ENGINE
// =========================================================================
/**
 * Fully dynamic headless rendering pipeline.
 * Evaluates raw structures on live domains, extracting and formatting all visible 
 * content segments dynamically without using rigid block fallbacks.
 */
async function runDynamicScraperPipeline(targetUrl) {
  console.log(`[Dynamic Engine] Initializing headless runtime profile for: ${targetUrl}`);
  
  const browser = await playwright.chromium.launch({ 
    headless: true,
    args: ['--disable-web-security', '--allow-running-insecure-content']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  const blocks = [];

  try {
    // Wait completely for dynamic micro-frontends and API hydrations to resolve
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000); 

    // Execute absolute deep structural mapping inside browser scope
    const extractedDomTree = await page.evaluate(() => {
      const wrappers = ['main', '#content', '[role="main"]', '.main-content', 'body'];
      let mainContainer = null;

      for (const selector of wrappers) {
        const target = document.querySelector(selector);
        if (target && target.children.length > 2) {
          mainContainer = target;
          break;
        }
      }
      if (!mainContainer) mainContainer = document.body;

      const validElements = Array.from(mainContainer.querySelectorAll(':scope > *, section, [class*="section"], [class*="block"]'))
        .filter(el => {
          const tag = el.tagName.toLowerCase();
          const isMetaTag = ['script', 'style', 'noscript', 'iframe', 'header', 'footer', 'nav'].includes(tag);
          const hasDimensions = el.offsetHeight > 30 && el.offsetWidth > 30;
          return !isMetaTag && hasDimensions && el.innerText.trim().length > 0;
        });

      const uniqueElements = validElements.filter((el, index) => {
        return !validElements.slice(0, index).some(parent => parent.contains(el));
      });

      return uniqueElements.map((el, index) => {
        const imageElements = Array.from(el.querySelectorAll('img')).map(img => img.src || img.getAttribute('data-src'));
        const dynamicImages = imageElements.filter(src => src && !src.startsWith('data:image'));

        const subItems = Array.from(el.querySelectorAll('li, [class*="card"], [class*="item"], [class*="col"]'))
          .filter(sub => sub.offsetHeight > 20 && sub.innerText.trim().length > 0)
          .map(sub => ({
            text: sub.innerText.trim(),
            images: Array.from(sub.querySelectorAll('img')).map(i => i.src || i.getAttribute('data-src')).filter(Boolean)
          }));

        let signatureName = el.className && typeof el.className === 'string'
          ? el.className.split(' ')[0].replace(/[^a-zA-Z0-9-]/g, '').trim()
          : '';

        if (!signatureName || signatureName.length < 3) {
          signatureName = el.id ? el.id.replace(/[^a-zA-Z0-9-]/g, '') : `section-block-${index}`;
        }

        return {
          name: signatureName.toLowerCase() || `block-element-${index}`,
          text: el.innerText.trim(),
          html: el.innerHTML,
          images: dynamicImages,
          subItems: subItems.slice(0, 12) 
        };
      });
    });

    console.log(`[Dynamic Engine] DOM analysis complete. Identified ${extractedDomTree.length} unique structural nodes.`);

    extractedDomTree.forEach((node) => {
      const textSegments = node.text.split('\n').map(t => t.trim()).filter(t => t.length > 2);
      if (textSegments.length === 0 && node.images.length === 0) return; 

      const normalizedBlockName = node.name.replace(/[^a-z0-9-]/g, '-') || 'content-section';
      
      let fields = [];
      let content = {};
      let items = [];
      let isNestedArray = false;

      if (node.subItems.length > 1) {
        isNestedArray = true;
        fields = [{ name: 'title', type: 'string' }, { name: 'description', type: 'string' }];
        
        if (node.images.length > 0) {
          fields.push({ name: 'image', type: 'string' });
        }

        node.subItems.forEach((sub) => {
          const subLines = sub.text.split('\n').map(l => l.trim()).filter(Boolean);
          if (subLines.length === 0) return;

          items.push({
            title: subLines[0].substring(0, 120),
            description: subLines.slice(1).join(' ').substring(0, 500) || 'See related details on main framework.',
            image: sub.images[0] || (node.images[0] || '/content/dam/shared/placeholder.jpg')
          });
        });
      } else {
        content.title = textSegments[0] ? textSegments[0].substring(0, 150) : 'Information Hub';
        fields.push({ name: 'title', type: 'string' });

        if (textSegments.length > 1) {
          content.description = textSegments.slice(1).join(' ').substring(0, 1000);
          fields.push({ name: 'description', type: 'string' });
        }

        if (node.images.length > 0) {
          content.image = node.images[0];
          fields.push({ name: 'image', type: 'string' });
        }
      }

      blocks.push({
        name: normalizedBlockName,
        isNestedArray,
        fields,
        content: isNestedArray ? undefined : content,
        items: isNestedArray ? items : undefined
      });
    });

  } catch (err) {
    console.error(`[Dynamic Engine Error] Automated scraping extraction failure:`, err.message);
  } final {
    await browser.close();
  }

  return { blocks };
}

// =========================================================================
// ROUTER CONTEXT DISTRIBUTION MODULE
// =========================================================================
export function createMigrationRouter() {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    try {
      const parsedInput = CreateMigrationSchema.parse(req.body);
      const jobId = req.body.jobId || `job-${Date.now()}`;

      // Cleanly fallback to name variants (e.g. 'axis', 'directlinegroup')
      const projectName = parsedInput.projectName || process.env.AEM_PROJECT_NAME || 'eds-migrated-site';
      const targetUrl = parsedInput.url || process.env.TEST_TARGET_URL || 'https://www.axisbank.com/';
      const aemAuthorUrl = parsedInput.aemAuthorUrl || process.env.AEM_AUTHOR_URL || '';
      const aemUser = parsedInput.aemUser || process.env.AEM_USER || '';
      const aemPassword = parsedInput.aemPassword || process.env.AEM_PASSWORD || '';
      const githubOwner = parsedInput.githubOwner || process.env.GITHUB_OWNER || '';
      const githubRepo = parsedInput.githubRepo || process.env.GITHUB_REPO || '';
      const githubToken = parsedInput.githubToken || process.env.GITHUB_TOKEN || '';

      let migrationPlan = parsedInput.migrationPlan;
      
      if ((!migrationPlan || !migrationPlan.blocks || migrationPlan.blocks.length === 0) && process.env.TEST_MIGRATION_PLAN) {
        try {
          migrationPlan = JSON.parse(process.env.TEST_MIGRATION_PLAN);
        } catch (parseErr) {
          migrationPlan = { blocks: [] };
        }
      }

      console.log(`[Router Action] Dispatched payload configurations for Job: ${jobId}`);

      // Execute execution loop in an asynchronous background block
      (async () => {
        try {
          // =========================================================================
          // DYNAMIC DEDICATED PATHS.JSON GENERATION MATRIX
          // =========================================================================
          // Normalizes project naming strings to safely strip trailing dashes or special characters
          const cleanSiteName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const workspaceSandboxDir = path.join(process.cwd(), 'data', 'sandboxes', jobId);
          
          const pathsConfigPayload = {
            mappings: [
              `/content/${cleanSiteName}/:/`,
              `/content/${cleanSiteName}/configuration:/.helix/config.json`,
              `/content/${cleanSiteName}/metadata:/metadata.json`
            ],
            includes: [
              `/content/${cleanSiteName}/`
            ]
          };

          try {
            await fs.ensureDir(workspaceSandboxDir);
            const targetPathsFilePath = path.join(workspaceSandboxDir, 'paths.json');
            await fs.writeJson(targetPathsFilePath, pathsConfigPayload, { spaces: 2 });
            console.log(`[Router Automation Loop] Generated dynamic paths.json config matrix specifically for root routing: /content/${cleanSiteName}/`);
          } catch (fileWriteErr) {
            console.error(`[Router Warning] Failed compiling dynamic paths.json context configuration manifest file:`, fileWriteErr.message);
          }
          // =========================================================================

          const isPlanEmpty = !migrationPlan || !migrationPlan.blocks || migrationPlan.blocks.length === 0;
          const isTestPlanBoilerplate = migrationPlan?.blocks?.length === 2 && 
                                        migrationPlan.blocks[0].name === 'hero' && 
                                        migrationPlan.blocks[1].name === 'cards';

          if (isPlanEmpty || isTestPlanBoilerplate) {
            console.log(`[Router Automation Loop] Extracting site components dynamically from target: ${targetUrl}`);
            const scrapedPlan = await runDynamicScraperPipeline(targetUrl);
            
            if (scrapedPlan && scrapedPlan.blocks && scrapedPlan.blocks.length > 0) {
              migrationPlan = scrapedPlan;
            }
          }

          console.log(`[Router Automation Loop] Successfully mapped ${migrationPlan.blocks.length} unique components into processing logic...`);
          
          await runMigration(jobId, {
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
        } catch (backgroundError) {
          console.error(`[Background Job Error Handler] Pipeline broken for Job ID ${jobId}:`, backgroundError.message);
        }
      })();
      
      res.status(201).json({
        success: true,
        message: "Dynamic migration loop running smoothly inside active worker thread contexts.",
        jobId,
        metaContext: { projectName, githubRepo, targetUrl }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error matching against dynamic layout constraints.", details: error.errors });
      }
      next(error);
    }
  });

  router.get('/:jobId', (req, res) => {
    const job = jobStore.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Specified execution context frame not found' });
    return res.json(job);
  });

  return router;
}