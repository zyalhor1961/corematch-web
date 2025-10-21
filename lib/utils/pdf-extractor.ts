/**
 * Extract text from PDF buffer or URL using pdfjs-dist (more reliable in serverless)
 */
export async function extractTextFromPDF(source: Buffer | string): Promise<string> {
  try {
    // Dynamically import pdfjs-dist to avoid build issues
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    let pdfData: Uint8Array;

    // If source is a URL, fetch the PDF
    if (typeof source === 'string' && source.startsWith('http')) {
      const response = await fetch(source);

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      pdfData = new Uint8Array(arrayBuffer);
    } else if (Buffer.isBuffer(source)) {
      pdfData = new Uint8Array(source);
    } else {
      throw new Error('Invalid source: must be a Buffer or URL string');
    }

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    // Extract text from all pages
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine text items from the page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += pageText + '\n';
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);

    // Return empty string or throw based on requirements
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
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