export function createLlmProvider() {
  const provider = process.env.LLM_PROVIDER || 'mock';

  if (provider !== 'mock') {
    console.warn(`LLM_PROVIDER=${provider} configured, but this starter currently uses mock provider. Extend llmProvider.js to add real integration.`);
  }

  return {
    async createMigrationPlan({ url, projectName, prompt, domAnalysis }) {
      return {
        projectName,
        sourceUrl: url,
        prompt: prompt || 'Migrate page to AEM EDS with Universal Editor support',
        strategy: 'hybrid-template-plus-llm',
        blocks: domAnalysis.sections.map((section, index) => ({
          name: section.type,
          order: index + 1,
          confidence: section.confidence,
          requiresReview: section.confidence < 0.75,
          fields: inferFields(section),
          content: section.content
        }))
      };
    }
  };
}

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
      { name: 'items', type: 'multi', fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'image', type: 'image' },
        { name: 'href', type: 'url' }
      ]}
    ];
  }

  return [
    { name: 'title', type: 'text' },
    { name: 'body', type: 'richtext' }
  ];
}
