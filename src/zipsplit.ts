const someMaxUint32 = (...arg: number[]) => arg.some(x => x === 0xffffffff);

const readFileSlice = async (file: File, start: number, length: number) =>
    new Promise<DataView>((resolve, reject) => {
        const reader = new FileReader();
        [reader.onload, reader.onerror] = [() => resolve(
            new DataView(reader.result as ArrayBuffer)
        ), () => reject(reader.error)];
        reader.readAsArrayBuffer(file.slice(start, start + length));
    });

const readFileSliceSigned = async (
    file: File, start: number, length: number, signature: number, err: string
) => {
    const dv = await readFileSlice(file, start, length);
    if(view(dv, 4) !== signature) throw new Error('invalid ' + err);
    return dv;
};

const view = (dataView: DataView, size: 2 | 4 | 8, offset = 0) => Number(
    size == 2 ? dataView.getUint16(offset, true) :
    size == 4 ? dataView.getUint32(offset, true) :
    dataView.getBigUint64(offset, true)
)

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export const iterateFiles = async function* (file: File) {
    const eocdSize = 22;
    const filesize = file.size;

    if (filesize < eocdSize) throw new Error('invalid zip file');

    await readFileSliceSigned(file, 0, 4, 0x04034B50, 'zip file magic');

    const eocd = await readFileSliceSigned(
        file, filesize - eocdSize, eocdSize, 0x06054b50, 'EOCD signature'
    );

    let cdOffsetSize = [16, 12].map(x => view(eocd, 4, x));

    if (someMaxUint32(...cdOffsetSize)) {
        const zip64LocatorSize = 20;

        const zip64EOCDHeaderBuffer = await readFileSliceSigned(
            file, view(await readFileSliceSigned(
                file, filesize - eocdSize - zip64LocatorSize,
                zip64LocatorSize, 0x07064b50, 'zip64 locator signature'
            ), 8, 8), 56, 0x06064b50, 'zip64 eocd signature'
        );

        cdOffsetSize = [48, 40].map(x => view(zip64EOCDHeaderBuffer, 8, x));
    }

    const cd = await readFileSlice(file, ...cdOffsetSize as [number, number]);

    const commentBegin = 46;
    for (
        let ptr = 0, lengths; ptr + commentBegin <= cd.byteLength;
        ptr += commentBegin + sum(lengths)
    ) {
        if (view(cd, 4, ptr) !== 0x02014b50) throw new Error(
            'invalid central directory file header signature'
        );

        // [uncompressedSize, compressedSize, localHeaderOffset]
        const tmp = [24, 20, 42].map(x => view(cd, 4, ptr + x));

        // [filenameLength, extraFieldLength, fileCommentLength]
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
        if(view(cd, 2, ptr + 10) !== 0 || tmp[0] != tmp[1]) throw new Error(
            `archive contains compressed file, only uncompressed supported`
        );

        const localHeader = await readFileSliceSigned(
            file, tmp[2], 30, 0x04034b50, 'local file header signature'
        );

        yield new File(
            [(localLengthsSum => file.slice(...[0, tmp[0]].map(
                x => x + tmp[2] + 30 + localLengthsSum
            )))(sum([26, 28].map(x => view(localHeader, 2, x))))],
            new TextDecoder("utf-8").decode(cd.buffer.slice(...comment))
        );
    }
}

export const getAllFiles = async (file: File) => {
    const results: File[] = [];
    for await (const item of iterateFiles(file)) results.push(item);
    return results;
}