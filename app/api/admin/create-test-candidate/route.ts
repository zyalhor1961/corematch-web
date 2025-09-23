import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Creating test candidate...');

    const body = await request.json();
    const { projectId = '8a1ba711-79a2-469b-820d-48a2e992a6b1' } = body;

    // Create a test candidate
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .insert({
        project_id: projectId,
        org_id: '00000000-0000-0000-0000-000000000001',
        first_name: 'Jean',
        last_name: 'Dupont',
        name: 'Jean Dupont',
        email: 'jean.dupont@example.com',
        phone: '+33 6 12 34 56 78',
        status: 'analyzed',
        cv_filename: 'jean_dupont_cv.pdf',
        notes: `CV file: jean_dupont_cv.pdf|Path: test-project/jean_dupont_cv.pdf|Generated with Test|Summary: Candidat de test généré automatiquement
Score: 85/100
Recommandation: Excellent candidat à considérer
Résumé: Profil senior avec 5 ans d'expérience en développement web`,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (candidateError) {
      console.error('Error creating candidate:', candidateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create candidate',
        details: candidateError.message
      }, { status: 500 });
    }

    console.log('Test candidate created successfully:', candidate);

    // Create a simple PDF file as test content
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 100
>>
stream
BT
/F1 12 Tf
72 720 Td
(CV de test - Jean Dupont) Tj
0 -20 Td
(Candidat de demonstration) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f
0000000015 00000 n
0000000074 00000 n
0000000120 00000 n
0000000218 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
380
%%EOF`;

    try {
      // Upload test PDF to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('cv')
        .upload('test-project/jean_dupont_cv.pdf', Buffer.from(pdfContent), {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
      } else {
        console.log('Test PDF uploaded successfully:', uploadData);
      }
    } catch (uploadErr) {
      console.error('PDF upload failed:', uploadErr);
    }

    return NextResponse.json({
      success: true,
      candidate: candidate,
      message: 'Test candidate created successfully'
    });

  } catch (error) {
    console.error('Create test candidate error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test candidate creation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}