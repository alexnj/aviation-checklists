
import { JsonFormat } from '../efis-editor/src/model/formats/json-format';
import { AceWriter } from '../efis-editor/src/model/formats/ace-writer';
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
    const writer = new AceWriter();
    const parsedInputPath = path.parse(inputFile);
    const inputContent = fs.readFileSync(inputFile, 'utf-8');
    const inputFileObject = new File([inputContent], parsedInputPath.base);
    const outputFile = path.join(outputDir, parsedInputPath.name + ".ace");

    const jsonFormat = new JsonFormat(FormatId.JSON, 'Raw data');
    const checklistFile = await jsonFormat.toProto(inputFileObject);
    const payload = await writer.write(checklistFile);

    const buffer = Buffer.from(await payload.arrayBuffer());
    fs.writeFileSync(outputFile, buffer);

    console.log(`Successfully converted ${inputFile} to ${outputFile}`);
  } catch (error) {
    console.error('An error occurred during conversion:', error);
    process.exit(1);
  }
}

main();
