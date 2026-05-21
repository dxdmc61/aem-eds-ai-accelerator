import fs from 'fs-extra';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

/**
 * Cleanly formats compressed JS code strings into legible, indented multi-line code.
 * @param {string} rawJs 
 * @returns {string} Beautifully formatted JavaScript code block
 */
function formatJS(rawJs) {
  let formatted = rawJs
    .replace(/\\n/g, '\n') // Turn literal escaped newlines into real newlines
    .replace(/[{};]/g, '$&\n') // Force new line after braces and semicolons
    .replace(/\n\s*\n/g, '\n') // Collapse excessive stacked empty lines
    .trim();

  let indentLevel = 0;
  const lines = formatted.split('\n');
  
  return lines.map(line => {
    let cleanLine = line.trim();
    if (cleanLine.startsWith('}') || cleanLine.startsWith(']')) indentLevel--;
    
    // Apply current tab structure indentation
    const spaces = '  '.repeat(Math.max(0, indentLevel));
    const processedLine = cleanLine ? `${spaces}${cleanLine}` : '';
    
    if (cleanLine.endsWith('{') || cleanLine.endsWith('[')) indentLevel++;
    return processedLine;
  }).join('\n');
}

/**
 * Cleanly formats compressed CSS code strings into legible, indented multi-line styles.
 * @param {string} rawCss
 * @returns {string} Beautifully formatted CSS block
 */
function formatCSS(rawCss) {
  return rawCss
    .replace(/\\n/g, '\n')
    .replace(/\{/g, ' {\n  ')
    .replace(/\}/g, '\n}\n\n')
    .replace(/;/g, ';\n  ')
    .replace(/\n\s*\n/g, '\n')
    .replace(/  \}/g, '}') // Remove trailing spaces before closing braces
    .trim();
}

/**
 * Generates an Adobe Edge Delivery Services codebase adhering exactly to the
 * official aem-block-collection-xwalk unified schema architecture, with unique,
 * production-ready component code generated dynamically by Gemini.
 */
export async function generateEdsProject({ outputDir, projectName, aemAuthorUrl, migrationPlan }) {
  const tenant = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Create fundamental directories
  const blocksDir = path.join(outputDir, 'blocks');
  await fs.ensureDir(blocksDir);

  // Initialize global configuration stores matching Adobe specs
  const globalDefinitions = { groups: [{ title: "Generated Components", components: [] }] };
  const globalModels = [];
  const globalFilters = [];

  // Initialize the Gemini AI connection to handle block logic synthesis
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // Iterate over blocks found by Gemini
  for (const block of migrationPlan.blocks) {
    const blockName = block.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const resourceType = `${tenant}/components/${blockName}`;
    const singleBlockDir = path.join(blocksDir, blockName);
    await fs.ensureDir(singleBlockDir);

    // 1. Build component-definitions array item
    globalDefinitions.groups[0].components.push({
      title: block.name.charAt(0).toUpperCase() + block.name.slice(1),
      id: blockName,
      plugins: {
        xwalk: {
          page: {
            resourceType,
            template: {
              name: blockName,
              model: blockName
            }
          }
        }
      }
    });

    // 2. Build component-models array item
    globalModels.push({
      id: blockName,
      fields: block.fields.map(field => ({
        name: field.name,
        type: field.type === 'array' || field.type === 'multi' ? 'array' : field.type
      }))
    });

    // 3. Build component-filters entry
    globalFilters.push({
      id: blockName,
      components: [blockName]
    });

    // 4. Default baseline configurations
    let cssContent = `/* Styles for ${blockName} */\n.${blockName}-container {\n  padding: 2rem 1rem;\n}`;
    let jsContent = `export default function decorate(block) {\n  block.classList.add('${blockName}--decorated');\n}`;

    // 5. Generate matching component code loops using Gemini
    if (ai) {
      try {
        console.log(`[Code Synthesizer] Writing functional layout modules for block: ${blockName}`);
        
        const codePrompt = `
          You are a professional frontend engineer optimizing code for Adobe Edge Delivery Services (EDS).
          Analyze this block definition extracted from a source page migration audit:
          
          Block Name: ${blockName}
          Fields Expected from AEM Content API: ${JSON.stringify(block.fields)}
          Raw Sample Element Data Data Map: ${JSON.stringify(block.content)}

          Generate two separate standalone code fragments inside a clean JSON schema:
          1. "css": Write beautiful, functional, responsive CSS styled to mimic modern design structures. Avoid global layout pollution; scope rules cleanly to .${blockName} and its children. Do not provide a compressed single line string.
          2. "js": Write an ES6 export default function decorate(block) module. It must read structural rows from the element wrapper (block.children) following the order of fields specified in the schema, transform plain tables into semantic semantic markup structures (e.g., building structural grids, handling button anchors, or nesting child element columns), and append the final HTML layout cleanly back onto the DOM.
        `;

        const codeSchema = {
          type: 'OBJECT',
          properties: {
            css: { type: 'STRING', description: 'Complete structured layout stylesheet definition rules.' },
            js: { type: 'STRING', description: 'Functional ES6 standard module layout script including default decorate function.' }
          },
          required: ['css', 'js']
        };

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [codePrompt],
          config: {
            responseMimeType: 'application/json',
            responseSchema: codeSchema,
            temperature: 0.2
          }
        });

        const codeGenerated = JSON.parse(response.text);
        
        // Pass the raw string outputs through our beautifiers
        cssContent = formatCSS(codeGenerated.css);
        jsContent = formatJS(codeGenerated.js);

      } catch (err) {
        console.warn(`[Code Synthesizer] Problem synthesizing code for ${blockName}, falling back to defaults.`, err);
      }
    }

    // Write the formatted code outputs to disk
    await fs.writeFile(path.join(singleBlockDir, `${blockName}.css`), cssContent, 'utf-8');
    await fs.writeFile(path.join(singleBlockDir, `${blockName}.js`), jsContent, 'utf-8');
  }

  // Write out the three root unified files exactly per Adobe's aem-block-collection-xwalk layout
  await fs.writeJson(path.join(outputDir, 'component-definition.json'), globalDefinitions, { spaces: 2 });
  await fs.writeJson(path.join(outputDir, 'component-models.json'), { models: globalModels }, { spaces: 2 });
  await fs.writeJson(path.join(outputDir, 'component-filters.json'), { filters: globalFilters }, { spaces: 2 });

  // Generate fstab.yaml to link crosswalk directly with your environment
  const targetHost = aemAuthorUrl.replace(/\/$/, '');
  const fstabContent = `mountpoints:\n  /: https://content.adobe.xwalk.com/v1/documents/${targetHost}\n`;
  await fs.writeFile(path.join(outputDir, 'fstab.yaml'), fstabContent, 'utf-8');
}