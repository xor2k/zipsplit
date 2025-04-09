import { deepStrictEqual } from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { getAllFiles } from '../zipsplit';

const FileReader = class MockFileReader {
    onload: any;
    result: ArrayBufferLike | string | null = null;

    async readAsText(file: File) {
        this.result = (await file.text());
        this.onload();
    }

    async readAsArrayBuffer(file: File) {
        this.result = (await file.bytes()).buffer;
        this.onload();
    }
} as any;

global.FileReader = FileReader;

const testdir = 'src/__tests__/';
const datadirName = 'data';
const datadir = `${testdir}/${datadirName}`;

const dataFiles = await Promise.all(await Promise.all((
    await readdir(datadir)).map(async x => [
        `${datadirName}/${x}`, (await readFile(`${datadir}/${x}`)).toString()
    ]
)));

for(const zipfile of await Promise.all((await Promise.all(
    ['zip', 'zip64'].map(x => `${testdir}/${x}.zip`).map(
        async x => await getAllFiles(new File([await readFile(x)], x)
    ))
)))) {
    deepStrictEqual(
        dataFiles,
        await Promise.all(zipfile.map(async x => [x.name, await x.text()]))
    );
};