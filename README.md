# compare-bundle-size

> Utility that helps you understand how your bundle is changing between PRs. It's a great tool to report how your bundle size will be affected by the PR.

## Compare with other tools

Tools like `compressed-size-action` are a great to show differences in your bundle size. But they tend to be lazy in how they achieve that.

The common practice is to build your application twice and then compare those two builds. And this is a time and resource waste. Especially when you are paying for CI minutes.

This tool is slightly different. It will store bundle summary as a [Gist](https://gist.github.com/) file and then on your CI on PR runs we can compare new branch builds with the stored one.

## Install

```sh
npm i -g @yhnavein/compare-bundle-size
```

You will need to have Github Account and you will need to create a Personal Access Token.

## Usage

This tool has basic two modes it works in:
- `update` - use it to update the stored bundle size. You should run it from `master`.
- `compare` - use it to compare the current bundle size with the stored one. It will generate a nice table showing the differences.

```sh
compare-bundle-size --help
```
