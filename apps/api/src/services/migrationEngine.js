import fs from 'fs-extra';
import path from 'path';
import { GeminiMigrationService } from './geminiService.js';

export async function executeMigrationPipeline(jobId, targetUrl, rawHtmlContent) {
  const jobOutputDir = path.join(process.cwd(), 'generated', jobId);
  const gemini = new GeminiMigrationService();

  try {
    // 1. Process block mapping transformation definitions using Gemini
    const designSchema = await gemini.processLayoutMigration(rawHtmlContent);

    // 2. Scaffolding standard EDS layout directories
    await fs.ensureDir(path.join(jobOutputDir, 'blocks'));
    await fs.ensureDir(path.join(jobOutputDir, 'styles'));
    await fs.ensureDir(path.join(jobOutputDir, 'scripts'));

    // 3. Emit basic framework rules (Omitting paths.json to follow clean Universal Editor specs)
    await fs.writeFile(path.join(jobOutputDir, 'styles', 'styles.css'), '/* Base application structural configurations */\n');
    await fs.writeFile(path.join(jobOutputDir, 'scripts', 'scripts.js'), '/* Global decoration setup initialization routines */\n');
    
    const fstabConfiguration = `mountpoints:\n  - https://content.adobe.xwalk.com/v1/documents/geds/${jobId}/root\n`;
    await fs.writeFile(path.join(jobOutputDir, 'fstab.yaml'), fstabConfiguration);

    const activeBlocksList = [];

    // 4. Construct file fragments for each generated component block
    for (const block of designSchema.blocks) {
      const componentFolderPath = path.join(jobOutputDir, 'blocks', block.id);
      await fs.ensureDir(componentFolderPath);

      // Store specific code properties files
      await fs.writeFile(path.join(componentFolderPath, `${block.id}.js`), block.jsCode);
      await fs.writeFile(path.join(componentFolderPath, `${block.id}.css`), block.cssCode);
      await fs.writeJson(path.join(componentFolderPath, `_${block.id}.json`), block.localModel, { spaces: 2 });

      activeBlocksList.push(block.id);
    }

    // 5. Output unified global Universal Editor profile metadata configurations
    await fs.writeJson(path.join(jobOutputDir, 'component-definition.json'), {
      groups: [{ title: 'Migrated Components Library', id: 'migrated-components' }],
      components: designSchema.componentDefinitions
    }, { spaces: 2 });

    await fs.writeJson(path.join(jobOutputDir, 'component-models.json'), {
      models: designSchema.componentModels
    }, { spaces: 2 });

    await fs.writeJson(path.join(jobOutputDir, 'component-filters.json'), [
      { id: 'section', components: activeBlocksList }
    ], { spaces: 2 });

    return { jobId, targetUrl, location: jobOutputDir, totalBlocks: activeBlocksList.length };
  } catch (pipelineError) {
    console.error(`Pipeline failure executing Job ${jobId}:`, pipelineError);
    throw pipelineError;
  }
}