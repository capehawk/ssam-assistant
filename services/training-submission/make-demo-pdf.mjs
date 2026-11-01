// Reproducible synthetic certificate. No real people or school details.
import {writeFileSync} from 'node:fs';
const text='BT /F1 18 Tf 50 740 Td (SYNTHETIC TRAINING CERTIFICATE) Tj 0 -40 Td /F1 12 Tf (Teacher A - Demo only) Tj 0 -25 Td (Course: Safety Training) Tj 0 -25 Td (Provider: Demo Learning Center) Tj 0 -25 Td (Completed: 2026-10-01  Hours: 2) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${text.length} >>\nstream\n${text}\nendstream`];
let output='%PDF-1.4\n', offsets=[0];
objects.forEach((body,i)=>{offsets.push(output.length);output+=`${i+1} 0 obj\n${body}\nendobj\n`;});
const start=output.length;
output+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
writeFileSync(new URL('./demo-certificate.pdf',import.meta.url),output);
console.log('Created synthetic demo-certificate.pdf');
