import { runKnowledgeCli } from './cli';

void main();

async function main(): Promise<void> {
  const result = await runKnowledgeCli(process.argv.slice(2));

  if (result.stdout) {
    process.stdout.write(`${result.stdout}\n`);
  }
  if (result.stderr) {
    process.stderr.write(`${result.stderr}\n`);
  }

  process.exitCode = result.exitCode;
}
