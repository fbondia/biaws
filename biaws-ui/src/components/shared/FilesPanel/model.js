export function buildFileTagCounts(files) {
  const counts = new Map();
  for (const file of files) {
    for (const tag of file.tags || []) {
      const normalized = String(tag).trim().toLowerCase();
      if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((first, second) => first.tag.localeCompare(second.tag));
}

export function tagColor(tag) {
  let hash = 0;
  for (const character of String(tag)) {
    hash = Math.trunc((hash << 5) - hash + character.charCodeAt(0));
  }
  const hue = Math.abs(hash) % 360;
  return {
    "--file-tag-background": `hsl(${hue} 75% 94%)`,
    "--file-tag-border": `hsl(${hue} 55% 72%)`,
    "--file-tag-color": `hsl(${hue} 55% 28%)`,
  };
}
