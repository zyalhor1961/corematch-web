import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { description, jobTitle } = await request.json();

    if (!description) {
      return NextResponse.json(
        { success: false, error: 'Description required' },
        { status: 400 }
      );
    }

    const prompt = `À partir de cette description de poste, génère une liste d'exigences et compétences pertinentes pour le recrutement.

DESCRIPTION DU POSTE:
${description}

TITRE DU POSTE: ${jobTitle || 'Non spécifié'}

Génère une liste structurée d'exigences et compétences en français, formatée comme suit :
• Expérience requise (nombre d'années)
• Compétences techniques spécifiques
• Compétences transversales (soft skills)
• Formations/diplômes requis
• Langues
• Autres exigences pertinentes

Sois précis et réaliste selon le niveau du poste. Utilise des bullet points (•) pour chaque exigence.`;

    const completion = await openai.chat.completions.create({
      model: process.env.CM_OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert RH qui sait extraire les exigences et compétences pertinentes à partir de descriptions de poste. Tu réponds uniquement avec la liste formatée des exigences, sans introduction ni conclusion.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: parseFloat(process.env.CM_TEMPERATURE || '0.7'),
      max_tokens: 800,
    });

    const requirements = completion.choices[0]?.message?.content;

    if (!requirements) {
      throw new Error('No requirements generated');
    }

    return NextResponse.json({
      success: true,
      requirements: requirements.trim()
    });

  } catch (error) {
    console.error('Generate requirements error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate requirements' },
      { status: 500 }
    );
  }
}