import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function pathExists(path) {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    const repoRoot = process.cwd();
    const srcDir = join(repoRoot, 'resources');
    const destDir = join(repoRoot, 'dist', 'resources');

    if (!(await pathExists(srcDir))) {
        // Nothing to copy.
        return;
    }

    await mkdir(join(repoRoot, 'dist'), { recursive: true });
    await rm(destDir, { recursive: true, force: true });
    await cp(srcDir, destDir, { recursive: true });
}

await main();
