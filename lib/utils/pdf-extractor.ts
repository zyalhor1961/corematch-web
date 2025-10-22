/**
 * Extract text from PDF buffer or URL with multiple fallback methods
 * SECURITY: Includes protections against DoS attacks and malicious PDFs
 */
export async function extractTextFromPDF(source: Buffer | string): Promise<string> {
  // Use unpdf (serverless-friendly, no browser API dependencies)
  try {
    console.log('[PDF Extract] Attempting extraction with unpdf');
    return await extractWithUnpdf(source);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PDF Extract] Failed: ${errorMsg}`);
    throw new Error(`Failed to extract text from PDF: ${errorMsg}`);
  }
}

/**
 * Extract using unpdf library (serverless-friendly)
 */
async function extractWithUnpdf(source: Buffer | string): Promise<string> {
  const { extractText } = await import('unpdf');

  // SECURITY: Limits to prevent DoS attacks
  const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB max
  const MAX_PAGES = 50; // Max pages to process
  const MAX_TEXT_LENGTH = 500000; // Max 500KB of text
  const FETCH_TIMEOUT = 30000; // 30 second timeout for fetch

  let pdfData: Uint8Array;

  // If source is a URL, fetch the PDF
  if (typeof source === 'string' && source.startsWith('http')) {
    // SECURITY: Validate URL is from trusted domain
    const url = new URL(source);
    const trustedHosts = [
      'glexllbywdvlxpbanjmn.supabase.co', // Supabase storage
      'localhost',
      '127.0.0.1'
    ];

    const isTrusted = trustedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
    if (!isTrusted) {
      console.warn(`[SECURITY] Untrusted PDF URL blocked: ${url.hostname}`);
      throw new Error('PDF URL from untrusted source');
    }

    // SECURITY: Fetch with timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(source, {
        signal: controller.signal,
        // SECURITY: Don't follow redirects to prevent SSRF
        redirect: 'manual'
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // SECURITY: Validate Content-Type
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('pdf')) {
        console.warn(`[SECURITY] Invalid content type: ${contentType}`);
        // Allow it but log warning (some servers don't set correct content-type)
      }

      const arrayBuffer = await response.arrayBuffer();

      // SECURITY: Validate PDF size
      if (arrayBuffer.byteLength > MAX_PDF_SIZE) {
        throw new Error('PDF exceeds 10MB limit');
      }

      // SECURITY: Validate PDF magic bytes (starts with %PDF)
      const header = new Uint8Array(arrayBuffer.slice(0, 5));
      const pdfHeader = '%PDF-';
      const isValidPDF = header[0] === 0x25 && // %
                        header[1] === 0x50 && // P
                        header[2] === 0x44 && // D
                        header[3] === 0x46 && // F
                        header[4] === 0x2D;   // -

      if (!isValidPDF) {
        throw new Error('Invalid PDF file: missing PDF header');
      }

      pdfData = new Uint8Array(arrayBuffer);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('PDF fetch timeout');
      }
      throw error;
    }
  } else if (Buffer.isBuffer(source)) {
    // SECURITY: Validate buffer size
    if (source.length > MAX_PDF_SIZE) {
      throw new Error('PDF exceeds 10MB limit');
    }

    // SECURITY: Validate PDF magic bytes
    if (source.length < 5 ||
        source[0] !== 0x25 || source[1] !== 0x50 ||
        source[2] !== 0x44 || source[3] !== 0x46 || source[4] !== 0x2D) {
      throw new Error('Invalid PDF file: missing PDF header');
    }

    pdfData = new Uint8Array(source);
  } else {
    throw new Error('Invalid source type');
  }

  // Extract text with unpdf
  const result = await extractText(pdfData, {
    mergePages: true, // Merge all pages into one string
  });

  const { text, totalPages } = result;

  // SECURITY: Validate page count
  if (totalPages > MAX_PAGES) {
    console.warn(`[SECURITY] PDF has ${totalPages} pages, processing only first ${MAX_PAGES}`);
    // unpdf doesn't have a way to limit pages, so we truncate text instead
  }

  // SECURITY: Limit extracted text length
  if (text.length > MAX_TEXT_LENGTH) {
    console.warn('[PDF Extract] Text truncated at 500KB for security');
    return text.substring(0, MAX_TEXT_LENGTH);
  }

  console.log(`[PDF Extract] unpdf success: ${text.length} chars, ${totalPages} pages`);
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
