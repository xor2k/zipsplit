import { build } from 'esbuild';

const runBuilds = async () => {
    const commonArgs = {
        entryPoints: ['src/zipsplit.ts'],
        bundle: true,
        target: 'esnext',
        sourcemap: true,
        platform: 'browser'
    } satisfies Parameters<typeof build>[0];

    await build({
        ... commonArgs,
        outfile: 'dist/zipsplit.js',
        format: 'esm',
    });

    await build({
        ... commonArgs,
        outfile: 'dist/zipsplit.umd.js',
        format: 'iife',
        globalName: 'zipsplit',
    });

    console.log('Builds complete!');
}

runBuilds().catch((err) => {
    console.error(err);
    // process.exit(1);
});