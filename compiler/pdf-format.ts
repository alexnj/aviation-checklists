import PDFDocument from 'pdfkit';
import {
  ChecklistFile,
  ChecklistItem_Type,
} from '../efis-editor/gen/ts/checklist';
import { AbstractChecklistFormat } from '../efis-editor/src/model/formats/abstract-format';

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
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(checklist.metadata?.makeAndModel || '', { align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(checklist.metadata?.name || '', { align: 'center' });
      doc.moveDown(2);

      // Column layout
      const numColumns = 4;
      const gutterWidth = 10;
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
              case ChecklistItem_Type.ITEM_TITLE:
                doc.font('Helvetica-Bold');
                itemHeight = doc.heightOfString(item.prompt, {
                  width: itemWidth,
                });
                break;
              case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
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

            checkSpace(itemHeight);

            // Render item
            doc.fontSize(8);
            switch (item.type) {
              case ChecklistItem_Type.ITEM_TITLE:
                doc
                  .font('Helvetica-Bold')
                  .text(item.prompt, itemX, y, { width: itemWidth });
                y += itemHeight + 2;
                break;
              case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
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

            if (
              item.type !== ChecklistItem_Type.ITEM_SPACE &&
              item.type != ChecklistItem_Type.ITEM_TITLE
            ) {
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
