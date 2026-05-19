import { GoogleGenAI } from '@google/genai';

/**
 * Define a strict structural schema that Gemini MUST follow.
 * This ensures that Gemini formats the plan perfectly so your code 
 * generator doesn't crash or encounter missing array parameters.
 */
const migrationPlanSchema = {
  type: 'OBJECT',
  properties: {
    projectName: { type: 'STRING' },
    sourceUrl: { type: 'STRING' },
    prompt: { type: 'STRING' },
    strategy: { type: 'STRING' },
    blocks: {
      type: 'ARRAY',
      description: 'The sequence of detected component blocks to migrate.',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'The matching block name tag in kebab-case (e.g., "hero", "cards", "columns").' },
          order: { type: 'INTEGER', description: 'The placement sequence number of the block on the page.' },
          confidence: { type: 'NUMBER', description: 'AI estimation confidence score between 0.0 and 1.0.' },
          requiresReview: { type: 'BOOLEAN', description: 'Flag true if structural anomalies are suspected.' },
          fields: {
            type: 'ARRAY',
            description: 'The structural property fields required for Universal Editor properties configuration sidebars.',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Property identifier name key (e.g., "title", "image", "ctaText").' },
                type: { type: 'STRING', description: 'The field type declaration (e.g., "text", "richtext", "image", "url").' }
              },
              required: ['name', 'type']
            }
          },
          content: {
            type: 'OBJECT',
            description: 'The raw, actual copy-text mapping data extracted from the element content node.'
          }
        },
        required: ['name', 'order', 'confidence', 'requiresReview', 'fields', 'content']
      }
    }
  },
  required: ['projectName', 'sourceUrl', 'prompt', 'strategy', 'blocks']
};

export function createLlmProvider() {
  const provider = process.env.LLM_PROVIDER || 'mock';

  // Handle Gemini Provider Workflow Engine Integration
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('LLM_PROVIDER=gemini is set but GEMINI_API_KEY is missing from environmental parameters (.env)');
    }

    const ai = new GoogleGenAI({ apiKey });

    return {
      async createMigrationPlan({ url, projectName, prompt, domAnalysis }) {
        console.log(`[Gemini Engine] Generating layout migration schema strategy for target site: ${url}`);

        const userPrompt = prompt || 'Migrate page to AEM EDS with Universal Editor support';

        const systemInstruction = `
          You are a professional AEM architecture model that converts DOM snapshots into clean, production-ready Edge Delivery Services (EDS) blocks.
          Analyze the input DOM analysis configuration payload. Map each structural layout zone cleanly into standard component architectures.
          
          For each identified block, parse out its core edit fields and exact content structure mapping. 
          Use clear block naming conventions such as "hero", "cards", "text", "columns", "header", or "footer".
        `;

        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              `Target URL: ${url}`,
              `Project ID Reference: ${projectName}`,
              `Custom migration instructions checklist: ${userPrompt}`,
              `Input DOM analysis extraction tree: ${JSON.stringify(domAnalysis)}`
            ],
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: migrationPlanSchema,
              temperature: 0.1 // Kept very low to preserve code structure validity and layout logic parity
            }
          });

          // Standard text extraction returns perfectly formed JSON adhering to migrationPlanSchema
          return JSON.parse(response.text);
        } catch (error) {
          console.error('[Gemini Engine] Critical processing error generating migration mapping schema:', error);
          throw error;
        }
      }
    };
  }

  // --- Mock Provider Fallback Workflow Loop ---
  console.log('[LLM Provider] Operating on MOCK compilation execution mode.');
  return {
    async createMigrationPlan({ url, projectName, prompt, domAnalysis }) {
      return {
        projectName,
        sourceUrl: url,
        prompt: prompt || 'Migrate page to AEM EDS with Universal Editor support',
        strategy: 'hybrid-template-plus-llm',
        blocks: (domAnalysis?.sections || []).map((section, index) => ({
          name: section.type,
          order: index + 1,
          confidence: section.confidence || 1.0,
          requiresReview: (section.confidence || 1.0) < 0.75,
          fields: inferFields(section),
          content: section.content || {}
        }))
      };
    }
  };
}

// Fallback helper function used exclusively by the Mock fallback loop
function inferFields(section) {
  if (section.type === 'hero') {
    return [
      { name: 'title', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'image', type: 'image' },
      { name: 'ctaText', type: 'text' },
      { name: 'ctaHref', type: 'url' }
    ];
  }

  if (section.type === 'cards') {
    return [
      { name: 'title', type: 'text' },
      { name: 'items', type: 'multi' }
    ];
  }

  return [
    { name: 'title', type: 'text' },
    { name: 'body', type: 'richtext' }
  ];
}