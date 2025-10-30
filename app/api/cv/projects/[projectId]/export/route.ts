import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const type = searchParams.get('type') || 'all';

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 });
    }

    let query = supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('project_id', projectId);

    if (type === 'shortlist') {
      query = query.ilike('notes', '%SÉLECTIONNÉ%');
    }

    const { data: candidates } = await query;

    const exportData = (candidates || []).map(candidate => {
      const notes = candidate.notes || '';
      
      // Extract analysis data from notes
      const scoreMatch = notes.match(/Score: (\d+)\/100/);
      const recommendationMatch = notes.match(/Recommandation: ([^\n]+)/);
      const summaryMatch = notes.match(/Résumé: ([^\n]+)/);
      const shortlistMatch = notes.match(/Statut: (SÉLECTIONNÉ|NON RETENU)/);
      const rankMatch = notes.match(/Rang: (\d+)/);
      const justificationMatch = notes.match(/Justification: ([^\n]+)/);
      const fileMatch = notes.match(/CV file: ([^|\n]+)/);
      
      return {
        'Nom': candidate.first_name || 'Candidat',
        'Email': candidate.email || '',
        'Téléphone': candidate.phone || '',
        'Fichier CV': fileMatch?.[1]?.trim() || '',
        'Date Upload': new Date(candidate.created_at).toLocaleDateString('fr-FR'),
        'Statut Analyse': candidate.status === 'analyzed' ? 'Analysé' : 
                         candidate.status === 'processing' ? 'En cours' : 'En attente',
        'Score IA': scoreMatch ? scoreMatch[1] : '',
        'Recommandation': recommendationMatch?.[1] || '',
        'Résumé': summaryMatch?.[1] || '',
        'Shortlist': shortlistMatch?.[1] || '',
        'Rang': rankMatch?.[1] || '',
        'Justification': justificationMatch?.[1] || ''
      };
    });

    const filename = `${project.name}-export-${Date.now()}`;

    if (format === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidats');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
    } else {
      // Generate CSV with proper escaping
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row];
            // Escape values containing commas, quotes, or newlines
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Add BOM for Excel UTF-8 recognition
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csvContent;

      return new NextResponse(csvWithBOM, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Erreur export' }, { status: 500 });
  }
}