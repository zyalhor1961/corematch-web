/**
 * Test Production Upload Endpoint
 */

const fs = require('fs');
const path = require('path');

async function testUpload() {
  console.log('🧪 Testing Production Upload Endpoint\n');

  // Create a minimal test PDF
  const testFilePath = path.join(__dirname, 'test-minimal.pdf');

  // Create a minimal valid PDF if it doesn't exist
  if (!fs.existsSync(testFilePath)) {
    const minimalPDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 100 700 Td (Test Invoice) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000056 00000 n
0000000115 00000 n
0000000214 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
306
%%EOF`;
    fs.writeFileSync(testFilePath, minimalPDF);
    console.log('✅ Created minimal test PDF');
  }

  const fileBuffer = fs.readFileSync(testFilePath);
  console.log('📄 File size:', fileBuffer.length, 'bytes');

  // Create FormData
  const FormData = require('form-data');
  const formData = new FormData();
  formData.append('file', fileBuffer, {
    filename: 'test-invoice.pdf',
    contentType: 'application/pdf'
  });
  formData.append('orgId', '75322f8c-4741-4e56-a973-92d68a261e4e');
  formData.append('documentType', 'invoice');
  formData.append('userId', '00000000-0000-0000-0000-000000000000');

  console.log('\n📤 Uploading to production...');
  console.log('URL: https://www.corematch.fr/api/idp/upload');

  try {
    const response = await fetch('https://www.corematch.fr/api/idp/upload', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    console.log('\n📊 Response Status:', response.status, response.statusText);

    const responseText = await response.text();
    console.log('\n📄 Response Body:');
    console.log(responseText);

    if (!response.ok) {
      try {
        const errorJson = JSON.parse(responseText);
        console.log('\n❌ Error Details:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.log('\n❌ Raw Error:', responseText);
      }
    } else {
      console.log('\n✅ Upload successful!');
      const result = JSON.parse(responseText);
      console.log('Document ID:', result.document?.id);
      console.log('Status:', result.document?.status);
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    console.error(error);
  }
}

testUpload().catch(console.error);
