/**
 * Stub CJS pour file-type (package ESM-only, incompatible avec Jest CommonJS)
 * Le vrai mock est fourni par jest.mock('file-type', ...) dans chaque test.
 */
module.exports = {
    fileTypeFromBuffer: () => Promise.resolve(undefined),
    fileTypeFromStream: () => Promise.resolve(undefined),
}
