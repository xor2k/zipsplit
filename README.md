# zipsplit
zipsplit splits an uncompressed zip (as a `File` object) into multiple `File`
objects in the browser.

## Installation
```
npm install zipsplit
```
## Usage
Also see `demo.html`
```TypeScript
const readFile = async (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    [reader.onload, reader.onerror] = [
        () => resolve(reader.result), () => reject(reader.error)
    ];
    // alternatively, for binary files:
    // reader.readAsArrayBuffer(file);
    reader.readAsText(file);
});

const input = document.body.appendChild(document.createElement('input'));
input.type = 'file';
input.onchange = async () => {
    // partial file read example, e.g. for files can be larger than RAM
    const sampleSize = 8;
    // alternatively, if the zip contains a huge number of files:
    // for await (const file of zipsplit.iterateFiles(input.files[0])) {
    for(const file of await zipsplit.getAllFiles(input.files[0])) {
        console.log(file.name, await readFile(file.slice(0, sampleSize)) + (
            file.size > sampleSize ? '...' : ''
        ));
    };
}
```

## Features and Design Principles
* Support for processing files potentially larger than RAM (zip64)
* Support for zip files that contain a huge number of files
* Simple code, only minimal zip feature support
* Minimal dependencies
* Latest TypeScript/JavaScript standard and features
* Backwards compatible via UMD module
* Tests run in Node.js

## How to create uncompressed zip files?
On Linux and MacOS, this can be done with
```
zip -0 archive.zip file1 file2 file3 ...
```
On Windows, you can use [7zip](https://www.7-zip.org) and specify compression
level "store". Alternatively, it also works in the command line
```
7za a -m0=Copy archive.7z file1 file2 file3 ...
```

## Background
Web apps are becoming more and more complex, reaching and sometimes surpassing
the complexity of traditional desktop apps. Also, existing codebases in C/C++
can be reused in the web via [Emscripten](https://emscripten.org) as
WebAssembly, e.g. [ffmpeg](https://www.ffmpeg.org). To do that however, web
worker are highly recommendable as they are the only way to do synchronous
file reads on user provided `File` objects, also see
[workerfs](https://emscripten.org/docs/api_reference/Filesystem-API.html#filesystem-api-workerfs).
In the main application (outside of a web worker), only asynchronous reads are
possible.

For large, data intense or low-latency applications, provided by a portable
single page HTML app or something hosted in the cloud, it might make sense to
store data on the user's filesystem. This data can be provided to the user in
the form of e.g. a zip by using a "file upload" button. An acutal upload does
not need to take place, but the browser will get read access through the
mentioned `File` object once the user provided a file. However, to access
individual files from that zip, so far it was necessary to either let the user
unpack the zip into a directory and open that directory through the "file
upload" button or unpack the data in the RAM that can be accessed by the
browser. Former option is a storage inconvenience for the user as the required
disk space, at least during extraction, can up to double (for uncompressed zip
files). This also increases the risk of failure, e.g. from an incomplete
extraction, because the user can run out of free space. The latter option,
extracting the zip into the RAM accessible by the browser severely limits the
maximal size of the data. Also, since the entire zip needs to be read on
application start, this can be time-intense and creates another inconvenience
for the user.

In JavaScript, `File.slice` significantly differs from how the much more
commonly known `Array.slice` works: instead of reading the entire file and
then providing a copy of the sliced region, nothing is being read from disk
until a `FileReader` is used to do the actual read and then it reads only the
sliced region from the file. This allows to handle giant files in the browser,
even when larger then the main memory of the machine.

zipsplit also does not read the entire file, but only the so-called central
directory, i.e. the list of files contained in the zip file with their offsets
and lengths and uses those to construct an array of `File` objects as slices
of the original zip. This of course only works if the files contained in the
zip are literal and thus uncompressed. For certain types of data, e.g. images
in PNG or JPEG format or videos in H264, the additional space savings through
zip compression would be low anyway. If space-reduction through zipping is
relevant, consider putting compressed zip files into the outer, uncompressed
zip along the other contents and unzip them with a fully-fleged zip library
like [jszip](https://github.com/Stuk/jszip) on the fly.