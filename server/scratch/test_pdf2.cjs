const pdf = require('pdf-parse');
console.log('PDFParse:', typeof pdf.PDFParse);
console.log('default:', typeof pdf.default);
if (typeof pdf.PDFParse === 'function') {
  console.log('Is PDFParse a class?', !!pdf.PDFParse.prototype);
}
