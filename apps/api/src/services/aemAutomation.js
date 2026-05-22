// services/aemAutomation.js
import axios from 'axios';
import FormData from 'form-data';

/**
 * Programmatically provisions clean documentless Edge Delivery Services structures.
 * Forces site root and language segments to generate as cq:Page nodes rather than generic folders.
 */
export async function provisionFranklinAemPage({ aemAuthorUrl, projectName, pageSlug, pageTitle, migrationPlan, aemUser, aemPassword }) {
  const tenant = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanAuthorUrl = aemAuthorUrl.replace(/\/$/, '');
  
  // Base site path destination configuration
  const siteRootPath = `./jcr:content/root`; // Relative handling context if hitting page path directly
  const cleanBaseRoot = `/content/${tenant}`;
  
  console.log(`[Franklin Automator] Processing page deployment structure for site content root: ${cleanBaseRoot}`);

  try {
    const payloadForm = new FormData();

    // =========================================================================
    // FIX: FORCE INTERMEDIATE SITE AND LANGUAGE OBJECTS TO BE PAGES, NOT FOLDERS
    // =========================================================================
    // By providing structural metadata parameters explicitly, the Sling Post Servlet 
    // overrides the default fallback to 'sling:OrderedFolder'.
    
    // 1. Enforce Site Node Schema Property Definitions (/content/axis)
    payloadForm.append(`../jcr:primaryType`, 'cq:Page');
    payloadForm.append(`../jcr:content/jcr:primaryType`, 'cq:PageContent');
    payloadForm.append(`../jcr:content/sling:resourceType`, 'core/franklin/components/page/v1/page');
    payloadForm.append(`../jcr:content/jcr:title`, tenant);
    payloadForm.append(`../jcr:content/cq:template`, '/libs/core/franklin/templates/page');

    // 2. Enforce Locale Root Node Schema Property Definitions (/content/axis/en)
    payloadForm.append(`./jcr:primaryType`, 'cq:Page');
    payloadForm.append(`./jcr:content/jcr:primaryType`, 'cq:PageContent');
    payloadForm.append(`./jcr:content/sling:resourceType`, 'core/franklin/components/page/v1/page');
    payloadForm.append(`./jcr:content/jcr:title`, 'en');
    payloadForm.append(`./jcr:content/cq:template`, '/libs/core/franklin/templates/page');

    // 3. Current Targeted Document Asset Core (e.g., /content/axis/en/index)
    const targetNodePrefix = `./${pageSlug}`;
    payloadForm.append(`${targetNodePrefix}/jcr:primaryType`, 'cq:Page');
    payloadForm.append(`${targetNodePrefix}/jcr:content/jcr:primaryType`, 'cq:PageContent');
    payloadForm.append(`${targetNodePrefix}/jcr:content/jcr:title`, pageTitle);
    payloadForm.append(`${targetNodePrefix}/jcr:content/pageTitle`, pageTitle);
    payloadForm.append(`${targetNodePrefix}/jcr:content/sling:resourceType`, 'core/franklin/components/page/v1/page');
    payloadForm.append(`${targetNodePrefix}/jcr:content/cq:template`, '/libs/core/franklin/templates/page');
    payloadForm.append(`${targetNodePrefix}/jcr:content/jcr:isCheckedOut`, 'true');

    // Establish targeted Page Container Engine Node
    const targetRootPath = `${targetNodePrefix}/jcr:content/root`;
    payloadForm.append(`${targetRootPath}/jcr:primaryType`, 'nt:unstructured');
    payloadForm.append(`${targetRootPath}/sling:resourceType`, 'core/franklin/components/root/v1/root');

    // =========================================================================
    // MIGRATION LAYOUT ENGINE PROCESSING (MATCHING WORKING SCHEMA)
    // =========================================================================
    migrationPlan.blocks.forEach((block, blockIndex) => {
      const normalizedBlockId = block.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const capitalizedBlockName = block.name.charAt(0).toUpperCase() + block.name.slice(1);
      
      // Building isolated standalone structural sections matching working blueprint layout
      const sectionNodePath = `${targetRootPath}/section_${blockIndex}`;
      payloadForm.append(`${sectionNodePath}/jcr:primaryType`, 'nt:unstructured');
      payloadForm.append(`${sectionNodePath}/sling:resourceType`, 'core/franklin/components/section/v1/section');
      payloadForm.append(`${sectionNodePath}/model`, 'section');

      // Add a uniquely configured block wrapper reference element node inside the section
      const blockContainerNodePath = `${sectionNodePath}/${normalizedBlockId}`;
      payloadForm.append(`${blockContainerNodePath}/jcr:primaryType`, 'nt:unstructured');
      payloadForm.append(`${blockContainerNodePath}/sling:resourceType`, 'core/franklin/components/block/v1/block');
      payloadForm.append(`${blockContainerNodePath}/name`, capitalizedBlockName);
      payloadForm.append(`${blockContainerNodePath}/model`, normalizedBlockId);
      payloadForm.append(`${blockContainerNodePath}/filter`, normalizedBlockId);

      // Collect field layout profile parameter arrays accurately
      const fieldNamesList = block.fields && Array.isArray(block.fields) ? block.fields.map(f => f.name) : [];
      
      // Force native string arrays for field lists to avoid structural key transformation errors
      fieldNamesList.forEach((name) => {
        payloadForm.append(`${blockContainerNodePath}/modelFields`, name);
      });
      if (fieldNamesList.length > 0) {
        payloadForm.append(`${blockContainerNodePath}/modelFields@TypeHint`, 'String[]');
      }

      // Handle Component Nested Item Row Arrays Processing Strategy
      if (block.isNestedArray || block.items) {
        const blockItems = Array.isArray(block.items) ? block.items : [];
        
        blockItems.forEach((itemData, itemIndex) => {
          // Normalizing suffix schemes (e.g. converting multi-row properties to card_0, card_1 style keys)
          const cleanSingleItemName = normalizedBlockId.endsWith('s') ? normalizedBlockId.slice(0, -1) : normalizedBlockId;
          const itemNodeKey = `${cleanSingleItemName}_${itemIndex}`;
          const itemNodePath = `${blockContainerNodePath}/${itemNodeKey}`;
          
          payloadForm.append(`${itemNodePath}/jcr:primaryType`, 'nt:unstructured');
          payloadForm.append(`${itemNodePath}/sling:resourceType`, 'core/franklin/components/block/v1/block/item');
          payloadForm.append(`${itemNodePath}/model`, cleanSingleItemName);
          payloadForm.append(`${itemNodePath}/name`, `${capitalizedBlockName} Item`);
          
          fieldNamesList.forEach((name) => {
            payloadForm.append(`${itemNodePath}/modelFields`, name);
          });
          if (fieldNamesList.length > 0) {
            payloadForm.append(`${itemNodePath}/modelFields@TypeHint`, 'String[]');
          }

          // Distribute node field dataset values properly
          Object.entries(itemData).forEach(([key, value]) => {
            payloadForm.append(`${itemNodePath}/${key}`, String(value));
          });
        });
      } else {
        // Flat structures (e.g., Heroes with single level structures)
        if (block.content) {
          Object.entries(block.content).forEach(([key, value]) => {
            payloadForm.append(`${blockContainerNodePath}/${key}`, String(value));
          });
        }
      }
    });

    // Execution Context Setup via unified POST call addressing the language route directly
    const executionEndpointUrl = `${cleanAuthorUrl}/content/${tenant}/en`;
    const basicAuthToken = Buffer.from(`${aemUser}:${aemPassword}`).toString('base64');

    await axios.post(executionEndpointUrl, payloadForm, {
      headers: {
        ...payloadForm.getHeaders(),
        'Authorization': `Basic ${basicAuthToken}`
      }
    });

    console.log(`[Franklin Automator] Site layout environment successfully generated at: ${executionEndpointUrl}/${pageSlug}`);
    return { success: true, path: `${executionEndpointUrl}/${pageSlug}` };

  } catch (error) {
    console.error(`[Franklin Automator] Structure injection failed:`, error.response?.data || error.message);
    throw new Error(`Failed establishing site architecture profiles: ${error.message}`);
  }
}