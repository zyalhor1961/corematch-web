import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { analyzeCV } from '@/lib/openai/client';
import { incrementUsage } from '@/lib/utils/quotas';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;

    // Get project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('org_id, name, job_title, requirements')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get pending candidates
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select('id, cv_url, cv_filename, status')
      .eq('project_id', projectId)
      .eq('status', 'pending');

    if (candidatesError) {
      return NextResponse.json(
        { error: 'Failed to fetch candidates' },
        { status: 500 }
      );
    }

    if (!candidates?.length) {
      return NextResponse.json({
        success: true,
        data: { message: 'No pending candidates to process' },
      });
    }

    const processed = [];
    const errors = [];

    for (const candidate of candidates) {
      try {
        // Update candidate status to processing
        await supabaseAdmin
          .from('candidates')
          .update({ status: 'processing' })
          .eq('id', candidate.id);

        // Get signed URL for CV file
        const { data: signedUrlData } = await supabaseAdmin.storage
          .from('cv')
          .createSignedUrl(candidate.cv_url, 3600); // 1 hour expiry

        if (!signedUrlData?.signedUrl) {
          throw new Error('Failed to get CV file URL');
        }

        // For demo purposes, we'll extract text from PDF using a placeholder
        // In production, you'd use a PDF parsing library like pdf-parse
        const cvText = await extractTextFromPDF(signedUrlData.signedUrl);

        // Analyze CV with OpenAI
        const analysis = await analyzeCV(
          cvText, 
          project.job_title, 
          project.requirements
        );

        // Update candidate with analysis results
        const { error: updateError } = await supabaseAdmin
          .from('candidates')
          .update({
            name: analysis.name || null,
            email: analysis.email || null,
            phone: analysis.phone || null,
            score: analysis.score,
            explanation: analysis.explanation,
            status: 'analyzed',
          })
          .eq('id', candidate.id);

        if (updateError) {
          throw updateError;
        }

        // Increment usage counter
        await incrementUsage(project.org_id, 'cv');

        processed.push({
          id: candidate.id,
          filename: candidate.cv_filename,
          score: analysis.score,
        });

      } catch (error) {
        console.error(`Error processing candidate ${candidate.id}:`, error);
        
        // Update candidate status to error
        await supabaseAdmin
          .from('candidates')
          .update({ 
            status: 'pending', // Reset to allow retry
            explanation: `Processing failed: ${error}` 
          })
          .eq('id', candidate.id);

        errors.push({
          id: candidate.id,
          filename: candidate.cv_filename,
          error: error instanceof Error ? error.message : 'Processing failed',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: processed.length,
        total: candidates.length,
        results: processed,
        errors: errors,
      },
    });

  } catch (error) {
    console.error('CV processing error:', error);
    return NextResponse.json(
      { error: 'CV processing failed' },
      { status: 500 }
    );
  }
}

async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  // Placeholder implementation
  // In production, you would:
  // 1. Download the PDF from the URL
  // 2. Use a library like pdf-parse to extract text
  // 3. Return the extracted text
  
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }

    // For now, return a placeholder
    // In a real implementation, you would parse the PDF content here
    return 'PDF content extraction would be implemented here. This is a placeholder text for CV analysis.';
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    return 'Failed to extract PDF content';
  }
}