import { GoogleGenAI } from '@google/genai';

// Declare structural configuration schema for strict compliance
const responseSchema = {
  type: 'OBJECT',
  properties: {
    blocks: {
      type: 'ARRAY',
      description: 'The semantic functional blocks extracted from the source page layout.',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'Kebab-case component string matching folder name criteria (e.g., "hero", "cards").' },
          title: { type: 'STRING', description: 'A readable title designation for display inside Universal Editor sidebars.' },
          jsCode: { type: 'STRING', description: 'Clean block decoration vanilla JavaScript file script.' },
          cssCode: { type: 'STRING', description: 'Clean styling definitions to display structural modifications.' },
          localModel: {
            type: 'OBJECT',
            description: 'The specific structural JSON mapping options representing the fields configuration definition (_blockname.json).'
          }
        },
        required: ['id', 'title', 'jsCode', 'cssCode', 'localModel']
      }
    },
    componentDefinitions: {
      type: 'ARRAY',
      description: 'Blocks catalog array configuration elements targeting component-definition.json configurations.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          id: { type: 'STRING' },
          plugins: { type: 'OBJECT' }
        },
        required: ['title', 'id', 'plugins']
      }
    },
    componentModels: {
      type: 'ARRAY',
      description: 'Model object specifications mapping JCR values targeting component-models.json.',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          fields: { type: 'ARRAY', items: { type: 'OBJECT' } }
        },
        required: ['id', 'fields']
      }
    }
  },
  required: ['blocks', 'componentDefinitions', 'componentModels']
};

export class GeminiMigrationService {
  constructor() {
    // Note: The SDK natively fallback tracks process.env.GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing configuration parameter: GEMINI_API_KEY is unset.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Evaluates raw document source layouts to generate structural Universal Editor configurations.
   * @param {string} rawHtmlMarkup Content string evaluated by your data collection step.
   * @returns {Promise<Object>} Output adhering to responseSchema definition logic.
   */
  async processLayoutMigration(rawHtmlMarkup) {
    const prompt = `
      You are an elite AEM Cloud Service front-end engineer specializing in Edge Delivery Services (EDS) and the Crosswalk Universal Editor architecture framework.
      
      Review the submitted raw HTML layout structures. Identify fundamental user experience blocks (such as a structural Hero, Cards component, Text layouts, Header, or Footer patterns).
      
      For every component structure mapped, generate:
      1. An EDS block script (vanilla JS). It must export a default function decorate(block) that extracts tabular markup contents cleanly.
      2. Modern component style instructions (CSS).
      3. A Universal Editor wrapper definition configuring block plugins ('core/franklin/components/block/v1/block').
      4. Structured author fields mapping matching text fields, checkboxes, or image links observed.
      
      Source Content:
      -----------------------
      ${rawHtmlMarkup}
      -----------------------
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are an accurate layout migration compiler. Generate only clean code and structural JSON. Never return markdown blocks outside the schema definitions.',
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.1 // Set low to guarantee output conformance and syntax accuracy
        }
      });

      return JSON.parse(response.text);
    } catch (error) {
      console.error('Fatal execution exception during Gemini processing sequence:', error);
      throw error;
    }
  }
}