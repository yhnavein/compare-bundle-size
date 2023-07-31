#!/usr/bin/env node

import 'dotenv/config';
import SizePlugin from 'size-plugin-core';
import { Octokit, App } from 'octokit';
import { stripHash, getGistContents } from './utils.mjs';

const excludePattern = /\/precache-manifest\./;

const plugin = new SizePlugin({
  compression: 'gzip', // gzip/brotli/none
  pattern: './build/**/*.{js,css,html}',
  exclude: '{**/*.map,**/node_modules/**}',
  stripHash: stripHash('\\.(\\w{8})\\.js$'),
});

run();

async function run() {
  console.log('CWD', process.cwd(), process.env);
  const sizes = await plugin.readFromDisk('./');

  // Let's remove properties from the object that we don't need
  Object.keys(sizes)
    .filter((size) => excludePattern.test(size))
    .forEach((key) => {
      delete sizes[key];
    });

  const oldSizes = await getGistContents(process.env.GIST_FILE);

  console.log(sizes);

  const diff = await plugin.getDiff(oldSizes, sizes);
  console.log('DIFF', diff);

  const cliText = await plugin.printSizes(diff);
  console.log(cliText);
}
