/**
 * Extract text from PDF buffer or URL with multiple fallback methods
 * SECURITY: Includes protections against DoS attacks and malicious PDFs
 */
export async function extractTextFromPDF(source: Buffer | string): Promise<string> {
  // Try multiple extraction methods in order of reliability
  const errors: string[] = [];

  // Method 1: Try pdf-parse (most reliable for text extraction)
  try {
    console.log('[PDF Extract] Attempting method 1: pdf-parse');
    return await extractWithPdfParse(source);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`pdf-parse: ${errorMsg}`);
    console.warn(`[PDF Extract] Method 1 failed: ${errorMsg}`);
  }

  // Method 2: Try pdfjs-dist as fallback
  try {
    console.log('[PDF Extract] Attempting method 2: pdfjs-dist');
    return await extractWithPdfjsDist(source);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`pdfjs-dist: ${errorMsg}`);
    console.error(`[PDF Extract] Method 2 failed: ${errorMsg}`);
  }

  // All methods failed
  console.error('[PDF Extract] ALL METHODS FAILED:', errors.join(' | '));
  throw new Error('Failed to extract text from PDF: all methods exhausted');
}

/**
 * Extract using pdf-parse library (Method 1)
 */
async function extractWithPdfParse(source: Buffer | string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;

  // SECURITY: Limits to prevent DoS attacks
  const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB max

  let pdfBuffer: Buffer;

  // If source is a URL, fetch the PDF
  if (typeof source === 'string' && source.startsWith('http')) {
    const response = await fetch(source);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // SECURITY: Validate PDF size
    if (arrayBuffer.byteLength > MAX_PDF_SIZE) {
      throw new Error('PDF exceeds 10MB limit');
    }

    pdfBuffer = Buffer.from(arrayBuffer);
  } else if (Buffer.isBuffer(source)) {
    // SECURITY: Validate buffer size
    if (source.length > MAX_PDF_SIZE) {
      throw new Error('PDF exceeds 10MB limit');
    }
    pdfBuffer = source;
  } else {
    throw new Error('Invalid source type');
  }

  // Parse PDF with pdf-parse
  const data = await pdfParse(pdfBuffer, {
    max: 50, // SECURITY: Max 50 pages
  });

  const text = data.text || '';

  // SECURITY: Limit extracted text length
  if (text.length > 500000) {
    console.warn('[PDF Extract] Text truncated at 500KB');
    return text.substring(0, 500000);
  }

  console.log(`[PDF Extract] pdf-parse success: ${text.length} chars, ${data.numpages} pages`);
  return text;
}

/**
 * Extract using pdfjs-dist library (Method 2 - Fallback)
 */
async function extractWithPdfjsDist(source: Buffer | string): Promise<string> {
  // Try legacy build for Node.js compatibility
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // SECURITY: Limits
  const MAX_PDF_SIZE = 10 * 1024 * 1024;
  const MAX_PAGES = 50;
  const MAX_TEXT_LENGTH = 500000;

  let pdfData: Uint8Array;

  // Fetch or prepare PDF data
  if (typeof source === 'string' && source.startsWith('http')) {
    const response = await fetch(source);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_PDF_SIZE) {
      throw new Error('PDF exceeds 10MB limit');
    }

    pdfData = new Uint8Array(arrayBuffer);
  } else if (Buffer.isBuffer(source)) {
    if (source.length > MAX_PDF_SIZE) {
      throw new Error('PDF exceeds 10MB limit');
    }
    pdfData = new Uint8Array(source);
  } else {
    throw new Error('Invalid source type');
  }

  // Load PDF with security options
  const loadingTask = pdfjsLib.getDocument({
    data: pdfData,
    isEvalSupported: false, // SECURITY: Disable eval
    useSystemFonts: false,
  });

  const pdf = await loadingTask.promise;

  // SECURITY: Check page count
  if (pdf.numPages > MAX_PAGES) {
    throw new Error(`PDF has ${pdf.numPages} pages (max ${MAX_PAGES})`);
  }

  // Extract text from all pages
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
      .join(' ');

    fullText += pageText + '\n';

    // SECURITY: Stop if text too long
    if (fullText.length > MAX_TEXT_LENGTH) {
      console.warn('[PDF Extract] Text truncated at 500KB');
      break;
    }
  }

  console.log(`[PDF Extract] pdfjs-dist success: ${fullText.trim().length} chars`);
  return fullText.trim();
}

/**
 * Extract structured information from CV text
 */
export function parseCV(text: string): {
  name?: string;
  email?: string;
  phone?: string;
  skills: string[];
  experience: string[];
  education: string[];
  languages: string[];
} {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

  // Basic patterns for extraction
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phonePattern = /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/;

  const result = {
    name: undefined as string | undefined,
    email: undefined as string | undefined,
    phone: undefined as string | undefined,
    skills: [] as string[],
    experience: [] as string[],
    education: [] as string[],
    languages: [] as string[],
  };

  // Extract email
  const emailMatch = text.match(emailPattern);
  if (emailMatch) {
    result.email = emailMatch[0];
  }

  // Extract phone
  const phoneMatch = text.match(phonePattern);
  if (phoneMatch) {
    result.phone = phoneMatch[0];
  }

  // Try to extract name (usually one of the first lines)
  if (lines.length > 0) {
    // Look for a line that looks like a name (capitalized words, no special chars)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (
        line.length < 50 &&
        !line.includes('@') &&
        !line.match(/\d{4}/) &&
        /^[A-Z][a-z]+ [A-Z]/.test(line)
      ) {
        result.name = line;
        break;
      }
    }
  }

  // Extract sections
  let currentSection = '';
  for (const line of lines) {
    const lineLower = line.toLowerCase();

    // Detect section headers
    if (lineLower.includes('skill') || lineLower.includes('compétence')) {
      currentSection = 'skills';
      continue;
    } else if (lineLower.includes('experience') || lineLower.includes('expérience')) {
      currentSection = 'experience';
      continue;
    } else if (lineLower.includes('education') || lineLower.includes('formation')) {
      currentSection = 'education';
      continue;
    } else if (lineLower.includes('language') || lineLower.includes('langue')) {
      currentSection = 'languages';
      continue;
    }

    // Add content to current section
    if (currentSection && line.length > 2) {
      switch (currentSection) {
        case 'skills':
          result.skills.push(line);
          break;
        case 'experience':
          result.experience.push(line);
          break;
        case 'education':
          result.education.push(line);
          break;
        case 'languages':
          result.languages.push(line);
          break;
      }
    }
  }

  return result;
}

/**
 * Clean and normalize text extracted from PDF
 */
export function cleanPDFText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
    .replace(/\s{2,}/g, ' ') // Reduce multiple spaces
    .replace(/[^\S\n]{2,}/g, ' ') // Clean up whitespace
    .trim();
}
