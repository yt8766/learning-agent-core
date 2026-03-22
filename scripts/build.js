import fs from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);

async function cleanPackage(target) {
  const filename = path.resolve(`packages/${target}`);
  await rm(`${filename}/build`, { recursive: true, force: true });
  await rm(`${filename}/dist`, { recursive: true, force: true });
}

async function main() {
  let packages = fs.readdirSync(path.resolve('packages'));
  if (args[1]) {
    packages = packages.filter(item => item === args[1]);
  }

  await Promise.all(packages.map(target => cleanPackage(target)));
}

main();
