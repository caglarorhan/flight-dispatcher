// ─── Merger ────────────────────────────────────────────────────────────────────
//
// Merge strategy: section-based, not line-by-line.
//
// On re-run or --update:
//   - Auto-detected sections → refreshed
//   - "About This Project" → preserved (user wrote it)
//   - "Architecture Rules" → preserved + user asked if they want to add more
//   - "Pending TODOs" → preserved as-is (user manages manually)
//   - "Developer Preferences" → re-loaded from profile
//

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  header: string; // e.g. "## About This Project"
  level: number;  // 1 = #, 2 = ##, etc.
  content: string;
}

// Sections that are always preserved from existing file
const PRESERVED_SECTIONS = [
  'About This Project',
  'Pending TODOs',
  'Architecture Rules',
];

// ─── Parse ────────────────────────────────────────────────────────────────────

export function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const lines = markdown.split('\n');

  let currentSectionHeader = '';
  let currentSectionLevel = 0;
  let currentContent: string[] = [];
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);

    if (match) {
      const level = match[1].length;
      const header = match[2].trim();

      // Save previous section
      if (inSection || currentSectionHeader) {
        sections.push({
          header: currentSectionHeader,
          level: currentSectionLevel,
          content: currentContent.join('\n').trimEnd(),
        });
      }

      currentSectionHeader = header;
      currentSectionLevel = level;
      currentContent = [line];
      inSection = true;
    } else {
      if (inSection) {
        currentContent.push(line);
      }
    }
  }

  // Push last section
  if (inSection && currentSectionHeader) {
    sections.push({
      header: currentSectionHeader,
      level: currentSectionLevel,
      content: currentContent.join('\n').trimEnd(),
    });
  }

  // Add preamble (content before first heading)
  // (already handled as first section content starting w/ #)
  void headerRegex;
  return sections;
}

// ─── Extract Preserved Data ───────────────────────────────────────────────────

export interface PreservedData {
  description: string;
  architectureRules: string[];
  todos: string[];
}

export function extractPreservedData(existingContent: string): PreservedData {
  const sections = parseSections(existingContent);

  const aboutSection = sections.find((s) => s.header === 'About This Project');
  const archSection = sections.find((s) => s.header === 'Architecture Rules');
  const todoSection = sections.find((s) => s.header === 'Pending TODOs');

  // Extract description (everything after the heading line)
  const description = aboutSection
    ? aboutSection.content
        .split('\n')
        .slice(1)
        .join('\n')
        .trim()
    : '';

  // Extract architecture rules as array (lines starting with -)
  const architectureRules = archSection
    ? archSection.content
        .split('\n')
        .filter((l) => l.trim().startsWith('- '))
        .map((l) => l.trim().slice(2).trim())
    : [];

  // Extract todos (lines starting with - [ ] or - [x])
  const todos = todoSection
    ? todoSection.content
        .split('\n')
        .filter((l) => l.trim().match(/^- \[[ x]\]/))
        .map((l) => {
          const m = l.trim().match(/^- \[[ x]\]\s*(.+)$/);
          return m ? m[1].trim() : '';
        })
        .filter(Boolean)
    : [];

  return { description, architectureRules, todos };
}

// ─── Merge ────────────────────────────────────────────────────────────────────

/**
 * Merge an existing copilot-instructions.md with newly generated content.
 * Preserved sections (About, Architecture Rules, Pending TODOs) are kept
 * from the existing file. All other sections use the freshly generated content.
 */
export function merge(existingContent: string, newContent: string): string {
  const existingSections = parseSections(existingContent);
  const newSections = parseSections(newContent);

  // Build a map of new sections (keyed by header)
  const newSectionsMap = new Map<string, Section>();
  for (const section of newSections) {
    newSectionsMap.set(section.header, section);
  }

  // Build a map of existing sections
  const existingSectionsMap = new Map<string, Section>();
  for (const section of existingSections) {
    existingSectionsMap.set(section.header, section);
  }

  // Determine final section order from new content (canonical structure)
  const finalSections: Section[] = [];

  for (const newSection of newSections) {
    if (PRESERVED_SECTIONS.includes(newSection.header)) {
      // Use preserved content from existing file if it exists
      const existing = existingSectionsMap.get(newSection.header);
      if (existing) {
        finalSections.push(existing);
      } else {
        // No existing version, use new
        finalSections.push(newSection);
      }
    } else {
      // Use fresh content
      finalSections.push(newSection);
    }
  }

  // Append any sections from existing file that aren't in the new template
  // (user-added custom sections)
  for (const existingSection of existingSections) {
    const alreadyIncluded =
      newSectionsMap.has(existingSection.header) ||
      finalSections.some((s) => s.header === existingSection.header);
    if (!alreadyIncluded && existingSection.header !== existingSection.header) {
      finalSections.push(existingSection);
    }
  }

  return finalSections.map((s) => s.content).join('\n\n') + '\n';
}

// ─── Update Header Timestamp ──────────────────────────────────────────────────

export function updateTimestamp(content: string, date: string): string {
  return content.replace(
    /> Auto-generated by flight-dispatcher on .+?\. Re-run/,
    `> Auto-generated by flight-dispatcher on ${date}. Re-run`
  );
}
