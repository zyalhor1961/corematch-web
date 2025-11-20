/**
 * Extract text from PDF buffer or URL with multiple fallback methods
 * SECURITY: Includes protections against DoS attacks and malicious PDFs
 */
export async function extractTextFromPDF(source: Buffer | string): Promise<string> {
  // Use pdf2json (Node.js-friendly, no canvas dependencies)
  try {
    console.log('[PDF Extract] Attempting extraction with pdf2json');
    return await extractWithPdf2Json(source);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PDF Extract] Failed: ${errorMsg}`);
    throw new Error(`Failed to extract text from PDF: ${errorMsg}`);
  }
}

/**
 * Extract using pdf2json library (Node.js-friendly)
 */
async function extractWithPdf2Json(source: Buffer | string): Promise<string> {
  const PDFParser = (await import('pdf2json')).default;

  // SECURITY: Limits
  const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_TEXT_LENGTH = 500000; // 500KB text
  const FETCH_TIMEOUT = 30000; // 30 seconds

  return new Promise<string>(async (resolve, reject) => {
    try {
      let pdfBuffer: Buffer;

      // Fetch or prepare PDF data
      if (typeof source === 'string' && source.startsWith('http')) {
        // SECURITY: Validate URL
        const url = new URL(source);
        const trustedHosts = [
          'glexllbywdvlxpbanjmn.supabase.co',
          'localhost',
          '127.0.0.1'
        ];

        const isTrusted = trustedHosts.some(host =>
          url.hostname === host || url.hostname.endsWith(`.${host}`)
        );

        if (!isTrusted) {
          console.warn(`[SECURITY] Untrusted PDF URL blocked: ${url.hostname}`);
          return reject(new Error('PDF URL from untrusted source'));
        }

        // SECURITY: Fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        try {
          const response = await fetch(source, {
            signal: controller.signal,
            redirect: 'manual'
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            return reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
          }

          const arrayBuffer = await response.arrayBuffer();

          // SECURITY: Validate size
          if (arrayBuffer.byteLength > MAX_PDF_SIZE) {
            return reject(new Error('PDF exceeds 10MB limit'));
          }

          // SECURITY: Validate PDF magic bytes
          const header = new Uint8Array(arrayBuffer.slice(0, 5));
          const isValidPDF = header[0] === 0x25 && header[1] === 0x50 &&
                            header[2] === 0x44 && header[3] === 0x46 && header[4] === 0x2D;

          if (!isValidPDF) {
            return reject(new Error('Invalid PDF file: missing PDF header'));
          }

          pdfBuffer = Buffer.from(arrayBuffer);
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            return reject(new Error('PDF fetch timeout'));
          }
          throw error;
        }
      } else if (Buffer.isBuffer(source)) {
        // SECURITY: Validate size
        if (source.length > MAX_PDF_SIZE) {
          return reject(new Error('PDF exceeds 10MB limit'));
        }

        // SECURITY: Validate PDF magic bytes
        if (source.length < 5 ||
            source[0] !== 0x25 || source[1] !== 0x50 ||
            source[2] !== 0x44 || source[3] !== 0x46 || source[4] !== 0x2D) {
          return reject(new Error('Invalid PDF file: missing PDF header'));
        }

        pdfBuffer = source;
      } else {
        return reject(new Error('Invalid source type'));
      }

      // Parse PDF with pdf2json
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        reject(new Error(`PDF parsing error: ${errData.parserError}`));
      });

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          // Extract text from all pages
          let fullText = '';

          if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
            for (const page of pdfData.Pages) {
              if (page.Texts && Array.isArray(page.Texts)) {
                for (const text of page.Texts) {
                  if (text.R && Array.isArray(text.R)) {
                    for (const run of text.R) {
                      if (run.T) {
                        // Decode URI-encoded text
                        fullText += decodeURIComponent(run.T) + ' ';
                      }
                    }
                  }
                }
                fullText += '\n';
              }
            }
          }

          // SECURITY: Limit text length
          if (fullText.length > MAX_TEXT_LENGTH) {
            console.warn('[PDF Extract] Text truncated at 500KB for security');
            fullText = fullText.substring(0, MAX_TEXT_LENGTH);
          }

          console.log(`[PDF Extract] pdf2json success: ${fullText.trim().length} chars`);
          resolve(fullText.trim());
        } catch (error) {
          reject(new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });

      // Parse the buffer
      pdfParser.parseBuffer(pdfBuffer);

    } catch (error) {
      reject(error);
    }
  });
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
