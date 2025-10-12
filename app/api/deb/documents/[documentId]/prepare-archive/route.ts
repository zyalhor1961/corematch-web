import { NextRequest, NextResponse } from 'next/server';
import { prepareForArchiving, validateDocumentComplete, exportToSAE } from '@/lib/services/deb/archiving';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { exportImmediately = false } = body;

    console.log('📦 Preparing document for archiving:', documentId);

    const result = await prepareForArchiving(documentId);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message,
        validation: result.validation
      }, { status: 400 });
    }

    // If export immediately flag is set, export to SAE
    if (exportImmediately) {
      console.log('📤 Exporting to SAE immediately...');
      const exportResult = await exportToSAE(documentId);

      return NextResponse.json({
        success: exportResult.success,
        message: exportResult.message,
        documentId,
        metadata: result.metadata,
        validation: result.validation,
        exported: true,
        exportId: exportResult.exportId
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      documentId,
      metadata: result.metadata,
      validation: result.validation,
      archiveReady: true
    });

  } catch (error: any) {
    console.error('❌ Archive preparation error:', error);
    return NextResponse.json(
      { error: `Failed to prepare for archiving: ${error.message}` },
      { status: 500 }
    );
  }
}

// GET endpoint to check archive readiness
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    const validation = await validateDocumentComplete(documentId);

    return NextResponse.json({
      success: true,
      documentId,
      validation,
      ready: validation.valid
    });

  } catch (error: any) {
    console.error('❌ Error checking archive readiness:', error);
    return NextResponse.json(
      { error: `Failed to check readiness: ${error.message}` },
      { status: 500 }
    );
  }
}
