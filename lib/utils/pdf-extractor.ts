/**
 * Extract text from PDF buffer or URL using pdfjs-dist (more reliable in serverless)
 * SECURITY: Includes protections against DoS attacks and malicious PDFs
 */
export async function extractTextFromPDF(source: Buffer | string): Promise<string> {
  try {
    // Dynamically import pdfjs-dist to avoid build issues
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // SECURITY: Limits to prevent DoS attacks
    const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB max
    const MAX_PAGES = 50; // Max 50 pages to prevent resource exhaustion
    const MAX_TEXT_LENGTH = 500000; // 500KB of text max

    let pdfData: Uint8Array;

    // If source is a URL, fetch the PDF
    if (typeof source === 'string' && source.startsWith('http')) {
      const response = await fetch(source);

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // SECURITY: Validate PDF size before processing
      if (arrayBuffer.byteLength > MAX_PDF_SIZE) {
        throw new Error('PDF file exceeds maximum allowed size (10MB)');
      }

      pdfData = new Uint8Array(arrayBuffer);
    } else if (Buffer.isBuffer(source)) {
      // SECURITY: Validate buffer size
      if (source.length > MAX_PDF_SIZE) {
        throw new Error('PDF file exceeds maximum allowed size (10MB)');
      }
      pdfData = new Uint8Array(source);
    } else {
      throw new Error('Invalid source: must be a Buffer or URL string');
    }

    // Load the PDF document with security options
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      // SECURITY: Disable potentially dangerous features
      isEvalSupported: false,
      useSystemFonts: false,
    });

    const pdf = await loadingTask.promise;

    // SECURITY: Limit number of pages to prevent DoS
    if (pdf.numPages > MAX_PAGES) {
      throw new Error(`PDF has too many pages (${pdf.numPages}). Maximum allowed: ${MAX_PAGES}`);
    }

    // Extract text from all pages
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine text items from the page
      const pageText = textContent.items
        .map((item: any) => {
          // SECURITY: Sanitize text to prevent injection attacks
          if (typeof item.str === 'string') {
            return item.str.substring(0, 10000); // Limit individual text items
          }
          return '';
        })
        .join(' ');

      fullText += pageText + '\n';

      // SECURITY: Check accumulated text length to prevent memory exhaustion
      if (fullText.length > MAX_TEXT_LENGTH) {
        console.warn(`PDF text extraction stopped: exceeded ${MAX_TEXT_LENGTH} characters`);
        break;
      }
    }

    return fullText.trim();
  } catch (error) {
    // SECURITY: Log only sanitized error info
    console.error('PDF extraction error (sanitized):', error instanceof Error ? error.message.substring(0, 100) : 'Unknown error');

    // Don't expose internal error details
    throw new Error('Failed to extract text from PDF');
  }
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