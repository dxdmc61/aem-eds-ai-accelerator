import fs from 'fs-extra';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// Native formatters to avoid squashing code into a single line
function formatJS(rawJs) {
  let formatted = rawJs.replace(/\\n/g, '\n').replace(/[{};]/g, '$&\n').replace(/\n\s*\n/g, '\n').trim();
  let indentLevel = 0;
  return formatted.split('\n').map(line => {
    let cleanLine = line.trim();
    if (cleanLine.startsWith('}') || cleanLine.startsWith(']')) indentLevel--;
    const spaces = '  '.repeat(Math.max(0, indentLevel));
    if (cleanLine.endsWith('{') || cleanLine.endsWith('[')) indentLevel++;
    return cleanLine ? `${spaces}${cleanLine}` : '';
  }).join('\n');
}

function formatCSS(rawCss) {
  return rawCss.replace(/\\n/g, '\n').replace(/\{/g, ' {\n  ').replace(/\}/g, '\n}\n\n').replace(/;/g, ';\n  ').replace(/\n\s*\n/g, '\n').replace(/  \}/g, '}').trim();
}

/**
 * Incrementally merges generated blocks into an existing local copy of the boilerplate.
 */
export async function mergeBlocksToBoilerplate({ repoLocalPath, projectName, migrationPlan }) {
  const tenant = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const blocksDir = path.join(repoLocalPath, 'blocks');
  await fs.ensureDir(blocksDir);

  // Paths to the three central global manifests in your boilerplate repo
  const defPath = path.join(repoLocalPath, 'component-definition.json');
  const modPath = path.join(repoLocalPath, 'component-models.json');
  const filPath = path.join(repoLocalPath, 'component-filters.json');

  // 1. Read existing config files or initialize empty ones if they don't exist yet
  let globalDefinitions = (await fs.pathExists(defPath)) 
    ? await fs.readJson(defPath) 
    : { groups: [{ title: "Generated Components", components: [] }] };

  let globalModels = (await fs.pathExists(modPath)) 
    ? (await fs.readJson(modPath)).models || [] 
    : [];

  let globalFilters = (await fs.pathExists(filPath)) 
    ? (await fs.readJson(filPath)).filters || [] 
    : [];

  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  for (const block of migrationPlan.blocks) {
    const blockName = block.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const resourceType = `${tenant}/components/${blockName}`;
    const singleBlockDir = path.join(blocksDir, blockName);

    // DEDUPLICATION CHECK: If the block directory already exists, REUSE it and do not overwrite
    if (await fs.pathExists(singleBlockDir)) {
      console.log(`[Deduplicator] Block "${blockName}" already exists in boilerplate. Reusing existing code assets.`);
      continue; 
    }

    // 2. Block is new. Provision target directory
    await fs.ensureDir(singleBlockDir);

    // 3. Update component-definition.json
    if (!globalDefinitions.groups[0].components.some(c => c.id === blockName)) {
      globalDefinitions.groups[0].components.push({
        title: block.name.charAt(0).toUpperCase() + block.name.slice(1),
        id: blockName,
        plugins: { xwalk: { page: { resourceType, template: { name: blockName, model: blockName } } } }
      });
    }

    // 4. Update component-models.json
    if (!globalModels.some(m => m.id === blockName)) {
      globalModels.push({
        id: blockName,
        fields: block.fields.map(field => ({
          name: field.name,
          type: field.type === 'array' || field.type === 'multi' ? 'array' : field.type
        }))
      });
    }

    // 5. Update component-filters.json
    if (!globalFilters.some(f => f.id === blockName)) {
      globalFilters.push({ id: blockName, components: [blockName] });
    }

    // 6. Synthesize fresh component visual layers via Gemini
    let cssContent = `/* Styles for ${blockName} */\n.${blockName} { display: block; }`;
    let jsContent = `export default function decorate(block) { block.classList.add('${blockName}--decorated'); }`;

    if (ai) {
      try {
        console.log(`[AI Synthesis] Designing code structures for new block: ${blockName}`);
        const codePrompt = `
          You are a professional frontend engineer optimizing code for AEM Edge Delivery Services (EDS) + Crosswalk.
          Block Name: ${blockName}
          Fields Expected from AEM: ${JSON.stringify(block.fields)}
          Generate a valid JSON object matching this schema:
          { "css": "scoped string CSS rules for .${blockName}", "js": "ES6 default export function decorate(block) module" }
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [codePrompt],
          config: { responseMimeType: 'application/json', temperature: 0.2 }
        });

        const codeGenerated = JSON.parse(response.text);
        cssContent = formatCSS(codeGenerated.css);
        jsContent = formatJS(codeGenerated.js);
      } catch (err) {
        console.warn(`[AI Synthesis] Failed generating code for ${blockName}, falling back to defaults.`, err);
      }
    }

    await fs.writeFile(path.join(singleBlockDir, `${blockName}.css`), cssContent, 'utf-8');
    await fs.writeFile(path.join(singleBlockDir, `${blockName}.js`), jsContent, 'utf-8');
  }

  // Write the cleanly aggregated unified configs back out to your local workspace files
  await fs.writeJson(defPath, globalDefinitions, { spaces: 2 });
  await fs.writeJson(modPath, { models: globalModels }, { spaces: 2 });
  await fs.writeJson(filPath, { filters: globalFilters }, { spaces: 2 });

  console.log(`[Incremental Generator] Manifest updates successfully aggregated inside boilerplate.`);
}