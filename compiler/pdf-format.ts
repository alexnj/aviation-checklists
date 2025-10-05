import PDFDocument from 'pdfkit';
import {
  ChecklistFile,
  ChecklistItem_Type,
} from '../efis-editor/gen/ts/checklist';
import { AbstractChecklistFormat } from '../efis-editor/src/model/formats/abstract-format';

const RENDER_GROUP_HEADING = false;
const MAX_INDENTED_TEXT_HEIGHT = 10;
const COLOR_BLUE = '#0000FF';
const COLOR_RED = '#FF0000';
const COLOR_AMBER = '#CF3400';
const FONT_SIZE = 9;

export class PdfFormat extends AbstractChecklistFormat {
  async toProto(file: File): Promise<ChecklistFile> {
    throw new Error('PDF to Proto conversion is not supported.');
  }

  async fromProto(checklistFile: ChecklistFile): Promise<File> {
    const pdfBuffer = await this.generatePdf(checklistFile);
    const fileName = `${checklistFile.metadata?.name}.4col.pdf`;
    const pdfUint8Array = new Uint8Array(pdfBuffer);
    return new File([pdfUint8Array], fileName, { type: 'application/pdf' });
  }

  private async generatePdf(checklist: ChecklistFile): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: 20, bottom: 20, left: 15, right: 15 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Column layout
      const numColumns = 4;
      const gutterWidth = 10;
      const centerGutterWidth = 2 * gutterWidth;
      const pageContentWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      // Total gutter width is 2 normal gutters and one double-width center gutter
      const totalGutterWidth = 2 * gutterWidth + centerGutterWidth;
      const columnWidth = (pageContentWidth - totalGutterWidth) / numColumns;

      const getColumnX = (col: number) => {
        let x = doc.page.margins.left;
        for (let i = 0; i < col; i++) {
          x += columnWidth;
          // Gutter after column 2 (index 1) is wider.
          if (i === 1) {
            x += centerGutterWidth;
          } else {
            x += gutterWidth;
          }
        }
        return x;
      };

      // Header
      const headerWidth = columnWidth * 2 + gutterWidth;
      const headerX = getColumnX(0);
      let headerY = doc.page.margins.top;

      doc
        .moveTo(headerX, headerY)
        .lineTo(headerX + headerWidth, headerY)
        .lineWidth(0.5)
        .strokeColor(COLOR_BLUE)
        .stroke();
      headerY += 5;

      doc
        .fillColor(COLOR_BLUE)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(checklist.metadata?.makeAndModel || '', headerX, headerY, {
          width: headerWidth,
          align: 'center',
        });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(checklist.metadata?.aircraftInfo || '', headerX, doc.y, {
          width: headerWidth,
          align: 'center',
        });
      doc.fillColor('black');

      headerY = doc.y + 5;
      doc
        .moveTo(headerX, headerY)
        .lineTo(headerX + headerWidth, headerY)
        .lineWidth(0.5)
        .strokeColor(COLOR_BLUE)
        .stroke();
      doc.y = headerY + 10;

      let currentColumn = 0;
      const startY = doc.y;
      let y = startY;
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      let pageNumber = 1;

      const moveToNextColumn = () => {
        currentColumn++;
        if (currentColumn >= numColumns) {
          doc.addPage();
          pageNumber++;
          currentColumn = 0;
          y = doc.page.margins.top;
        } else {
          if (pageNumber === 1 && currentColumn >= 2) {
            y = doc.page.margins.top;
          } else {
            y = pageNumber === 1 ? startY : doc.page.margins.top;
          }
        }
      };

      const checkSpace = (height: number) => {
        if (y + height >= pageBottom) {
          moveToNextColumn();
        }
      };

      const calculateItemHeight = (
        item: any,
        doc: PDFKit.PDFDocument,
        itemWidth: number
      ): number => {
        let itemHeight = 0;
        doc.fontSize(FONT_SIZE);
        switch (item.type) {
          case ChecklistItem_Type.ITEM_TITLE:
            doc.font('Helvetica-Bold');
            itemHeight =
              doc.heightOfString(item.prompt, {
                width: itemWidth,
              }) + 3;
            break;
          case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
            doc.font('Helvetica');
            let responseWidth = doc.widthOfString(item.expectation) + 4;
            let challengeWidth = itemWidth - responseWidth;
            if (challengeWidth < itemWidth * 0.3) {
              challengeWidth = itemWidth * 0.3;
              responseWidth = itemWidth - challengeWidth;
            }
            const challengeHeight = doc.heightOfString(item.prompt, {
              width: challengeWidth,
            });
            doc.font('Helvetica');
            const responseHeight = doc.heightOfString(item.expectation, {
              width: responseWidth,
            });
            itemHeight = Math.max(challengeHeight, responseHeight);
            break;
          case ChecklistItem_Type.ITEM_PLAINTEXT:
            doc.font('Helvetica');
            itemHeight = doc.heightOfString(item.prompt, {
              width: itemWidth,
            });
            break;
          case ChecklistItem_Type.ITEM_WARNING:
            doc.font('Helvetica-Oblique');
            itemHeight = doc.heightOfString(`WARNING: ${item.prompt}`, {
              width: itemWidth,
            });
            break;
          case ChecklistItem_Type.ITEM_NOTE:
            doc.font('Helvetica-Oblique');
            itemHeight = doc.heightOfString(`NOTE: ${item.prompt}`, {
              width: itemWidth,
            });
            break;
          case ChecklistItem_Type.ITEM_SPACE:
            itemHeight = 4;
            break;
        }
        return itemHeight;
      };

      const calculateChecklistHeight = (
        checklistInGroup: any,
        doc: PDFKit.PDFDocument,
        columnWidth: number
      ): number => {
        let totalHeight = 0;
        if (checklistInGroup.title) {
          const checklistTitle = checklistInGroup.title.toUpperCase();
          doc.font('Helvetica-Bold').fontSize(FONT_SIZE);
          totalHeight +=
            doc.heightOfString(checklistTitle, {
              width: columnWidth,
              align: 'center',
            }) + 5;
        }

        for (const item of checklistInGroup.items) {
          const indent = (item.indent || 0) * 10;
          const itemWidth = columnWidth - indent;
          const itemHeight = calculateItemHeight(item, doc, itemWidth);
          if (item.type === ChecklistItem_Type.ITEM_SPACE) {
            totalHeight += 4;
          } else if (item.type === ChecklistItem_Type.ITEM_TITLE) {
            totalHeight += itemHeight + 3;
          } else {
            totalHeight += itemHeight + 2;
          }
        }
        totalHeight += 8; // space after checklist
        return totalHeight;
      };

      for (const group of checklist.groups) {
        let groupCategoryColor = COLOR_BLUE;
        switch (group.category) {
          case 2:
            // abnormal
            groupCategoryColor = COLOR_AMBER;
            break;
          case 3:
            // emergency
            groupCategoryColor = COLOR_RED;
            break;
        }

        if (RENDER_GROUP_HEADING) {
          const groupTitle = group.title.toUpperCase();
          doc.font('Helvetica-Bold').fontSize(10);
          const groupTitleHeight = doc.heightOfString(groupTitle, {
            width: columnWidth,
            underline: true,
          });
          checkSpace(groupTitleHeight + 5);
          doc
            .fillColor(groupCategoryColor)
            .text(groupTitle, getColumnX(currentColumn), y, {
              width: columnWidth,
              underline: true,
            });
          doc.fillColor('black');
          y += groupTitleHeight + 5;
        }

        for (const checklistInGroup of group.checklists) {
          const checklistHeight = calculateChecklistHeight(
            checklistInGroup,
            doc,
            columnWidth
          );
          const remainingHeight = pageBottom - y;

          if (
            /* if current column has less than 30% height remaining, and
               remaining checklist is < 50% */
            remainingHeight < pageBottom * 0.3 &&
            remainingHeight < checklistHeight * 0.5
          ) {
            moveToNextColumn();
          }

          if (checklistInGroup.title) {
            const checklistTitle = checklistInGroup.title.toUpperCase();
            doc.font('Helvetica-Bold').fontSize(FONT_SIZE);
            const checklistTitleHeight = doc.heightOfString(checklistTitle, {
              width: columnWidth,
              align: 'center',
            });
            checkSpace(checklistTitleHeight + 5);
            doc
              .fillColor(groupCategoryColor)
              .text(checklistTitle, getColumnX(currentColumn), y, {
                width: columnWidth,
                align: 'center',
              });
            doc.fillColor('black');
            y += checklistTitleHeight + 5;
          }

          for (let i = 0; i < checklistInGroup.items.length; i++) {
            const item = checklistInGroup.items[i];
            const nextItem =
              i + 1 < checklistInGroup.items.length
                ? checklistInGroup.items[i + 1]
                : null;

            const indent = (item.indent || 0) * 10;
            const itemWidth = columnWidth - indent;

            let itemHeight = calculateItemHeight(item, doc, itemWidth);

            if (
              ((item.indent || 0) > 0 ||
                item.type == ChecklistItem_Type.ITEM_WARNING ||
                item.type == ChecklistItem_Type.ITEM_PLAINTEXT) &&
              itemHeight > MAX_INDENTED_TEXT_HEIGHT
            ) {
              // Skip items that are indented and over max permitted height.
              continue;
            }
            if (
              item.type == ChecklistItem_Type.ITEM_TITLE &&
              itemHeight * 2 + y >= pageBottom
            ) {
              console.log(item.prompt, 'spilling over');
              moveToNextColumn();
            }
            checkSpace(itemHeight);
            const itemX = getColumnX(currentColumn) + indent;

            // Render item
            doc.fontSize(FONT_SIZE);
            switch (item.type) {
              case ChecklistItem_Type.ITEM_TITLE:
                doc
                  .font('Helvetica-Bold')
                  .text(item.prompt, itemX, y + 3, { width: itemWidth });
                doc.fillColor('black');
                y += itemHeight + 3;
                break;
              case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
                doc.font('Helvetica');
                let responseWidth = doc.widthOfString(item.expectation) + 4;
                let challengeWidth = itemWidth - responseWidth;
                if (challengeWidth < itemWidth * 0.3) {
                  challengeWidth = itemWidth * 0.3;
                  responseWidth = itemWidth - challengeWidth;
                }
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
              case ChecklistItem_Type.ITEM_PLAINTEXT:
                doc
                  .font('Helvetica')
                  .text(item.prompt, itemX, y, { width: itemWidth });
                y += itemHeight + 2;
                break;
              case ChecklistItem_Type.ITEM_WARNING:
                doc
                  .font('Helvetica-Oblique')
                  .fillColor('red')
                  .text(`WARNING: ${item.prompt}`, itemX, y, {
                    width: itemWidth,
                  });
                doc.fillColor('black');
                y += itemHeight + 2;
                break;
              case ChecklistItem_Type.ITEM_NOTE:
                doc
                  .font('Helvetica-Oblique')
                  .text(`NOTE: ${item.prompt}`, itemX, y, { width: itemWidth });
                y += itemHeight + 2;
                break;
              case ChecklistItem_Type.ITEM_SPACE:
                y += 4;
                break;
            }

            let drawLine = true;
            if (nextItem && (nextItem.indent || 0) > (item.indent || 0)) {
              drawLine = false;
            }
            if (
              item.type == ChecklistItem_Type.ITEM_SPACE ||
              item.type == ChecklistItem_Type.ITEM_TITLE
            ) {
              drawLine = false;
            }

            if (drawLine) {
              const lineY = y - 3;
              doc
                .moveTo(getColumnX(currentColumn), lineY)
                .lineTo(getColumnX(currentColumn) + columnWidth, lineY)
                .lineWidth(0.25)
                .strokeColor('#888888')
                .stroke();
            }
          }
          y += 8; // space after checklist
        }
      }

      doc.end();
    });
  }
}
