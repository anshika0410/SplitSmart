const fs = require('fs');
const http = require('http');

http.get('http://127.0.0.1:8000/groups/5/export/csv', (res) => {
  console.log('CSV Status:', res.statusCode);
  res.on('data', (d) => process.stdout.write(d));
}).on('error', (e) => {
  console.error(e);
});

http.get('http://127.0.0.1:8000/groups/5/export/pdf', (res) => {
  console.log('\nPDF Status:', res.statusCode);
  const file = fs.createWriteStream("test.pdf");
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('\nPDF Downloaded successfully');
  });
}).on('error', (e) => {
  console.error(e);
});
