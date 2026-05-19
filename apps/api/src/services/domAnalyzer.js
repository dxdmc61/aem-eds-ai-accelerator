import * as cheerio from 'cheerio';

function cleanText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

export function analyzeDom(snapshot) {
  const $ = cheerio.load(snapshot.html);
  const title = cleanText($('title').first().text()) || 'Migrated Page';
  const headings = $('h1,h2,h3').map((_, el) => cleanText($(el).text())).get().filter(Boolean);
  const images = $('img').map((_, el) => ({
    src: $(el).attr('src'),
    alt: $(el).attr('alt') || ''
  })).get().filter(img => img.src);
  const links = $('a').map((_, el) => ({
    text: cleanText($(el).text()),
    href: $(el).attr('href')
  })).get().filter(link => link.href);

  const sections = [];

  const h1 = $('h1').first();
  if (h1.length) {
    sections.push({
      type: 'hero',
      confidence: 0.8,
      content: {
        title: cleanText(h1.text()),
        description: cleanText(h1.parent().find('p').first().text()) || headings[1] || '',
        image: images[0]?.src || '',
        ctaText: links[0]?.text || 'Learn more',
        ctaHref: links[0]?.href || '#'
      }
    });
  }

  if (links.length >= 3) {
    sections.push({
      type: 'cards',
      confidence: 0.65,
      content: {
        title: headings[1] || 'Featured links',
        items: links.slice(0, 6).map((link, index) => ({
          title: link.text || `Card ${index + 1}`,
          description: 'Migrated from source website.',
          href: link.href,
          image: images[index]?.src || ''
        }))
      }
    });
  }

  sections.push({
    type: 'text',
    confidence: 0.7,
    content: {
      title: headings[2] || 'Page content',
      body: cleanText($('p').slice(0, 3).text()) || 'Content migrated from the source page.'
    }
  });

  return {
    title,
    headings,
    images,
    links,
    sections
  };
}
