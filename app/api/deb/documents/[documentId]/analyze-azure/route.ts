import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    console.log('🚀 Starting Azure Form Recognizer analysis for document:', documentId);

    // Get document details
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get signed URL for the document
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('deb-docs')
      .createSignedUrl(document.file_url, 3600);

    if (urlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: 'Failed to get document URL' },
        { status: 500 }
      );
    }

    // Update status to processing
    await supabaseAdmin
      .from('documents')
      .update({ 
        status: 'processing',
        processing_status: 'azure_analysis_started'
      })
      .eq('id', documentId);

    // Analyze document with Azure Form Recognizer
    const analysisResult = await analyzeDocumentWithAzure(signedUrlData.signedUrl, document.name);

    if (!analysisResult.success) {
      await supabaseAdmin
        .from('documents')
        .update({ 
          status: 'error',
          processing_status: 'azure_analysis_failed'
        })
        .eq('id', documentId);

      return NextResponse.json(
        { error: analysisResult.error },
        { status: 500 }
      );
    }

    const extractedData = analysisResult.data;

    // Update document with extracted information
    await supabaseAdmin
      .from('documents')
      .update({
        status: 'parsed',
        processing_status: 'azure_analysis_completed',
        doc_type: extractedData.document_type,
        supplier_name: extractedData.vendor_name,
        supplier_vat: extractedData.vendor_tax_id,
        supplier_country: extractedData.vendor_country,
        supplier_address: extractedData.vendor_address,
        invoice_number: extractedData.invoice_id,
        invoice_date: extractedData.invoice_date,
        total_ht: extractedData.subtotal,
        total_ttc: extractedData.invoice_total,
        shipping_total: extractedData.shipping_cost,
        currency: extractedData.currency || 'EUR',
        line_count: extractedData.items?.length || 0,
        confidence_avg: extractedData.confidence_avg,
        validation_results: extractedData.validation_results
      })
      .eq('id', documentId);

    // Insert document lines if extracted
    if (extractedData.items && extractedData.items.length > 0) {
      // Delete existing lines first
      await supabaseAdmin
        .from('document_lines')
        .delete()
        .eq('document_id', documentId);

      const lines = extractedData.items.map((item: any, index: number) => ({
        document_id: documentId,
        line_number: index + 1,
        description: item.description,
        sku: item.product_code,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        line_amount: item.amount,
        hs_code: item.hs_code,
        country_of_origin: item.country_of_origin,
        net_mass_kg: item.weight,
        created_at: new Date().toISOString()
      }));

      const { error: linesError } = await supabaseAdmin
        .from('document_lines')
        .insert(lines);

      if (linesError) {
        console.error('Error inserting lines:', linesError);
      } else {
        console.log(`✅ Inserted ${lines.length} document lines`);
      }
    }

    console.log('✅ Azure analysis completed for document:', documentId);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Document analyzed successfully with Azure Form Recognizer',
        documentId,
        extractedData,
        lines_count: extractedData.items?.length || 0,
        confidence: extractedData.confidence_avg
      }
    });

  } catch (error) {
    console.error('❌ Document analysis error:', error);
    
    // Update status to error
    await supabaseAdmin
      .from('documents')
      .update({ 
        status: 'error',
        processing_status: 'analysis_error'
      })
      .eq('id', (await params).documentId);

    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 }
    );
  }
}

async function analyzeDocumentWithAzure(documentUrl: string, filename: string) {
  try {
    const azureKey = process.env.AZURE_FORM_RECOGNIZER_KEY;
    const azureEndpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;

    if (!azureKey || !azureEndpoint) {
      throw new Error('Azure Form Recognizer credentials not configured');
    }

    console.log('📊 Calling Azure Form Recognizer...');

    // Construire l'URL d'analyse pour Form Recognizer v2.1
    const resourceName = azureEndpoint.match(/https:\/\/([^.]+)\.cognitiveservices\.azure\.com/)?.[1] || 
                        azureEndpoint.match(/([^.\/]+)\.services\.ai\.azure\.com/)?.[1] || 
                        'corematch-deb-resource';
    
    const analyzeUrl = `https://${resourceName}.cognitiveservices.azure.com/formrecognizer/v2.1/prebuilt/invoice/analyze`;

    console.log('🔗 Azure endpoint:', analyzeUrl);

    // Démarrer l'analyse
    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: documentUrl
      })
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error('❌ Azure analyze error:', errorText);
      throw new Error(`Azure analysis failed: ${analyzeResponse.status} ${errorText}`);
    }

    const operationLocation = analyzeResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('No Operation-Location header received from Azure');
    }

    console.log('⏳ Azure analysis started, polling for results...');

    // Attendre les résultats (polling)
    let attempts = 0;
    const maxAttempts = 30; // 30 tentatives = 60 secondes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2 secondes
      attempts++;

      const resultResponse = await fetch(operationLocation, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey
        }
      });

      if (!resultResponse.ok) {
        console.error('Error polling results:', resultResponse.status);
        continue;
      }

      const result = await resultResponse.json();
      console.log(`📊 Azure status (attempt ${attempts}):`, result.status);

      if (result.status === 'succeeded') {
        console.log('✅ Azure analysis completed successfully');
        return processAzureResults(result, filename);
      } else if (result.status === 'failed') {
        throw new Error(`Azure analysis failed: ${result.error?.message || 'Unknown error'}`);
      }
      // Continue polling if status is 'running' or 'notStarted'
    }

    throw new Error('Azure analysis timeout - results not ready after 60 seconds');

  } catch (error) {
    console.error('❌ Azure analysis error:', error);
    return {
      success: false,
      error: `Azure analysis failed: ${error.message}`
    };
  }
}

function processAzureResults(azureResult: any, filename: string) {
  try {
    console.log('🔄 Processing Azure results...');
    
    const analyzeResult = azureResult.analyzeResult;
    if (!analyzeResult || !analyzeResult.documents || analyzeResult.documents.length === 0) {
      throw new Error('No documents found in Azure results');
    }

    const document = analyzeResult.documents[0];
    const fields = document.fields || {};

    // Fonction pour extraire la valeur d'un champ Azure
    function getFieldValue(field: any): any {
      if (!field) return null;
      if (field.type === 'string') return field.content || field.value;
      if (field.type === 'number') return field.value;
      if (field.type === 'date') return field.value;
      if (field.type === 'currency') return field.value?.amount || field.value;
      if (field.type === 'phoneNumber') return field.content;
      if (field.type === 'address') return field.content;
      return field.content || field.value || null;
    }

    // Extraction des informations principales
    const extractedData = {
      document_type: 'invoice',
      confidence_avg: document.confidence || 0.8,
      
      // Informations fournisseur
      vendor_name: getFieldValue(fields.VendorName),
      vendor_address: getFieldValue(fields.VendorAddress),
      vendor_tax_id: getFieldValue(fields.VendorTaxId),
      vendor_country: extractCountryFromAddress(getFieldValue(fields.VendorAddress)),
      
      // Informations facture
      invoice_id: getFieldValue(fields.InvoiceId),
      invoice_date: formatDate(getFieldValue(fields.InvoiceDate)),
      due_date: formatDate(getFieldValue(fields.DueDate)),
      
      // Montants
      subtotal: getFieldValue(fields.SubTotal) || 0,
      total_tax: getFieldValue(fields.TotalTax) || 0,
      invoice_total: getFieldValue(fields.InvoiceTotal) || 0,
      shipping_cost: getFieldValue(fields.ShippingCost) || 0,
      currency: 'EUR',
      
      // Adresses
      billing_address: getFieldValue(fields.BillingAddress),
      shipping_address: getFieldValue(fields.ShippingAddress),
      
      // Articles extraits
      items: []
    };

    // Extraire les lignes d'articles
    if (fields.Items && fields.Items.type === 'array' && fields.Items.value) {
      extractedData.items = fields.Items.value.map((item: any, index: number) => {
        const itemFields = item.value || {};
        return {
          line_number: index + 1,
          description: getFieldValue(itemFields.Description),
          quantity: getFieldValue(itemFields.Quantity) || 1,
          unit: getFieldValue(itemFields.Unit) || 'PCE',
          unit_price: getFieldValue(itemFields.UnitPrice) || 0,
          amount: getFieldValue(itemFields.Amount) || 0,
          product_code: getFieldValue(itemFields.ProductCode),
          hs_code: null, // Azure ne fournit pas les codes HS
          country_of_origin: null,
          weight: null
        };
      });
    }

    // Validation des résultats
    const validations = [];
    
    if (!extractedData.vendor_name) {
      validations.push({ type: 'warning', message: 'Nom du fournisseur non détecté' });
    }
    
    if (!extractedData.invoice_total || extractedData.invoice_total <= 0) {
      validations.push({ type: 'error', message: 'Montant total invalide ou manquant' });
    }
    
    if (extractedData.items.length === 0) {
      validations.push({ type: 'warning', message: 'Aucun article détecté dans le document' });
    }

    extractedData.validation_results = validations;

    console.log(`✅ Processed Azure results: ${extractedData.items.length} items extracted`);

    return {
      success: true,
      data: extractedData
    };

  } catch (error) {
    console.error('❌ Error processing Azure results:', error);
    return {
      success: false,
      error: `Failed to process Azure results: ${error.message}`
    };
  }
}

function extractCountryFromAddress(address: string): string | null {
  if (!address) return null;
  
  const countryPatterns = {
    'FR': /france|français|french/i,
    'DE': /germany|deutschland|german|allemagne/i,
    'IT': /italy|italia|italian|italie/i,
    'ES': /spain|españa|spanish|espagne/i,
    'NL': /netherlands|holland|dutch|pays-bas/i,
    'BE': /belgium|belgique|belgian/i,
    'CH': /switzerland|suisse|swiss/i,
    'GB': /united kingdom|great britain|uk|royaume-uni/i
  };
  
  for (const [code, pattern] of Object.entries(countryPatterns)) {
    if (pattern.test(address)) {
      return code;
    }
  }
  
  return null;
}

function formatDate(dateValue: any): string | null {
  if (!dateValue) return null;
  
  try {
    const date = new Date(dateValue);
    return date.toISOString().split('T')[0]; // Format YYYY-MM-DD
  } catch (error) {
    console.error('Error formatting date:', dateValue, error);
    return null;
  }
}