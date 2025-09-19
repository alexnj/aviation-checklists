
// Polyfill for window.crypto and window.crypto.subtle for Node.js
import { randomBytes, createCipheriv, createDecipheriv, webcrypto } from 'crypto';

type KeyUsage = "encrypt" | "decrypt" | "sign" | "verify" | "deriveKey" | "deriveBits" | "wrapKey" | "unwrapKey";

if (typeof global.window === 'undefined') {
  (global as any).window = {
    crypto: {
      getRandomValues: (arr: Uint8Array) => randomBytes(arr.length),
      subtle: {
        importKey: async (format: any, keyData: BufferSource, algorithm: any, extractable: boolean, keyUsages: KeyUsage[]): Promise<webcrypto.CryptoKey> => {
          if (format === 'raw' || format === 'pkcs8' || format === 'spki') {
            return webcrypto.subtle.importKey(format, keyData, algorithm, extractable, keyUsages as any);
          }
          return webcrypto.subtle.importKey(format, keyData as any, algorithm, extractable, keyUsages as any);
        },
        encrypt: async (algorithm: any, key: webcrypto.CryptoKey, data: BufferSource): Promise<ArrayBuffer> => {
          return webcrypto.subtle.encrypt(algorithm, key, data);
        },
        decrypt: async (algorithm: any, key: webcrypto.CryptoKey, data: BufferSource): Promise<ArrayBuffer> => {
          return webcrypto.subtle.decrypt(algorithm, key, data);
        }
      }
    },
  };
}
// End polyfill

import { JsonFormat } from '../efis-editor/src/model/formats/json-format';
import { ForeFlightWriter } from '../efis-editor/src/model/formats/foreflight-writer';
import { FormatId } from '../efis-editor/src/model/formats/format-id';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const inputFile = process.argv[2];
  const outputDir = process.argv[3];

  if (!inputFile || !outputDir) {
    console.error('Usage: node convert.js <input.json> <output-dir>');
    process.exit(1);
  }

  try {
    const parsedInputPath = path.parse(inputFile);
    const inputContent = fs.readFileSync(inputFile, 'utf-8');
    const inputFileObject = new File([inputContent], parsedInputPath.base);
    const outputFile = path.join(outputDir, parsedInputPath.name + ".fmd");

    const jsonFormat = new JsonFormat(FormatId.JSON, 'Raw data');
    const checklistFile = await jsonFormat.toProto(inputFileObject);

    const payload = await ForeFlightWriter.write(checklistFile);
    const buffer = Buffer.from(await payload.arrayBuffer());
    fs.writeFileSync(outputFile, buffer);

    console.log(`Successfully converted ${inputFile} to ${outputFile}`);
  } catch (error) {
    console.error('An error occurred during conversion:', error);
    process.exit(1);
  }
}

main();
