import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth } from '@/lib/auth/verify-auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AnalysisCriteria {
  id: string;
  name: string;
  description: string;
  weight: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { projectId, candidateId, message, criteria, conversationHistory } = body;

    if (!projectId || !message) {
      return NextResponse.json(
        { error: 'Project ID and message are required' },
        { status: 400 }
      );
    }

    // Get project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*, analysis_criteria')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Use provided criteria or project criteria or defaults
    const activeCriteria = criteria || project.analysis_criteria || [];

    // Get candidate details if candidateId is provided
    let candidateContext = '';
    if (candidateId) {
      const { data: candidate } = await supabaseAdmin
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single();

      if (candidate) {
        candidateContext = `\n\n**CANDIDAT EN CONTEXTE:**
- Nom: ${candidate.first_name} ${candidate.last_name || ''}
- Email: ${candidate.email || 'Non renseigné'}
- Status: ${candidate.status}
- Score: ${candidate.score || 'Non analysé'}/100
- Shortlisté: ${candidate.shortlisted ? 'Oui' : 'Non'}
${candidate.notes ? `- Notes: ${candidate.notes.substring(0, 500)}...` : ''}
`;
      }
    }

    // Build criteria context
    const criteriaContext = activeCriteria.length > 0
      ? `\n\n**CRITÈRES D'ANALYSE ACTIFS (${activeCriteria.length}):**
${activeCriteria.map((c: AnalysisCriteria) =>
  `- ${c.name} (Priorité ${c.weight}/5): ${c.description}`
).join('\n')}`
      : '';

    // Build conversation context
    const recentMessages = (conversationHistory || [])
      .slice(-5) // Keep only last 5 messages for context
      .map((msg: Message) => ({
        role: msg.role,
        content: msg.content
      }));

    // Detect if project uses deterministic analysis
    const useDeterministicAnalysis = !!project.job_spec_config;
    const jobSpecInfo = useDeterministicAnalysis
      ? `\n\n**SYSTÈME D'ANALYSE ACTIF:** DÉTERMINISTE ET AUDITABLE

**JobSpec configuré:**
- Must-have: ${project.job_spec_config.must_have?.length || 0} règles obligatoires
- Compétences requises: ${project.job_spec_config.skills_required?.length || 0}
- Règles de pertinence: DIRECTE / ADJACENTE / PÉRIPHÉRIQUE
- Poids: Expérience ${project.job_spec_config.weights?.w_exp || 0.5}, Compétences ${project.job_spec_config.weights?.w_skills || 0.3}
- Seuils: Shortlist ≥${project.job_spec_config.thresholds?.shortlist_min || 75}, Consider ≥${project.job_spec_config.thresholds?.consider_min || 60}`
      : `\n\n**SYSTÈME D'ANALYSE ACTIF:** LEGACY (mode simple)`;

    // Create system prompt
    const systemPrompt = `Tu es un assistant spécialisé dans l'analyse de CVs et le recrutement ${useDeterministicAnalysis ? 'avec un système DÉTERMINISTE et AUDITABLE' : ''}. Tu aides les recruteurs à :

1. **Configurer les critères d'analyse** : expliquer l'importance de différents critères, suggérer des critères pertinents selon le poste
2. **Comprendre les analyses** : expliquer les scores, les recommandations, et justifier les décisions
3. **Comparer des candidats** : mettre en perspective les profils selon les critères définis
4. **Affiner l'évaluation** : proposer des ajustements aux critères selon les besoins spécifiques

${useDeterministicAnalysis ? `5. **Expliquer le système déterministe** :
   - Must-have: règles obligatoires (critique = rejet si non satisfait)
   - Pertinence des expériences: DIRECTE (même métier), ADJACENTE (compétences transférables), PÉRIPHÉRIQUE (même secteur), NON_PERTINENTE
   - Score calculé mathématiquement: overall = 100 * (w_exp*score_exp + w_skills*skills/100 + w_nice*nice/100)
   - Preuves: chaque décision a des quotes et field_path du CV
   - Zéro hallucination: basé uniquement sur les données CV_JSON` : ''}

**PROJET ACTUEL:**
- Nom: ${project.name}
- Poste: ${project.job_title || 'Non spécifié'}
- Description: ${project.description || 'Non spécifiée'}
- Exigences: ${project.requirements || 'Non spécifiées'}
${jobSpecInfo}
${criteriaContext}
${candidateContext}

**INSTRUCTIONS:**
- Sois précis et professionnel
- Base tes réponses sur les critères définis
${useDeterministicAnalysis ? '- Explique comment le système déterministe évalue (formules, taxonomie, preuves)' : ''}
- Suggère des améliorations constructives
- Explique clairement tes raisonnements
- Si on te demande d'analyser un candidat spécifique, utilise le contexte fourni
- Si on te demande de suggérer des critères, base-toi sur le poste et les exigences
${useDeterministicAnalysis ? '- Si on te demande pourquoi une expérience est ADJACENTE, explique les compétences transférables' : ''}`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.CM_OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        ...recentMessages,
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantMessage = completion.choices[0].message.content;

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      criteria: activeCriteria
    });

  } catch (error) {
    console.error('Analysis chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
