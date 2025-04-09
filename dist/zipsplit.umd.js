var zipsplit = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/zipsplit.ts
  var zipsplit_exports = {};
  __export(zipsplit_exports, {
    getAllFiles: () => getAllFiles,
    iterateFiles: () => iterateFiles
  });
  var someMaxUint32 = (...arg) => arg.some((x) => x === 4294967295);
  var readFileSlice = async (file, start, length) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    [reader.onload, reader.onerror] = [() => resolve(
      new Uint8Array(reader.result)
    ), () => reject(reader.error)];
    reader.readAsArrayBuffer(file.slice(start, start + length));
  });
  var view = (bytes, size, offset = 0) => Number(
    bytes.slice(offset, offset + size).reduce(
      (a, b, i) => a + (BigInt(b) << BigInt(8 * i)),
      BigInt(0)
    )
  );
  var iterateFiles = async function* enumerateZipEntries(file) {
    const eocdSize = 42;
    const eocd = await readFileSlice(file, file.size - eocdSize, eocdSize);
    let centralDir = [36, 32].map((x) => view(eocd, 4, x));
    if (view(eocd, 4, 20) !== 101010256) {
      throw new Error("cannot locate end of central directory signature");
    }
    if (someMaxUint32(...centralDir) && view(eocd, 4) === 117853008) {
      const eocd64 = await readFileSlice(file, view(eocd, 8, 8), 56);
      if (view(eocd64, 4) === 101075792) {
        centralDir = [48, 40].map((x) => view(eocd64, 8, x));
      }
    }
    const cd = await readFileSlice(file, ...centralDir);
    const commentBegin = 46;
    for (let ptr = 0, lengths; ptr + commentBegin <= cd.length; ptr += commentBegin + lengths.reduce((a, b) => a + b, 0)) {
      if (view(cd, 4, ptr) !== 33639248) {
        throw new Error("invalid central directory header signature");
      }
      const tmp = [24, 20, 42].map((x) => view(cd, 4, ptr + x));
      lengths = [28, 30, 32].map((x) => view(cd, 2, ptr + x));
      const comment = [0, lengths[0]].map((x) => x + ptr + commentBegin);
      if (someMaxUint32(...tmp)) {
        const end = comment[1] + lengths[1] - 4;
        for (let pos = comment[1], id, size; pos < end; pos += size + 4) {
          [id, size] = [0, 2].map((x) => view(cd, 2, pos + x));
          if (id === 1) {
            for (let i = 0, offsetInBlock = 4; i < tmp.length; i++) {
              if (someMaxUint32(tmp[i])) {
                tmp[i] = view(cd, 8, pos + offsetInBlock);
                offsetInBlock += 8;
              }
            }
            break;
          }
        }
      }
      if (view(cd, 2, ptr + 10) != 0 || tmp[0] != tmp[1]) {
        throw new Error("only uncompressed files supported");
      }
      const lfh = await readFileSlice(file, tmp[2], tmp[2] + 30);
      if (view(lfh, 4) != 67324752) {
        throw new Error("invalid local file header signature");
      }
      yield new File(
        [((x) => file.slice(x, x + tmp[0]))([26, 28].map(
          (x) => view(lfh, 2, x)
        ).reduce((a, b) => a + b, 30 + tmp[2]))],
        new TextDecoder("utf-8").decode(cd.slice(...comment))
      );
    }
  };
  var getAllFiles = async (file) => {
    const results = [];
    for await (const item of iterateFiles(file)) results.push(item);
    return results;
  };
  return __toCommonJS(zipsplit_exports);
})();
//# sourceMappingURL=zipsplit.umd.js.map
