const someMaxUint32 = (...arg: number[]) => arg.some(x => x === 0xffffffff);

const readFileSlice = async (file: File, start: number, length: number) => 
    new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        [reader.onload, reader.onerror] = [() => resolve(
            new Uint8Array(reader.result as ArrayBuffer)
        ), () => reject(reader.error)];
        reader.readAsArrayBuffer(file.slice(start, start + length));
    });

const view = (bytes: Uint8Array, size: number, offset = 0) => Number(
    bytes.slice(offset, offset + size).reduce(
        (a, b, i) => a + (BigInt(b) << BigInt(8*i)), BigInt(0)
    )
);

export const iterateFiles = async function* enumerateZipEntries(file: File) {
    const eocdSize = 42;
    const eocd = await readFileSlice(file, file.size - eocdSize, eocdSize);
    // [centralDirOffset, centralDirSize]
    let centralDir = [36, 32].map(x => view(eocd, 4, x));

    if (view(eocd, 4, 20) !== 0x06054b50) { // EOCD_SIG
        throw new Error("cannot locate end of central directory signature");
    }

    // 0x07064b50: ZIP64_LOCATOR_SIG
    if (someMaxUint32(...centralDir) && view(eocd, 4) === 0x07064b50) {
        const eocd64 = await readFileSlice(file, view(eocd, 8, 8), 56);
        if (view(eocd64, 4) === 0x06064b50) { // ZIP64_EOCD_SIG
            centralDir = [48, 40].map(x => view(eocd64, 8, x));
        }
    }

    const cd = await readFileSlice(file, ...centralDir as [number, number]);

    const commentBegin = 46;
    for (
        let ptr = 0, lengths; ptr + commentBegin <= cd.length;
        ptr += commentBegin + lengths.reduce((a, b) => a + b, 0)
    ) {
        if (view(cd, 4, ptr) !== 0x02014b50) {
            throw new Error("invalid central directory header signature");
        }

        // [uncompressedSize, compressedSize, localHeaderOffset]
        const tmp = [24, 20, 42].map(x => view(cd, 4, ptr + x));

        // [fileNameLength, extraFieldLength, fileCommentLength]
        lengths = [28, 30, 32].map(x => view(cd, 2, ptr + x));
        const comment = [0, lengths[0]].map(x => x + ptr + commentBegin);

        if (someMaxUint32(...tmp)) { // zip64
            const end = comment[1] + lengths[1] - 4;

            for (let pos = comment[1], id, size; pos < end; pos += size + 4) {
                [id, size] = [0, 2].map(x => view(cd, 2, pos + x));

                if (id === 0x0001) {
                    for (let i = 0, offsetInBlock = 4; i < tmp.length; i++) {
                        if (someMaxUint32(tmp[i])){ // yes, it's tmp[i]
                            tmp[i] = view(cd, 8, pos + offsetInBlock);
                            offsetInBlock += 8;
                        }
                    }
                    break;
                }
            }
        }

        // compression method
        if (view(cd, 2, ptr + 10) != 0 || tmp[0] != tmp[1]) {
            throw new Error("only uncompressed files supported");
        }

        const lfh = await readFileSlice(file, tmp[2], tmp[2] + 30);

        if(view(lfh, 4) != 0x04034b50) {
            throw new Error('invalid local file header signature')
        }

        yield new File(
            [(x => file.slice(x, x + tmp[0]))([26, 28].map(
                x => view(lfh, 2, x)).reduce((a, b) => a + b, 30 + tmp[2]))],
            new TextDecoder("utf-8").decode(cd.slice(...comment))
        );
    }
}

export const getAllFiles = async (file: File) => {
    const results: File[] = [];
    for await (const item of iterateFiles(file)) results.push(item);
    return results;
}