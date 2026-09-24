import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function generateQRPdf(pngDataUrl, { title = '', subtitle = '' } = {}) {
  const pdfDoc = await PDFDocument.create();

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const pngBytes = dataUrlToUint8Array(pngDataUrl);
  const qrImage = await pdfDoc.embedPng(pngBytes);

  const qrSize = 320;
  const qrX = (pageWidth - qrSize) / 2;
  const qrY = (pageHeight - qrSize) / 2 + 10;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const headerText = title || 'Escanea el código QR';
  const headerFontSize = 20;
  const headerWidth = fontHelveticaBold.widthOfTextAtSize(headerText, headerFontSize);

  page.drawText(headerText, {
    x: (pageWidth - headerWidth) / 2,
    y: qrY + qrSize + 45,
    size: headerFontSize,
    font: fontHelveticaBold,
    color: rgb(0.09, 0.17, 0.3),
  });

  const subText = subtitle || 'Apunta con la cámara de tu teléfono para acceder';
  const subFontSize = 11;
  const subWidth = fontHelvetica.widthOfTextAtSize(subText, subFontSize);

  page.drawText(subText, {
    x: (pageWidth - subWidth) / 2,
    y: qrY + qrSize + 25,
    size: subFontSize,
    font: fontHelvetica,
    color: rgb(0.42, 0.47, 0.55),
  });

  const footerText = 'Documento generado con Nuvexa • Herramientas Digitales Privadas';
  const footerFontSize = 9;
  const footerWidth = fontHelvetica.widthOfTextAtSize(footerText, footerFontSize);

  page.drawText(footerText, {
    x: (pageWidth - footerWidth) / 2,
    y: 40,
    size: footerFontSize,
    font: fontHelvetica,
    color: rgb(0.6, 0.64, 0.7),
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
