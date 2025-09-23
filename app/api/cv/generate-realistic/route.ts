import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import jsPDF from 'jspdf';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface CVData {
  name: string;
  email: string;
  phone: string;
  address: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    period: string;
    description: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    period: string;
  }>;
  skills: string[];
  languages: string[];
}

function generatePDF(cvData: CVData): Buffer {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (yPos + requiredHeight > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  };

  // Helper function to wrap text
  const wrapText = (text: string, maxWidth: number, fontSize: number = 11) => {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxWidth);
  };

  // Header with name
  doc.setFontSize(24);
  doc.setTextColor(30, 64, 175); // Blue color
  doc.text(cvData.name, margin, yPos);
  yPos += 15;

  // Contact info
  doc.setFontSize(11);
  doc.setTextColor(102, 102, 102); // Gray color
  doc.text(`${cvData.email} • ${cvData.phone}`, margin, yPos);
  yPos += 6;
  doc.text(cvData.address, margin, yPos);
  yPos += 15;

  // Line separator
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(2);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Professional Summary
  checkPageBreak(30);
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text('PROFIL PROFESSIONNEL', margin, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setTextColor(51, 51, 51);
  const summaryLines = wrapText(cvData.summary, contentWidth);
  summaryLines.forEach((line: string) => {
    checkPageBreak(6);
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  yPos += 10;

  // Experience
  checkPageBreak(30);
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text('EXPÉRIENCE PROFESSIONNELLE', margin, yPos);
  yPos += 10;

  cvData.experience.forEach(exp => {
    checkPageBreak(40);
    
    // Job title
    doc.setFontSize(12);
    doc.setTextColor(55, 65, 81);
    doc.text(exp.title, margin, yPos);
    yPos += 7;

    // Company and period
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(`${exp.company} • ${exp.period}`, margin, yPos);
    yPos += 8;

    // Descriptions
    doc.setTextColor(51, 51, 51);
    exp.description.forEach(desc => {
      checkPageBreak(6);
      doc.text('• ' + desc, margin + 5, yPos);
      yPos += 6;
    });
    yPos += 8;
  });

  // Education
  checkPageBreak(30);
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text('FORMATION', margin, yPos);
  yPos += 10;

  cvData.education.forEach(edu => {
    checkPageBreak(20);
    
    doc.setFontSize(12);
    doc.setTextColor(55, 65, 81);
    doc.text(edu.degree, margin, yPos);
    yPos += 7;

    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(`${edu.school} • ${edu.period}`, margin, yPos);
    yPos += 10;
  });

  // Skills
  checkPageBreak(30);
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text('COMPÉTENCES TECHNIQUES', margin, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setTextColor(51, 51, 51);
  const skillsText = cvData.skills.join(' • ');
  const skillsLines = wrapText(skillsText, contentWidth);
  skillsLines.forEach((line: string) => {
    checkPageBreak(6);
    doc.text(line, margin, yPos);
    yPos += 6;
  });
  yPos += 10;

  // Languages
  checkPageBreak(20);
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175);
  doc.text('LANGUES', margin, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.setTextColor(51, 51, 51);
  const languagesText = cvData.languages.join(' • ');
  doc.text(languagesText, margin, yPos);

  return Buffer.from(doc.output('arraybuffer'));
}

async function generateCVWithOpenAI(jobTitle: string, variation: number): Promise<CVData> {
  const prompt = `Génère un CV réaliste et professionnel pour un ${jobTitle}. 
  
  IMPORTANT: Crée une variation ${variation}/10 - chaque CV doit être différent mais du même niveau de compétence.
  
  Variables à faire varier légèrement:
  - Nom et coordonnées (français)
  - Années d'expérience (entre 3-8 ans)
  - Technologies/compétences spécifiques 
  - Entreprises précédentes (réalistes françaises)
  - Détails des accomplishments
  - Formation (écoles d'ingénieur françaises variées)
  
  Maintiens la cohérence et le professionnalisme. Fournis la réponse en JSON avec cette structure exacte:
  {
    "name": "Prénom Nom",
    "email": "prenom.nom@email.com", 
    "phone": "+33 6 XX XX XX XX",
    "address": "Ville, France",
    "summary": "Résumé professionnel de 2-3 lignes",
    "experience": [
      {
        "title": "Titre du poste",
        "company": "Nom de l'entreprise",
        "period": "Mois YYYY - Mois YYYY",
        "description": ["Accomplissement 1", "Accomplissement 2", "Accomplissement 3"]
      }
    ],
    "education": [
      {
        "degree": "Diplôme",
        "school": "École/Université", 
        "period": "YYYY - YYYY"
      }
    ],
    "skills": ["Compétence1", "Compétence2", "etc"],
    "languages": ["Français (natif)", "Anglais (courant)", "etc"]
  }`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Tu es un expert RH qui crée des CVs réalistes et professionnels. Réponds uniquement avec du JSON valide, sans markdown ni texte supplémentaire."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8, // Plus de variabilité
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    // Nettoie le JSON s'il y a du markdown
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error generating CV with OpenAI:', error);
    throw error;
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, jobTitle, count = 10, prompt, type } = body;

    // Si c'est une demande de génération de texte simple (pour l'assistance IA)
    if (prompt && type) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "Tu es un assistant RH expert qui aide à créer des offres d'emploi professionnelles. Réponds directement avec le texte demandé, sans markdown ni formatage supplémentaire."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Pas de contenu généré par l\'IA');
        }

        return NextResponse.json({
          success: true,
          content: content.trim(),
          type: type
        });
      } catch (error) {
        console.error('AI text generation error:', error);
        return NextResponse.json(
          { success: false, error: 'Erreur lors de la génération IA' },
          { status: 500 }
        );
      }
    }

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID required' },
        { status: 400 }
      );
    }

    if (!jobTitle) {
      return NextResponse.json(
        { success: false, error: 'Job title required' },
        { status: 400 }
      );
    }

    const results = [];

    for (let i = 1; i <= count; i++) {
      try {
        console.log(`Generating CV ${i}/${count} for ${jobTitle}...`);
        
        // Générer le CV avec OpenAI
        const cvData = await generateCVWithOpenAI(jobTitle, i);
        
        // Générer le PDF
        const pdfBuffer = generatePDF(cvData);
        
        // Upload vers Supabase Storage
        const fileName = `${cvData.name.replace(/\s+/g, '_').toLowerCase()}_cv.pdf`;
        const filePath = `${projectId}/${Date.now()}_${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('cv')
          .upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Récupérer l'org_id du projet
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('org_id')
          .eq('id', projectId)
          .single();

        if (projectError) {
          console.error('Project fetch error:', projectError);
          continue;
        }

        // Sauvegarder le candidat en base
        const { data: candidateData, error: candidateError } = await supabase
          .from('candidates')
          .insert([{
            org_id: projectData.org_id,
            project_id: projectId,
            first_name: cvData.name.split(' ')[0],
            last_name: cvData.name.split(' ').slice(1).join(' '),
            email: cvData.email,
            phone: cvData.phone,
            status: 'pending',
            cv_filename: fileName,
            notes: `CV file: ${fileName}|Path: ${filePath}|Generated with OpenAI|Summary: ${cvData.summary}`,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (candidateError) {
          console.error('Database error:', candidateError);
          continue;
        }

        results.push({
          candidateId: candidateData.id,
          name: cvData.name,
          fileName: fileName,
          filePath: filePath
        });

        console.log(`✓ Generated CV ${i}/${count}: ${cvData.name}`);
        
        // Petit délai pour éviter les rate limits
        if (i < count) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`Error generating CV ${i}:`, error);
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${results.length}/${count} realistic CVs`,
      data: results
    });

  } catch (error) {
    console.error('Generate realistic CVs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate realistic CVs' },
      { status: 500 }
    );
  }
}