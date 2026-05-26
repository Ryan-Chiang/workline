#!/usr/bin/env node

// 本地开发直接跑源码；npm 安装后在 node_modules 中必须跑编译产物。
const cliModule = import.meta.url.includes('/node_modules/') ? '../dist/cli.js' : '../src/cli.ts';

import(cliModule)
  .then(({ main }) => main(process.argv.slice(2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
