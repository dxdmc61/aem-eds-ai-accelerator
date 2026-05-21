// services/aemAutomation.js
import axios from 'axios';
import FormData from 'form-data';

/**
 * Programmatically constructs a documentless AEM Edge Delivery Services page mapping 
 * exactly to the core Franklin JCR layout schema observed in infinity.json.
 */
export async function provisionFranklinAemPage({ aemAuthorUrl, projectName, pageSlug, pageTitle, migrationPlan, aemUser, aemPassword }) {
  const tenant = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanAuthorUrl = aemAuthorUrl.replace(/\/$/, '');
  
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
      const capitalizedBlockName = block.name.charAt(0).toUpperCase() + block.name.slice(1);
      
      // Construct an isolated wrapping section matching infinity.json format
      const sectionNodePath = `./jcr:content/root/section_${blockIndex}`;
      payloadForm.append(`${sectionNodePath}/jcr:primaryType`, 'nt:unstructured');
      payloadForm.append(`${sectionNodePath}/sling:resourceType`, 'core/franklin/components/section/v1/section');
      
      // FIX 1: Add missing model descriptor onto the Section block itself
      payloadForm.append(`${sectionNodePath}/model`, 'section');

      // Establish the core container node within this specific section context
      const blockContainerNodePath = `${sectionNodePath}/${normalizedBlockId}`;
      payloadForm.append(`${blockContainerNodePath}/jcr:primaryType`, 'nt:unstructured');
      payloadForm.append(`${blockContainerNodePath}/sling:resourceType`, 'core/franklin/components/block/v1/block');
      payloadForm.append(`${blockContainerNodePath}/name`, capitalizedBlockName);
      payloadForm.append(`${blockContainerNodePath}/model`, normalizedBlockId);
      payloadForm.append(`${blockContainerNodePath}/filter`, normalizedBlockId);

      // Collect field key maps to identify layout profiles
      const fieldNamesList = block.fields && Array.isArray(block.fields) ? block.fields.map(f => f.name) : [];
      
      // FIX 2: Explicitly tell Sling via TypeHint to construct a String Array instead of structured nested object keys
      fieldNamesList.forEach((name) => {
        payloadForm.append(`${blockContainerNodePath}/modelFields`, name);
      });
      if (fieldNamesList.length > 0) {
        payloadForm.append(`${blockContainerNodePath}/modelFields@TypeHint`, 'String[]');
      }

      // Handle Component Item Scaffolding Strategy
      if (block.isNestedArray || block.items) {
        const blockItems = Array.isArray(block.items) ? block.items : [];
        
        blockItems.forEach((itemData, itemIndex) => {
          // FIX 3: Match the naming suffix scheme seen in working items (e.g., card_0, card_1)
          const cleanSingleItemName = normalizedBlockId.endsWith('s') ? normalizedBlockId.slice(0, -1) : normalizedBlockId;
          const itemNodeKey = `${cleanSingleItemName}_${itemIndex}`;
          const itemNodePath = `${blockContainerNodePath}/${itemNodeKey}`;
          
          payloadForm.append(`${itemNodePath}/jcr:primaryType`, 'nt:unstructured');
          payloadForm.append(`${itemNodePath}/sling:resourceType`, 'core/franklin/components/block/v1/block/item');
          payloadForm.append(`${itemNodePath}/model`, cleanSingleItemName);
          payloadForm.append(`${itemNodePath}/name`, `${capitalizedBlockName} Item`);
          
          // Apply model fields array mapping inside the nested row items
          fieldNamesList.forEach((name) => {
            payloadForm.append(`${itemNodePath}/modelFields`, name);
          });
          if (fieldNamesList.length > 0) {
            payloadForm.append(`${itemNodePath}/modelFields@TypeHint`, 'String[]');
          }

          // Append item properties
          Object.entries(itemData).forEach(([key, value]) => {
            payloadForm.append(`${itemNodePath}/${key}`, String(value));
          });
        });
      } else {
        // Flat content blocks (e.g., Hero elements)
        if (block.content) {
          Object.entries(block.content).forEach(([key, value]) => {
            payloadForm.append(`${blockContainerNodePath}/${key}`, String(value));
          });
        }
      }
    });

    // 4. Construct the Base64 Basic Authentication Token header
    const basicAuthToken = Buffer.from(`${aemUser}:${aemPassword}`).toString('base64');

    // 5. Issue the unified request mutation to the target Sling Server
    await axios.post(pagePath, payloadForm, {
      headers: {
        ...payloadForm.getHeaders(),
        'Authorization': `Basic ${basicAuthToken}`
      }
    });

    console.log(`[Franklin Automator] Page structure deployed successfully! URL: ${pagePath}`);
    return { success: true, path: pagePath };

  } catch (error) {
    console.error(`[Franklin Automator] Page node injection procedure failed:`, error.response?.data || error.message);
    throw new Error(`Failed establishing Franklin structured page layout parameters: ${error.message}`);
  }
}