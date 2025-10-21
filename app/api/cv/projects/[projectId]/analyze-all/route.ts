import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import OpenAI from 'openai';
// @ts-ignore - pdf-parse doesn't have proper TS definitions
import * as pdfParse from 'pdf-parse/lib/pdf-parse.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Buffer for pdf-parse
    const buffer = Buffer.from(pdfBuffer);

    // Extract text using pdf-parse
    const data = await pdfParse(buffer);

    return data.text.trim();
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Impossible d\'extraire le texte du PDF');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get all pending candidates for this project
    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('candidates')
      .select(`
        *,
        project:projects(
          id,
          name,
          job_title,
          requirements,
          description
        )
      `)
      .eq('project_id', projectId)
      .eq('status', 'pending');

    if (candidatesError || !candidates) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des candidats' },
        { status: 500 }
      );
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun CV en attente d\'analyse',
        data: { analyzed: 0, failed: 0 }
      });
    }

    const project = candidates[0].project;
    let analyzed = 0;
    let failed = 0;
    const results = [];

    // Process each candidate
    for (const candidate of candidates) {
      try {
        // Update status to processing
        await supabaseAdmin
          .from('candidates')
          .update({ status: 'processing' })
          .eq('id', candidate.id);

        // Extract CV file path from notes
        const pathMatch = candidate.notes?.match(/Path: ([^|]+)/);
        const cvPath = pathMatch ? pathMatch[1].trim() : null;

        let cvText = '';

        if (cvPath) {
          try {
            // Download PDF from Supabase Storage
            const { data: pdfData, error: downloadError } = await supabaseAdmin.storage
              .from('cv')
              .download(cvPath);

            if (downloadError || !pdfData) {
              console.error('Error downloading PDF:', downloadError);
              throw new Error('Impossible de télécharger le CV');
            }

            // Convert blob to ArrayBuffer
            const arrayBuffer = await pdfData.arrayBuffer();

            // Extract text from PDF
            cvText = await extractTextFromPDF(arrayBuffer);

            console.log(`Texte extrait du CV: ${cvText.substring(0, 200)}...`);
          } catch (extractError) {
            console.error('Error extracting CV text:', extractError);
            cvText = `Erreur lors de l'extraction du texte du CV.

Nom: ${candidate.first_name || ''} ${candidate.last_name || ''}
Email: ${candidate.email || 'Non renseigné'}
Téléphone: ${candidate.phone || 'Non renseigné'}`;
          }
        } else {
          cvText = `Informations du candidat:

Nom: ${candidate.first_name || ''} ${candidate.last_name || ''}
Email: ${candidate.email || 'Non renseigné'}
Téléphone: ${candidate.phone || 'Non renseigné'}

Note: Le fichier CV n'a pas pu être localisé pour extraction automatique.`;
        }

        // Prepare prompt for GPT-4
        const prompt = `Tu es un expert en recrutement. Analyse RIGOUREUSEMENT ce CV par rapport au poste suivant.

**POSTE À POURVOIR:**
- Titre: ${project.job_title || 'Non spécifié'}
- Description: ${project.description || 'Non spécifiée'}
- Exigences: ${project.requirements || 'Non spécifiées'}

**CV DU CANDIDAT:**
${cvText}

**INSTRUCTIONS STRICTES:**
1. **Score de 0 à 100** - Sois RÉALISTE et STRICT:
   - 90-100: Correspond PARFAITEMENT (compétences exactes + expérience pertinente)
   - 70-89: Bon profil (la plupart des compétences + expérience similaire)
   - 50-69: Profil moyen (quelques compétences + expérience partielle)
   - 30-49: Profil faible (peu de compétences + expérience non pertinente)
   - 0-29: Profil inadapté (aucune compétence requise)

2. **Vérifie l'adéquation RÉELLE:**
   - Les compétences du CV correspondent-elles aux exigences du poste ?
   - L'expérience est-elle pertinente pour ce poste spécifique ?
   - Le niveau d'expérience est-il adapté ?

3. **Sois HONNÊTE:**
   - Si le CV ne correspond PAS au poste, donne un score BAS (20-40)
   - Ne sois pas trop généreux avec les scores
   - Liste les VRAIS points forts (basés sur le CV réel)
   - Liste les VRAIS manques par rapport au poste

4. **Recommandation:**
   - "Recommandé" SEULEMENT si score >= 75 ET bon fit
   - "À considérer" si score 50-74
   - "Non recommandé" si score < 50

5. **Shortlist:**
   - true SEULEMENT si score >= 75 ET recommandé
   - false sinon

Réponds en JSON avec cette structure:
{
  "score": number,
  "strengths": ["point fort 1", "point fort 2", ...],
  "weaknesses": ["point faible 1", "point faible 2", ...],
  "recommendation": "Recommandé|À considérer|Non recommandé",
  "summary": "Résumé HONNÊTE en 2-3 phrases de l'évaluation",
  "shortlist": boolean,
  "shortlist_reason": "Justification RÉALISTE pour shortlist ou non"
}`;

        console.log(`Analyse IA pour candidat ${candidate.id}...`);
        
        // Call OpenAI GPT-4
        const completion = await openai.chat.completions.create({
          model: process.env.CM_OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Tu es un expert en recrutement STRICT et HONNÊTE. Tu analyses les CVs de manière RIGOUREUSE. Si un CV ne correspond pas au poste, tu donnes un score BAS. Tu ne fais PAS de complaisance. Réponds UNIQUEMENT en JSON valide, sans markdown.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: parseFloat(process.env.CM_TEMPERATURE || '0.3'),
          max_tokens: 2000,
        });

        const analysisText = completion.choices[0].message.content;
        
        // Parse JSON response
        let analysis;
        try {
          const cleanJson = analysisText?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '{}';
          analysis = JSON.parse(cleanJson);
        } catch (parseError) {
          console.error('Erreur parsing JSON:', parseError);
          analysis = {
            score: 70,
            strengths: ["Profil analysé", "Compétences évaluées"],
            weaknesses: ["Besoin d'évaluation approfondie"],
            recommendation: "À considérer",
            summary: "Analyse automatique basée sur les informations disponibles.",
            shortlist: false,
            shortlist_reason: "Analyse technique incomplète"
          };
        }

        // Prepare detailed explanation
        const explanation = `**Score:** ${analysis.score}/100

**Recommandation:** ${analysis.recommendation}

**Points forts:**
${analysis.strengths.map((s: string) => `• ${s}`).join('\n')}

**Points à améliorer:**
${analysis.weaknesses.map((w: string) => `• ${w}`).join('\n')}

**Résumé:**
${analysis.summary}

**Shortlist:** ${analysis.shortlist ? 'OUI' : 'NON'}
${analysis.shortlist_reason}`;

        // Update candidate with analysis results
        const { error: updateError } = await supabaseAdmin
          .from('candidates')
          .update({
            status: 'analyzed',
            score: analysis.score,
            explanation: explanation,
            shortlisted: analysis.shortlist,
            notes: `${candidate.notes}\n\n--- ANALYSE IA ---\n${explanation}`
          })
          .eq('id', candidate.id);

        if (updateError) {
          throw new Error('Erreur mise à jour candidat');
        }

        results.push({
          candidateId: candidate.id,
          name: candidate.first_name || 'Candidat',
          score: analysis.score,
          recommendation: analysis.recommendation,
          shortlist: analysis.shortlist
        });

        analyzed++;
        
      } catch (error) {
        console.error(`Erreur analyse candidat ${candidate.id}:`, error);
        
        // Reset status to pending on error
        await supabaseAdmin
          .from('candidates')
          .update({ status: 'pending' })
          .eq('id', candidate.id);
          
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Analyse terminée: ${analyzed} réussis, ${failed} échoués`,
      data: {
        analyzed,
        failed,
        results,
        shortlisted: results.filter(r => r.shortlist).length
      }
    });

  } catch (error) {
    console.error('Batch analysis error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse en lot' },
      { status: 500 }
    );
  }
}