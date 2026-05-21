import axios from 'axios';
import FormData from 'form-data';

/**
 * Programmatically constructs a documentless AEM Edge Delivery Services page mapping 
 * exactly to the core Franklin JCR layout schema observed in infinity.json.
 * * @param {Object} params
 * @param {string} params.aemAuthorUrl - The URL string of your cloud author environment
 * @param {string} params.projectName - Your tenant identity string (e.g. "suncrop")
 * @param {string} params.pageSlug - Clean URL routing string for the page (e.g. "home-migrated")
 * @param {string} params.pageTitle - Editorial descriptive text for the title meta field
 * @param {Object} params.migrationPlan - Structured JSON context compiled by Gemini
 * @param {string} params.accessToken - Active OAuth Authorization Bearer key token
 */
export async function provisionFranklinAemPage({ aemAuthorUrl, projectName, pageSlug, pageTitle, migrationPlan, accessToken }) {
  const tenant = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanAuthorUrl = aemAuthorUrl.replace(/\/$/, '');
  
  // Build canonical resource API endpoints
  const pagePath = `${cleanAuthorUrl}/content/${tenant}/en/${pageSlug}`;
  console.log(`[Franklin Automator] Provisioning layout structure at: ${pagePath}`);

  try {
    const payloadForm = new FormData();

    // 1. Establish core Primary Page Node Layout Meta Fields
    payloadForm.append('./jcr:primaryType', 'cq:Page');
    payloadForm.append('./jcr:content/jcr:primaryType', 'cq:PageContent');
    payloadForm.append('./jcr:content/jcr:title', pageTitle);
    payloadForm.append('./jcr:content/pageTitle', pageTitle);
    payloadForm.append('./jcr:content/sling:resourceType', 'core/franklin/components/page/v1/page');
    payloadForm.append('./jcr:content/cq:template', '/libs/core/franklin/templates/page');
    payloadForm.append('./jcr:content/jcr:isCheckedOut', 'true');

    // 2. Establish Primary Body Layout Container Engine (Root Node)
    payloadForm.append('./jcr:content/root/jcr:primaryType', 'nt:unstructured');
    payloadForm.append('./jcr:content/root/sling:resourceType', 'core/franklin/components/root/v1/root');

    // 3. Transform Scraped Blocks array lists into Nested Franklin Sections
    migrationPlan.blocks.forEach((block, blockIndex) => {
      const normalizedBlockId = block.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      // Construct an isolated wrapping section matching infinity.json format
      const sectionNodePath = `./jcr:content/root/section_${blockIndex}`;
      payloadForm.append(`${sectionNodePath}/jcr:primaryType`, 'nt:unstructured');
      payloadForm.append(`${sectionNodePath}/sling:resourceType`, 'core/franklin/components/section/v1/section');
      
      // Establish the core container node within this specific section context
      const blockContainerNodePath = `${sectionNodePath}/${normalizedBlockId}`;
      payloadForm.append(`${blockContainerNodePath}/jcr:primaryType`, 'nt:unstructured');
      payloadForm.append(`${blockContainerNodePath}/sling:resourceType`, 'core/franklin/components/block/v1/block');
      payloadForm.append(`${blockContainerNodePath}/name`, block.name);
      payloadForm.append(`${blockContainerNodePath}/model`, normalizedBlockId);
      payloadForm.append(`${blockContainerNodePath}/filter`, normalizedBlockId);

      // Collect field key maps to identify layout profiles
      const fieldNamesList = block.fields.map(f => f.name);
      fieldNamesList.forEach((name, i) => {
        payloadForm.append(`${blockContainerNodePath}/modelFields/${i}`, name);
      });

      // Handle Component Item Scaffolding Strategy
      if (block.isNestedArray || block.items) {
        // Multi-row structured array components (e.g. Carousels, Card Grids, Accordions)
        const blockItems = Array.isArray(block.items) ? block.items : [];
        
        blockItems.forEach((itemData, itemIndex) => {
          const itemNodeKey = `item_${Date.now()}_${itemIndex}`;
          const itemNodePath = `${blockContainerNodePath}/${itemNodeKey}`;
          
          payloadForm.append(`${itemNodePath}/jcr:primaryType`, 'nt:unstructured');
          payloadForm.append(`${itemNodePath}/sling:resourceType`, 'core/franklin/components/block/v1/block/item');
          payloadForm.append(`${itemNodePath}/model`, normalizedBlockId);
          payloadForm.append(`${itemNodePath}/name`, `${block.name} Item`);
          
          fieldNamesList.forEach((name, i) => {
            payloadForm.append(`${itemNodePath}/modelFields/${i}`, name);
          });

          // Append value streams extracted from the source site
          Object.entries(itemData).forEach(([key, value]) => {
            payloadForm.append(`${itemNodePath}/${key}`, String(value));
          });
        });
      } else {
        // Flat, unified structural layouts (e.g. Simple Hero elements, Text rows)
        if (block.content) {
          Object.entries(block.content).forEach(([key, value]) => {
            payloadForm.append(`${blockContainerNodePath}/${key}`, String(value));
          });
        }
      }
    });

    // 4. Issue the unified request mutation to the target Sling Server
    await axios.post(pagePath, payloadForm, {
      headers: {
        ...payloadForm.getHeaders(),
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`[Franklin Automator] Page structure deployed successfully! URL: ${pagePath}`);
    return { success: true, path: pagePath };

  } catch (error) {
    console.error(`[Franklin Automator] Page node injection procedure failed:`, error.response?.data || error.message);
    throw new Error(`Failed establishing Franklin structured page layout parameters: ${error.message}`);
  }
}