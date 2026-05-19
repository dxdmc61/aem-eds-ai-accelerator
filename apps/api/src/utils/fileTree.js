import fs from 'fs-extra';
import path from 'path';

export async function listFilesRecursive(dir) {
  const results = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(dir, absolute);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else {
        results.push(relative);
      }
    }
  }

  await walk(dir);
  return results.sort();
}
