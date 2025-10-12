import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { recordValidation } from '@/lib/services/deb/auto-learning';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const body = await request.json();

    const {
      lineId,
      hsCode,
      weightKg,
      description,
      sku,
      countryOfOrigin
    } = body;

    // Validation
    if (!lineId || !hsCode || !weightKg || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: lineId, hsCode, weightKg, description' },
        { status: 400 }
      );
    }

    // Validate HS code format (8 digits)
    const cleanedHSCode = hsCode.replace(/[.\s-]/g, '');
    if (!/^\d{8}$/.test(cleanedHSCode)) {
      return NextResponse.json(
        { error: 'Invalid HS code format. Must be 8 digits.' },
        { status: 400 }
      );
    }

    console.log('✅ Validating line:', lineId, 'HS Code:', cleanedHSCode);

    // Fetch document to get org_id
    const { data: document, error: docError } = await supabaseAdmin
      .from('idp_documents')
      .select('org_id, created_by')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Update the field with validated data
    const { error: updateError } = await supabaseAdmin
      .from('idp_extracted_fields')
      .update({
        hs_code_suggested: cleanedHSCode,
        hs_code_confidence: 1.0000,
        hs_code_source: 'user_corrected',
        weight_kg_suggested: weightKg,
        weight_source: 'user_entered',
        is_validated: true,
        validated_at: new Date().toISOString()
      })
      .eq('id', lineId);

    if (updateError) {
      console.error('Error updating field:', updateError);
      throw new Error(`Failed to update field: ${updateError.message}`);
    }

    // Record in learning database
    const learningResult = await recordValidation({
      orgId: document.org_id,
      description,
      hsCode: cleanedHSCode,
      weightKg,
      sku,
      countryOfOrigin,
      validatedBy: document.created_by || 'system'
    });

    console.log('✅ Learning result:', learningResult.message);

    return NextResponse.json({
      success: true,
      message: 'Line validated successfully',
      lineId,
      hsCode: cleanedHSCode,
      weightKg,
      learningSaved: learningResult.success,
      learningMessage: learningResult.message,
      isNewArticle: learningResult.isNew
    });

  } catch (error: any) {
    console.error('❌ Validation error:', error);
    return NextResponse.json(
      { error: `Failed to validate line: ${error.message}` },
      { status: 500 }
    );
  }
}

// Batch validation endpoint
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const body = await request.json();
    const { validations } = body;

    if (!Array.isArray(validations)) {
      return NextResponse.json(
        { error: 'validations must be an array' },
        { status: 400 }
      );
    }

    console.log(`🔄 Batch validating ${validations.length} lines...`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const validation of validations) {
      try {
        // Create a synthetic request for each validation
        const singleRequest = new NextRequest(request.url, {
          method: 'POST',
          body: JSON.stringify(validation)
        });

        const result = await POST(singleRequest, { params: Promise.resolve({ documentId }) });
        const data = await result.json();

        results.push({
          lineId: validation.lineId,
          success: data.success,
          message: data.message
        });

        if (data.success) successCount++;
        else failCount++;
      } catch (error: any) {
        results.push({
          lineId: validation.lineId,
          success: false,
          message: error.message
        });
        failCount++;
      }
    }

    console.log(`✅ Batch validation complete: ${successCount} success, ${failCount} failed`);

    return NextResponse.json({
      success: failCount === 0,
      documentId,
      results,
      summary: {
        total: validations.length,
        success: successCount,
        failed: failCount
      }
    });

  } catch (error: any) {
    console.error('❌ Batch validation error:', error);
    return NextResponse.json(
      { error: `Failed to batch validate: ${error.message}` },
      { status: 500 }
    );
  }
}
