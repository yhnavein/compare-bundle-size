#!/usr/bin/env node

import 'dotenv/config';
import SizePlugin from 'size-plugin-core';
import yargs from 'yargs';

import { stripHash, getGistContents, diffTable, updateGistContents } from './utils.mjs';

const excludePattern = /\/precache-manifest\./;
const trimPathPattern = '/build/output';
const gistFileName = process.env.GIST_FILE;

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
    update();
  })
  .command('compare', 'Compare your bundle against the stored summary', {}, (argv) => {
    compare();
  })
  .help()
  .argv;

async function compare() {
  const origSizes = await plugin.readFromDisk('./');
  const sizes = cleanSizes(origSizes);

  const oldSizes = await getGistContents(process.env.GIST_FILE);
  const diff = await plugin.getDiff(oldSizes, sizes);

  const markdownDiff = diffTable(diff, {
    collapseUnchanged: true, // toBool(getInput('collapse-unchanged')),
    omitUnchanged: false, // toBool(getInput('omit-unchanged')),
    showTotal: true, // toBool(getInput('show-total')),
    minimumChangeThreshold: 10 //parseInt(getInput('minimum-change-threshold'), 10)
  });

  console.log(markdownDiff);
}

async function update() {
  const origSizes = await plugin.readFromDisk('./');
  const sizes = cleanSizes(origSizes);

  await updateGistContents(sizes, gistFileName);
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