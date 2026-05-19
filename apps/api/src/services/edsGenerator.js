import path from 'path';
import fs from 'fs-extra';
import { toKebabCase } from '../utils/strings.js';

export async function generateEdsProject({ outputDir, projectName, sourceUrl, aemAuthorUrl, migrationPlan }) {
  await fs.ensureDir(outputDir);
  await fs.ensureDir(path.join(outputDir, 'blocks'));
  await fs.ensureDir(path.join(outputDir, 'scripts'));
  await fs.ensureDir(path.join(outputDir, 'styles'));

  const safeProject = toKebabCase(projectName);

  await fs.writeJson(path.join(outputDir, 'package.json'), {
    name: safeProject,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      lint: 'echo "Add eslint/stylelint validation here"',
      start: 'echo "Use AEM CLI: aem up"'
    }
  }, { spaces: 2 });

  await fs.writeFile(path.join(outputDir, 'fstab.yaml'), `mountpoints:\n  /: ${aemAuthorUrl}/content/${safeProject}\n`);
  await fs.writeJson(path.join(outputDir, 'paths.json'), { mappings: [] }, { spaces: 2 });

  await fs.writeFile(path.join(outputDir, 'head.html'), `<!-- Generated from ${sourceUrl} -->\n<script src="https://universal-editor-service.adobe.io/cors.js" async></script>\n<meta name="urn:adobe:aue:system:aemconnection" content="aem:${aemAuthorUrl}">\n`);

  await fs.writeFile(path.join(outputDir, 'scripts', 'scripts.js'), `import { decorateBlocks } from './aem.js';\n\nexport function decorateMain(main) {\n  decorateBlocks(main);\n}\n`);
  await fs.writeFile(path.join(outputDir, 'scripts', 'aem.js'), `export function decorateBlocks(main) {\n  main.querySelectorAll('div[class]').forEach((block) => {\n    block.dataset.blockDecorated = 'true';\n  });\n}\n`);
  await fs.writeFile(path.join(outputDir, 'styles', 'styles.css'), `:root {\n  --brand-color: #2563eb;\n  --text-color: #111827;\n}\nbody {\n  margin: 0;\n  font-family: Arial, sans-serif;\n  color: var(--text-color);\n}\nmain {\n  max-width: 1200px;\n  margin: 0 auto;\n}\n`);

  const componentDefinition = [];
  const componentModels = [];
  const componentFilters = [];

  for (const block of migrationPlan.blocks) {
    const blockName = toKebabCase(block.name);
    const blockDir = path.join(outputDir, 'blocks', blockName);
    await fs.ensureDir(blockDir);

    await fs.writeFile(path.join(blockDir, `${blockName}.css`), createBlockCss(blockName));
    await fs.writeFile(path.join(blockDir, `${blockName}.js`), createBlockJs(blockName));
    await fs.writeJson(path.join(blockDir, `_${blockName}.json`), createBlockModel(blockName, block), { spaces: 2 });

    componentDefinition.push({
      title: titleCase(blockName),
      id: blockName,
      plugins: {
        xwalk: {
          page: {
            resourceType: `${safeProject}/components/${blockName}`,
            template: {
              name: blockName,
              model: blockName
            }
          }
        }
      }
    });

    componentModels.push({
      id: blockName,
      fields: block.fields
    });

    componentFilters.push({
      id: blockName,
      components: [blockName]
    });
  }

  await fs.writeJson(path.join(outputDir, 'component-definition.json'), { groups: [{ title: 'Generated Components', components: componentDefinition }] }, { spaces: 2 });
  await fs.writeJson(path.join(outputDir, 'component-models.json'), { models: componentModels }, { spaces: 2 });
  await fs.writeJson(path.join(outputDir, 'component-filters.json'), { filters: componentFilters }, { spaces: 2 });

  await fs.writeFile(path.join(outputDir, 'index.html'), createDemoHtml({ safeProject, migrationPlan }));
}

function createBlockCss(blockName) {
  return `.${blockName} {\n  padding: 48px 24px;\n}\n.${blockName} h2, .${blockName} h1 {\n  margin-top: 0;\n}\n.${blockName} a {\n  color: var(--brand-color);\n}\n`;
}

function createBlockJs(blockName) {
  return `export default function decorate(block) {\n  block.classList.add('${blockName}--decorated');\n}\n`;
}

function createBlockModel(blockName, block) {
  return {
    definitions: [
      {
        title: titleCase(blockName),
        id: blockName,
        plugins: {
          xwalk: {
            page: {
              resourceType: `generated/components/${blockName}`
            }
          }
        }
      }
    ],
    models: [
      {
        id: blockName,
        fields: block.fields
      }
    ],
    filter: {
      id: blockName,
      components: [blockName]
    }
  };
}

function createDemoHtml({ safeProject, migrationPlan }) {
  const blocks = migrationPlan.blocks.map((block, index) => {
    const blockName = toKebabCase(block.name);
    const resource = `urn:aemconnection:/content/${safeProject}/home/jcr:content/root/${blockName}-${index + 1}`;
    const title = block.content.title || block.content.titleText || titleCase(blockName);
    const description = block.content.description || block.content.body || '';
    return `<section class="${blockName}" data-aue-resource="${resource}" data-aue-type="component" data-aue-label="${titleCase(blockName)}">\n  <div>\n    <h2 data-aue-prop="title" data-aue-type="text">${escapeHtml(title)}</h2>\n    <p data-aue-prop="description" data-aue-type="text">${escapeHtml(description)}</p>\n  </div>\n</section>`;
  }).join('\n\n');

  return `<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <script src="https://universal-editor-service.adobe.io/cors.js" async></script>\n  <meta name="urn:adobe:aue:system:aemconnection" content="aem:https://author.example.adobeaemcloud.com">\n  <link rel="stylesheet" href="./styles/styles.css">\n  <title>${safeProject}</title>\n</head>\n<body>\n<main>\n${blocks}\n</main>\n</body>\n</html>\n`;
}

function titleCase(value) {
  return value.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
