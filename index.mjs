#!/usr/bin/env node

import 'dotenv/config';
import SizePlugin from 'size-plugin-core';
import yargs from 'yargs';

import { stripHash, getGistContents, diffTable, updateGistContents, getDevStats, devStatsDiff } from './utils.mjs';

const excludePattern = /\/precache-manifest\./;
const trimPathPattern = '/build/output';

const plugin = new SizePlugin({
  compression: 'gzip', // gzip/brotli/none
  pattern: './build/**/*.{js,css,html}',
  exclude: '{**/*.map,**/node_modules/**}',
  stripHash: stripHash('\\.(\\w{8})\\.js$'),
});

const args = yargs(process.argv.slice(2))
  .scriptName('compare-bundle-size')
  .usage('$0 <cmd> [args]')
  .command('update', 'Update stored summary of the bundle (master)', {}, (argv) => {
    update(argv);
  })
  .command('compare', 'Compare your bundle against the stored summary', {}, (argv) => {
    compare(argv);
  })
  .option('devStats', {
    alias: 'd',
    default: false,
    type: 'boolean',
    description: 'Collects stats about the node_modules folder'
  })
  .option('threshold', {
    alias: 't',
    default: 10,
    type: 'number',
    description: 'Minimum size difference (in bytes) to be visible'
  })
  .help()
  .argv;

/**
 * This function loads the current bundle size and compares it to the previous
 * bundle size stored in the Gist. It then prints a markdown table with the differences
 * that can be used in the PR comment.
 */
async function compare({ devStats, threshold }) {
  const origSizes = await plugin.readFromDisk('./');
  const sizes = cleanSizes(origSizes);

  const prev = await getGistContents();
  const diff = await plugin.getDiff(prev.bundle ?? {}, sizes);

  const markdownDiff = diffTable(diff, {
    collapseUnchanged: true, // toBool(getInput('collapse-unchanged')),
    omitUnchanged: false, // toBool(getInput('omit-unchanged')),
    showTotal: true, // toBool(getInput('show-total')),
    minimumChangeThreshold: threshold
  });

  console.log(markdownDiff);

  if (devStats) {
    const curStats = await getDevStats();
    const statsDiff = devStatsDiff(curStats, prev.devStats);
    console.log(statsDiff);
  }
}

/**
 * This function loads the current bundle size and then stores it in the Gist
 */
async function update({ devStats }) {
  const origSizes = await plugin.readFromDisk('./');
  const sizes = cleanSizes(origSizes);
  const gistFile = {
    bundle: sizes,
  };

  if (devStats) {
    gistFile.devStats = await getDevStats();
  }

  await updateGistContents(gistFile);
}

function cleanSizes(sizes) {
  const newSizes = {};

  Object.keys(sizes)
    // Let's remove properties from the object that we don't need
    .filter((size) => !excludePattern.test(size))

    // Let's apply trimPathPattern so that paths are shorter
    .forEach((size) => {
      const key = size.replace(trimPathPattern, '');
      newSizes[key] = sizes[size];
    });

  return newSizes;
}
