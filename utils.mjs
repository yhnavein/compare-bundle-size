import fetch from 'node-fetch';
import prettyBytes from 'pretty-bytes';
import { readdir } from 'fs/promises';
import getFolderSize from 'get-folder-size';

const GIST_FILE_NAME = 'bundle-stats.json';

/**
 * Remove any matched hash patterns from a filename string.
 * @param {string=} regex
 * @returns {(((fileName: string) => string) | undefined)}
 */
export function stripHash(regex) {
  if (regex) {
    return function (fileName) {
      return fileName.replace(new RegExp(regex), (str, ...hashes) => {
        hashes = hashes.slice(0, -2).filter((c) => c != null);
        if (hashes.length) {
          for (const element of hashes) {
            const hash = element || '';
            str = str.replace(hash, hash.replace(/./g, '*'));
          }
          return str;
        }
        return '';
      });
    };
  }

  return undefined;
}

/**
 * Returns some dev stats about the node_modules folder.
 * @returns size in bytes and count (file/dir count in node_modules)
 * */
export async function getDevStats() {
  const DIRECTORY = './node_modules';
  const size = await getFolderSize.loose(DIRECTORY);
  const files = await readdir(DIRECTORY);

  return {
    size,
    count: files.length
  }
}

/**
 * Returns some dev stats about the node_modules folder.
 * @returns size in bytes and count (file/dir count in node_modules)
 * */
export function devStatsDiff(curr, prev) {
  const currSize = prettyBytes(curr.size);
  const fileCountDiff = curr.count - prev?.count || 0;
  const fileSizeDiff = curr.size - prev?.size || 0;

  const countDiff = prev && fileCountDiff !== 0 && `(**${fileCountDiff > 0 ? '+' : '-'}${fileCountDiff}** change) ${iconForDifference(fileCountDiff, prev.count)}`;
  const sizeDiff = prev && fileSizeDiff !== 0 && `(**${fileSizeDiff > 0 ? '+' : '-'}${prettyBytes(fileSizeDiff)}** change) ${iconForDifference(fileSizeDiff, prev.size)}`;


  return `
## node_modules stats

**Module count:** ${curr.count} ${countDiff || ''}

**Total Size:** ${currSize} ${sizeDiff || ''}
  `;
}

/**
 * @param {number} delta
 * @param {number} originalSize
 */
export function getDeltaText(delta, originalSize) {
  let deltaText = (delta > 0 ? '+' : '') + prettyBytes(delta);
  if (Math.abs(delta) === 0) {
    // only print size
  } else if (originalSize === 0) {
    deltaText += ` (new file)`;
  } else if (originalSize === -delta) {
    deltaText += ` (removed)`;
  } else {
    const percentage = Math.round((delta / originalSize) * 100);
    deltaText += ` (${percentage > 0 ? '+' : ''}${percentage}%)`;
  }
  return deltaText;
}

/**
 * @param {number} delta
 * @param {number} originalSize
 */
export function iconForDifference(delta, originalSize) {
  if (originalSize === 0) return '🆕';

  const percentage = Math.round((delta / originalSize) * 100);
  if (percentage >= 50) return '🆘';
  else if (percentage >= 20) return '🚨';
  else if (percentage >= 10) return '⚠️';
  else if (percentage >= 5) return '🔍';
  else if (percentage <= -50) return '🏆';
  else if (percentage <= -20) return '🎉';
  else if (percentage <= -10) return '👏';
  else if (percentage <= -5) return '✅';
  return '';
}

/**
 * Create a Markdown table from text rows
 * @param {string[][]} rows
 */
function markdownTable(rows) {
  if (rows.length == 0) {
    return '';
  }

  // Skip all empty columns
  while (rows.every((columns) => !columns[columns.length - 1])) {
    for (const columns of rows) {
      columns.pop();
    }
  }

  const [firstRow] = rows;
  let columnLength = firstRow.length;

  // Hide `Change` column if they are all `0 B`
  if (columnLength === 3 && rows.every((columns) => columns[2] === '0 B')) {
    columnLength -= 1;
    for (const columns of rows) {
      columns.pop();
    }
  }

  if (columnLength === 0) {
    return '';
  }

  return [
    // Header
    ['Filename', 'Size', 'Change', ''].slice(0, columnLength),
    // Align
    [':---', ':---:', ':---:', ':---:'].slice(0, columnLength),
    // Body
    ...rows,
  ]
    .map((columns) => `| ${columns.join(' | ')} |`)
    .join('\n');
}

/**
 * Create a Markdown table showing diff data
 * @param {Diff[]} files
 * @param {object} options
 * @param {boolean} [options.showTotal]
 * @param {boolean} [options.collapseUnchanged]
 * @param {boolean} [options.omitUnchanged]
 * @param {number} [options.minimumChangeThreshold]
 */
export function diffTable(
  files,
  { showTotal, collapseUnchanged, omitUnchanged, minimumChangeThreshold }
) {
  let changedRows = [];
  let unChangedRows = [];

  let totalSize = 0;
  let totalDelta = 0;
  for (const file of files) {
    const { filename, size, delta } = file;
    totalSize += size;
    totalDelta += delta;

    const originalSize = size - delta;
    const isUnchanged = Math.abs(delta) < minimumChangeThreshold;

    if (isUnchanged && omitUnchanged) continue;

    const columns = [
      `\`${filename}\``,
      prettyBytes(size),
      getDeltaText(delta, originalSize),
      iconForDifference(delta, originalSize),
    ];
    if (isUnchanged && collapseUnchanged) {
      unChangedRows.push(columns);
    } else {
      changedRows.push(columns);
    }
  }

  let out = markdownTable(changedRows);

  if (unChangedRows.length !== 0) {
    const outUnchanged = markdownTable(unChangedRows);
    out += `\n\n<details><summary>ℹ️ <strong>View Unchanged</strong></summary>\n\n${outUnchanged}\n\n</details>\n\n`;
  }

  if (showTotal) {
    const totalOriginalSize = totalSize - totalDelta;
    let totalDeltaText = getDeltaText(totalDelta, totalOriginalSize);
    let totalIcon = iconForDifference(totalDelta, totalOriginalSize);
    out = `**Total Size:** ${prettyBytes(totalSize)}\n\n${out}`;
    out = `**Size Change:** ${totalDeltaText} ${totalIcon}\n\n${out}`;
  }

  return out;
}

export async function updateGistContents(fileContents) {
  const gistId = process.env.GIST_ID;
  const ghToken = process.env.GITHUB_TOKEN;

  try {
    await fetch('https://api.github.com/gists/' + gistId, {
      body: JSON.stringify({
        files: { [GIST_FILE_NAME]: { content: JSON.stringify(fileContents, null, 2) } },
      }),
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + ghToken,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch (error) {
    console.error('updateGistContents error', error);
  }
}

export async function getGistContents() {
  const gistId = process.env.GIST_ID;
  const ghToken = process.env.GITHUB_TOKEN;

  try {
    const response = await fetch('https://api.github.com/gists/' + gistId, {
      headers: {
        Authorization: 'Bearer ' + ghToken,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch gist: ${response.statusText}`);
    }

    const gistData = await response.json();
    const gistFile = gistData.files[GIST_FILE_NAME];
    const jsonFile = gistFile ? JSON.parse(gistFile.content) : {};

    // There is a change in how the stored file is structured
    // So here we will normalize the file to make it backward compatible
    if (jsonFile.bundle) {
      return jsonFile;
    }

    return {
      bundle: jsonFile,
    }
  } catch (error) {
    console.error('getGistContents error', error);
  }
}
