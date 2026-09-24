// One release-section contract for version preparation, tag checks and release notes.
// Historical sections remain untouched; strict date checks apply to the requested release.

function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function releaseSection(
  changelog,
  version,
  { today = new Date().toISOString().slice(0, 10) } = {},
) {
  if (!calendarDate(today)) throw new Error('Release validation requires a valid UTC date.');
  const lines = changelog.split(/\r?\n/);
  // Comments and fenced examples are not real release headings. Keep line numbers intact.
  const visible = changelog
    .replace(/<!--[\s\S]*?(?:-->|$)/g, (comment) => comment.replace(/[^\r\n]/g, ' '))
    .split(/\r?\n/);
  const headings = [];
  let fence;
  for (let index = 0; index < visible.length; index++) {
    const line = visible[index];
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (
        marker &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      )
        fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }
    const heading = /^ {0,3}# ([^\n]+?)\s*$/.exec(line);
    if (!heading) continue;
    const title = heading[1].replace(/\s+#+$/, '');
    const release = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?=\s|$)/.exec(title);
    headings.push({ index, title, version: release?.[1] });
  }
  const matching = headings.filter((heading) => heading.version === version);
  if (matching.length !== 1) {
    throw new Error(
      `CHANGELOG.md requires exactly one finalized heading for ${version}; found ${matching.length}.`,
    );
  }
  const heading = matching[0];
  const dateMatch = / \((\d{4}-\d{2}-\d{2})\)$/.exec(heading.title);
  if (
    !dateMatch ||
    heading.title !== `${version} (${dateMatch[1]})` ||
    !calendarDate(dateMatch[1])
  ) {
    throw new Error(
      `CHANGELOG.md requires "# ${version} (YYYY-MM-DD)" with a real calendar date; Unreleased is not a release.`,
    );
  }
  const date = dateMatch[1];
  if (date > today)
    throw new Error(`CHANGELOG.md release date ${date} is in the future (UTC today: ${today}).`);
  const next = headings.find((entry) => entry.index > heading.index);
  const body = lines
    .slice(heading.index + 1, next?.index)
    .join('\n')
    .trim();
  if (!body.replace(/<!--[\s\S]*?(?:-->|$)/g, '').trim()) {
    throw new Error(`CHANGELOG.md has no release notes for ${version}.`);
  }
  return { version, date, body };
}
