import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Azure Form Recognizer connection...');

    const azureKey = process.env.AZURE_FORM_RECOGNIZER_KEY;
    const azureEndpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;

    if (!azureKey || !azureEndpoint) {
      return NextResponse.json({
        success: false,
        error: 'Azure credentials not configured',
        missing: {
          key: !azureKey,
          endpoint: !azureEndpoint
        }
      }, { status: 400 });
    }

    // Test avec une URL d'image de test (facture fictive)
    const testImageUrl = 'https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/sample-invoice.pdf';

    // Construire l'URL d'analyse pour Form Recognizer v2.1 (plus stable)
    // Extraire le nom de la ressource depuis l'endpoint
    const resourceName = azureEndpoint.match(/https:\/\/([^.]+)\.cognitiveservices\.azure\.com/)?.[1] || 
                        azureEndpoint.match(/([^.\/]+)\.services\.ai\.azure\.com/)?.[1] || 
                        'corematch-deb-resource';
    
    const analyzeUrl = `https://${resourceName}.cognitiveservices.azure.com/formrecognizer/v2.1/prebuilt/invoice/analyze`;
    
    console.log('📡 Calling Azure endpoint:', analyzeUrl);

    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: testImageUrl
      })
    });

    console.log('📊 Azure response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Azure error response:', errorText);
      
      return NextResponse.json({
        success: false,
        error: 'Azure API call failed',
        status: response.status,
        details: errorText,
        endpoint_used: analyzeUrl
      }, { status: 500 });
    }

    const operationLocation = response.headers.get('Operation-Location');
    
    if (!operationLocation) {
      return NextResponse.json({
        success: false,
        error: 'No Operation-Location header received'
      }, { status: 500 });
    }

    console.log('✅ Azure Form Recognizer connection successful!');
    console.log('🔗 Operation Location:', operationLocation);

    return NextResponse.json({
      success: true,
      message: 'Azure Form Recognizer connection successful',
      operation_location: operationLocation,
      endpoint_configured: azureEndpoint,
      test_document: testImageUrl,
      next_step: 'Poll the operation location to get results'
    });

  } catch (error) {
    console.error('❌ Azure test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test Azure connection',
      details: error.message
    }, { status: 500 });
  }
}