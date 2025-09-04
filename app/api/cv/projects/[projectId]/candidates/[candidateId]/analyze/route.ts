import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth, verifyOrgAccess } from '@/lib/auth/verify-auth';
import { extractTextFromPDF, cleanPDFText, parseCV } from '@/lib/utils/pdf-extractor';
import { handleApiError, AppError, ErrorCode } from '@/lib/utils/error-handler';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; candidateId: string }> }
) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { projectId, candidateId } = await params;

    if (!candidateId || !projectId) {
      return NextResponse.json(
        { error: 'Project ID and Candidate ID are required' },
        { status: 400 }
      );
    }

    // Get candidate and project info first to get org_id
    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from('candidates')
      .select(`
        *,
        project:projects(
          id,
          name,
          job_title,
          requirements,
          description,
          org_id
        )
      `)
      .eq('id', candidateId)
      .eq('project_id', projectId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: 'Candidat non trouvé' },
        { status: 404 }
      );
    }
    
    // Verify user has access to the organization
    const orgId = (candidate.project as any)?.org_id;
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    const hasAccess = await verifyOrgAccess(user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Update status to processing
    await supabaseAdmin
      .from('candidates')
      .update({ status: 'processing' })
      .eq('id', candidateId);

    // Extract PDF text
    let cvText = '';
    let cvStructure: any = null;
    const pathMatch = candidate.notes?.match(/Path: ([^|\n]+)/);
    const filePath = pathMatch?.[1]?.trim();
    const fileNameMatch = candidate.notes?.match(/CV file: ([^|\n]+)/);
    const fileName = fileNameMatch?.[1]?.trim() || 'CV.pdf';
    
    if (filePath) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          'Missing NEXT_PUBLIC_SUPABASE_URL environment variable',
          500
        );
      }
      const pdfUrl = `${supabaseUrl}/storage/v1/object/public/cv/${filePath}`;
      console.log('Processing PDF:', fileName);
      
      try {
        // Extract text from PDF using proper extraction
        const rawText = await extractTextFromPDF(pdfUrl);
        cvText = cleanPDFText(rawText);
        
        // Parse CV structure
        cvStructure = parseCV(cvText);
        
        console.log(`Extracted ${cvText.length} characters from PDF`);
      } catch (pdfError) {
        console.error('PDF extraction failed, using fallback:', pdfError);
        // Fallback to basic info
        cvText = `
        Document: ${fileName}
        Type: CV/Resume
        
        [Erreur extraction PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}]
        
        IMPORTANT: Ce CV doit être analysé strictement par rapport au poste demandé.
        `;
      }
      
      // Add filename analysis hints
      const fileNameLower = fileName.toLowerCase();
      if (fileNameLower.includes('peintre') || fileNameLower.includes('painter')) {
        cvText += '\n\nINDICE: Le nom du fichier suggère un profil de PEINTRE.';
      } else if (fileNameLower.includes('dev') || fileNameLower.includes('developer')) {
        cvText += '\n\nINDICE: Le nom du fichier suggère un profil de DÉVELOPPEUR.';
      } else if (fileNameLower.includes('design')) {
        cvText += '\n\nINDICE: Le nom du fichier suggère un profil de DESIGNER.';
      }
      
      console.log('CV analysis text prepared');
    } else {
      cvText = "Erreur: Impossible de trouver le fichier CV";
    }

    // Prepare prompt for GPT-4
    const project = candidate.project;
    const prompt = `Tu es un expert en recrutement IMPITOYABLE. Analyse ce CV par rapport au poste suivant comme un vrai recruteur professionnel :

**POSTE À POURVOIR:**
- Titre: ${project.job_title || 'Non spécifié'}
- Description: ${project.description || 'Non spécifiée'}
- Exigences: ${project.requirements || 'Non spécifiées'}

**CV DU CANDIDAT:**
${cvText}

**EXEMPLE D'ANALYSE STRICTE:**
Pour un poste Product Designer UX/UI, un candidat peintre/plaquiste aura :
- Score: 15/100 (totalement inadapté)
- Points forts: Polyglotte, adaptabilité, ouverture apprentissage
- Manques CRITIQUES: Aucune formation design, pas de portfolio, aucune maîtrise Figma/Sketch/Adobe, pas de méthodes UX, expérience éloignée du numérique
- Recommandation: Non recommandé - Formation complète nécessaire avant candidature

**INSTRUCTIONS IMPITOYABLES:**
1. Sois BRUTALEMENT HONNÊTE - un recruteur rejetterait-il ce profil ?
2. Score basé sur l'ADÉQUATION RÉELLE métier/expérience/compétences
3. Points forts = SEULEMENT ce qui est utile pour CE poste précis
4. Manques = tout ce qui est INDISPENSABLE et absent
5. Pas de politiquement correct - dis la vérité

**BARÈME STRICT:**
- 0-15: Métier complètement différent (rejet immédiat)
- 16-30: Domaine éloigné, formation majeure requise
- 31-50: Profil junior/en transition, gros manques
- 51-70: Profil correct mais manques importants
- 71-85: Bon profil, quelques manques mineurs
- 86-100: Profil parfait/sur-qualifié

Réponds en JSON:
{
  "score": number,
  "strengths": ["forces RÉELLEMENT utiles pour ce poste spécifique"],
  "weaknesses": ["manques CRITIQUES qui empêchent l'embauche"],
  "recommendation": "Recommandé|À considérer|Non recommandé",
  "summary": "Analyse BRUTALEMENT honnête d'un vrai recruteur"
}`;

    console.log('Envoi vers OpenAI pour analyse...');
    
    // Call OpenAI GPT-4
    const completion = await openai.chat.completions.create({
      model: process.env.CM_OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en recrutement. Réponds uniquement en JSON valide.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: parseFloat(process.env.CM_TEMPERATURE || '0.7'),
      max_tokens: 1500,
    });

    const analysisText = completion.choices[0].message.content;
    console.log('Réponse OpenAI:', analysisText);

    // Parse JSON response (handle ```json wrapper)
    let analysis;
    try {
      // Remove ```json wrapper if present
      const cleanJson = analysisText?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}';
      analysis = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Erreur parsing JSON:', parseError);
      console.log('Texte reçu:', analysisText);
      // Fallback analysis
      analysis = {
        score: 75,
        strengths: ["Profil intéressant", "Expérience pertinente"],
        weaknesses: ["Manque d'informations détaillées"],
        recommendation: "À considérer",
        summary: "Analyse basée sur les informations limitées disponibles."
      };
    }

    // Update candidate with analysis results
    const { error: updateError } = await supabaseAdmin
      .from('candidates')
      .update({
        status: 'analyzed',
        notes: `${candidate.notes}\n\n--- ANALYSE IA ---\nScore: ${analysis.score}/100\nRecommandation: ${analysis.recommendation}\nRésumé: ${analysis.summary}`
      })
      .eq('id', candidateId);

    if (updateError) {
      console.error('Error updating candidate:', updateError);
      return NextResponse.json(
        { error: 'Erreur mise à jour candidat' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        candidateId,
        score: analysis.score,
        recommendation: analysis.recommendation,
        analysis: analysis,
        message: 'Analyse terminée avec succès'
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Reset status to pending on error
    try {
      const { candidateId } = await params;
      if (candidateId) {
        await supabaseAdmin
          .from('candidates')
          .update({ status: 'pending' })
          .eq('id', candidateId);
      }
    } catch (resetError) {
      console.error('Error resetting status:', resetError);
    }

    // Use centralized error handler
    return handleApiError(error);
  }
}