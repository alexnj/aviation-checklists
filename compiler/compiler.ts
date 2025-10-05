import * as fs from 'fs';
import * as path from 'path';
import { JsonFormat } from '../efis-editor/src/model/formats/json-format';
import { FormatId } from '../efis-editor/src/model/formats/format-id';
import {
  FORMAT_REGISTRY,
  serializeChecklistFile,
} from '../efis-editor/src/model/formats/format-registry';
import PDFDocument from 'pdfkit';
const RELEASE_URL_PREFIX = '../../releases/download/latest/';

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

async function generatePdf(
  checklist: any,
  outputPath: string
): Promise<void> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      layout: 'landscape',
      margins: { top: 30, bottom: 30, left: 30, right: 30 },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Header
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(checklist.metadata.makeAndModel, { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(checklist.metadata.name, { align: 'center' });
    doc.moveDown(2);

    // Column layout
    const numColumns = 3;
    const gutterWidth = 20;
    const pageContentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth =
      (pageContentWidth - gutterWidth * (numColumns - 1)) / numColumns;

    let currentColumn = 0;
    const startY = doc.y;
    let y = startY;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    let pageNumber = 1;

    const getColumnX = (col: number) =>
      doc.page.margins.left + col * (columnWidth + gutterWidth);

    const moveToNextColumn = () => {
      currentColumn++;
      if (currentColumn >= numColumns) {
        doc.addPage();
        pageNumber++;
        currentColumn = 0;
        y = doc.page.margins.top;
      } else {
        y = pageNumber === 1 ? startY : doc.page.margins.top;
      }
    };

    const checkSpace = (height: number) => {
      if (y + height > pageBottom) {
        moveToNextColumn();
      }
    };

    for (const group of checklist.groups) {
      const groupTitle = group.title.toUpperCase();
      doc.font('Helvetica-Bold').fontSize(10);
      const groupTitleHeight = doc.heightOfString(groupTitle, {
        width: columnWidth,
        underline: true,
      });
      checkSpace(groupTitleHeight + 5);
      doc.text(groupTitle, getColumnX(currentColumn), y, {
        width: columnWidth,
        underline: true,
      });
      y += groupTitleHeight + 5;

      for (const checklistInGroup of group.checklists) {
        if (checklistInGroup.title) {
          const checklistTitle = checklistInGroup.title.toUpperCase();
          doc.font('Helvetica-Bold').fontSize(9);
          const checklistTitleHeight = doc.heightOfString(checklistTitle, {
            width: columnWidth,
            align: 'center',
          });
          checkSpace(checklistTitleHeight + 5);
          doc.text(checklistTitle, getColumnX(currentColumn), y, {
            width: columnWidth,
            align: 'center',
          });
          y += checklistTitleHeight + 5;
        }

        for (const item of checklistInGroup.items) {
          const indent = (item.indent || 0) * 10;
          const itemX = getColumnX(currentColumn) + indent;
          const itemWidth = columnWidth - indent;

          let itemHeight = 0;

          // Estimate height
          doc.fontSize(8);
          switch (item.type) {
            case 'ITEM_TITLE':
              doc.font('Helvetica-Bold');
              itemHeight = doc.heightOfString(item.prompt, { width: itemWidth });
              break;
            case 'ITEM_CHALLENGE_RESPONSE':
              const challengeWidth = itemWidth * 0.7;
              const responseWidth = itemWidth * 0.3;
              doc.font('Helvetica');
              const challengeHeight = doc.heightOfString(item.prompt, {
                width: challengeWidth,
              });
              doc.font('Helvetica'); // Not bold
              const responseHeight = doc.heightOfString(item.expectation, {
                width: responseWidth,
              });
              itemHeight = Math.max(challengeHeight, responseHeight);
              break;
            case 'ITEM_PLAINTEXT':
              doc.font('Helvetica');
              itemHeight = doc.heightOfString(item.prompt, { width: itemWidth });
              break;
            case 'ITEM_WARNING':
              doc.font('Helvetica-Oblique');
              itemHeight = doc.heightOfString(`WARNING: ${item.prompt}`, {
                width: itemWidth,
              });
              break;
            case 'ITEM_NOTE':
              doc.font('Helvetica-Oblique');
              itemHeight = doc.heightOfString(`NOTE: ${item.prompt}`, {
                width: itemWidth,
              });
              break;
            case 'ITEM_SPACE':
              itemHeight = 4;
              break;
          }

          checkSpace(itemHeight);

          // Render item
          doc.fontSize(8);
          switch (item.type) {
            case 'ITEM_TITLE':
              doc
                .font('Helvetica-Bold')
                .text(item.prompt, itemX, y, { width: itemWidth });
              y += itemHeight + 2;
              break;
            case 'ITEM_CHALLENGE_RESPONSE':
              const challengeWidth = itemWidth * 0.7;
              const responseWidth = itemWidth * 0.3;
              const responseX = itemX + challengeWidth;

              doc
                .font('Helvetica')
                .text(item.prompt, itemX, y, { width: challengeWidth });

              doc
                .font('Helvetica') // Not bold
                .text(item.expectation, responseX, y, {
                  width: responseWidth,
                  align: 'right',
                });

              y += itemHeight + 2;
              break;
            case 'ITEM_PLAINTEXT':
              doc
                .font('Helvetica')
                .text(item.prompt, itemX, y, { width: itemWidth });
              y += itemHeight + 2;
              break;
            case 'ITEM_WARNING':
              doc
                .font('Helvetica-Oblique')
                .fillColor('red')
                .text(`WARNING: ${item.prompt}`, itemX, y, {
                  width: itemWidth,
                });
              doc.fillColor('black');
              y += itemHeight + 2;
              break;
            case 'ITEM_NOTE':
              doc
                .font('Helvetica-Oblique')
                .text(`NOTE: ${item.prompt}`, itemX, y, { width: itemWidth });
              y += itemHeight + 2;
              break;
            case 'ITEM_SPACE':
              y += 4;
              break;
          }
        }
        y += 8; // space after checklist
      }
    }

    doc.end();
    stream.on('finish', () => resolve());
  });
}

async function convertFile(
  inputFile: string,
  outputDir: string
): Promise<Record<string, string>> {
  try {
    console.log(`Converting ${inputFile}`);
    const parsedInputPath = path.parse(inputFile);
    const inputContent = fs.readFileSync(inputFile, 'utf-8');
    const inputFileObject = new File([inputContent], parsedInputPath.base);
    const jsonFormat = new JsonFormat(FormatId.JSON, 'Raw data');
    const checklistFile = await jsonFormat.toProto(inputFileObject);
    const links: Record<string, string> = {};

    const checklistJson = JSON.parse(inputContent);
    const pdfOutputFileName = parsedInputPath.name + '.pdf';
    const pdfOutputFile = path.join(outputDir, pdfOutputFileName);
    await generatePdf(checklistJson, pdfOutputFile);
    console.log(`Saving PDF as ${pdfOutputFile}`);
    const pdfDownloadUrl =
      RELEASE_URL_PREFIX + pdfOutputFile.split('/').slice(2).join('.');
    links['pdf'] = `[pdf](${pdfDownloadUrl})`;

    for (const {
      id,
      name,
      extension,
    } of FORMAT_REGISTRY.getSupportedOutputFormats()) {
      if (['pdf', 'json'].includes(id)) {
        console.log(`Skipping ${id} format.`);
        continue;
      }
      const outputFileName =
        parsedInputPath.name +
        `.${id}` +
        ('.' + id.toString() === extension ? '' : extension);
      const outputFile = path.join(outputDir, outputFileName);
      const writtenFile = await serializeChecklistFile(checklistFile, id);
      console.log(`Saving ${name} as ${outputFile}`);
      fs.writeFileSync(
        outputFile,
        Buffer.from(await writtenFile.arrayBuffer())
      );
      const downloadUrl =
        RELEASE_URL_PREFIX + outputFile.split('/').slice(2).join('.');
      links[id] = `[${id}](${downloadUrl})`;
    }
    return links;
  } catch (error) {
    console.error(
      `An error occurred during conversion of ${inputFile}:`,
      error
    );
    return {};
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
  const outputMdFile = 'output.md';

  const outputFormats = FORMAT_REGISTRY.getSupportedOutputFormats()
    .filter(({ id }) => !['json'].includes(id))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const allOutputFormats = [
    { id: 'pdf', name: 'PDF' },
    ...outputFormats.filter(({ id }) => id !== 'pdf'),
  ];

  const header =
    '| Checklist | ' + allOutputFormats.map((f) => f.name).join(' | ') + ' |';
  const separator =
    '| --- | ' + allOutputFormats.map(() => '---').join(' | ') + ' |';
  const tableRows = [header, separator];

  const jsonFiles = findJsonFiles(checklistsDir);
  for (const inputFile of jsonFiles) {
    const dirname = path.dirname(inputFile);
    const outputDir = path.join(outputRootDir, dirname);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const links = await convertFile(inputFile, outputDir);
    const checklistName = path.basename(inputFile);
    const rowCells = [checklistName];
    for (const format of allOutputFormats) {
      rowCells.push(links[format.id] || ' ');
    }
    tableRows.push(`| ${rowCells.join(' | ')} |`);
  }

  fs.writeFileSync(outputMdFile, tableRows.join('\n'));
  console.log(`Generated ${outputMdFile}`);
}

main();
