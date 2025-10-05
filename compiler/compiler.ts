import * as fs from 'fs';
import * as path from 'path';
import { JsonFormat } from '../efis-editor/src/model/formats/json-format';
import { FormatId } from '../efis-editor/src/model/formats/format-id';
import {
  FORMAT_REGISTRY,
  serializeChecklistFile,
} from '../efis-editor/src/model/formats/format-registry';

// Polyfill for window.crypto and window.crypto.subtle for Node.js
import { randomBytes, webcrypto } from 'crypto';

type KeyUsage =
  | 'encrypt'
  | 'decrypt'
  | 'sign'
  | 'verify'
  | 'deriveKey'
  | 'deriveBits'
  | 'wrapKey'
  | 'unwrapKey';

if (typeof global.window === 'undefined') {
  (global as any).window = {
    crypto: {
      getRandomValues: (arr: Uint8Array) => randomBytes(arr.length),
      subtle: {
        importKey: async (
          format: any,
          keyData: BufferSource,
          algorithm: any,
          extractable: boolean,
          keyUsages: KeyUsage[]
        ): Promise<webcrypto.CryptoKey> => {
          if (format === 'raw' || format === 'pkcs8' || format === 'spki') {
            return webcrypto.subtle.importKey(
              format,
              keyData,
              algorithm,
              extractable,
              keyUsages as any
            );
          }
          return webcrypto.subtle.importKey(
            format,
            keyData as any,
            algorithm,
            extractable,
            keyUsages as any
          );
        },
        encrypt: async (
          algorithm: any,
          key: webcrypto.CryptoKey,
          data: BufferSource
        ): Promise<ArrayBuffer> => {
          return webcrypto.subtle.encrypt(algorithm, key, data);
        },
        decrypt: async (
          algorithm: any,
          key: webcrypto.CryptoKey,
          data: BufferSource
        ): Promise<ArrayBuffer> => {
          return webcrypto.subtle.decrypt(algorithm, key, data);
        },
      },
    },
  };
}
// End polyfill

async function convertFile(inputFile: string, outputDir: string) {
  try {
    console.log(`Converting ${inputFile}`);
    const parsedInputPath = path.parse(inputFile);
    const inputContent = fs.readFileSync(inputFile, 'utf-8');
    const inputFileObject = new File([inputContent], parsedInputPath.base);
    const jsonFormat = new JsonFormat(FormatId.JSON, 'Raw data');
    const checklistFile = await jsonFormat.toProto(inputFileObject);
    const cols = ['|'];

    for (const {
      id,
      name,
      extension,
    } of FORMAT_REGISTRY.getSupportedOutputFormats()) {
      if (['pdf', 'json'].includes(id)) {
        console.log(`Skipping ${id} format.`);
        continue;
      }
      const outputFile = path.join(
        outputDir,
        parsedInputPath.name +
          `.${id}` +
          ('.' + id.toString() === extension ? '' : extension)
      );
      const writtenFile = await serializeChecklistFile(checklistFile, id);
      console.log(`Saving ${name} as ${outputFile}`);
      fs.writeFileSync(
        outputFile,
        Buffer.from(await writtenFile.arrayBuffer())
      );
      cols.push(`[${id}](${outputFile}) |`);
    }
  } catch (error) {
    console.error(
      `An error occurred during conversion of ${inputFile}:`,
      error
    );
  }
}

function findJsonFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const fileStat = fs.lstatSync(filePath);
    if (fileStat.isDirectory()) {
      findJsonFiles(filePath, fileList);
    } else if (path.extname(file) === '.json') {
      fileList.push(filePath);
    }
  });
  return fileList;
}

async function main() {
  const checklistsDir = 'checklists';
  const outputRootDir = 'output';

  const jsonFiles = findJsonFiles(checklistsDir);
  for (const inputFile of jsonFiles) {
    const dirname = path.dirname(inputFile);
    const outputDir = path.join(outputRootDir, dirname);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    await convertFile(inputFile, outputDir);
  }
}

main();
