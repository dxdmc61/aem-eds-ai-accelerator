export async function crawlPage(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'AEM-EDS-AI-Accelerator/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}. Status: ${response.status}`);
  }

  const html = await response.text();

  return {
    url,
    fetchedAt: new Date().toISOString(),
    html
  };
}
