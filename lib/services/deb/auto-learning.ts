/**
 * DEB Auto-Learning Service
 *
 * Records user-validated HS codes and weights into reference database
 * for future automatic enrichment.
 */

import { supabaseAdmin } from '@/lib/supabase/server';

export interface LearningRecord {
  orgId: string;
  description: string;
  hsCode: string;
  weightKg: number;
  sku?: string;
  countryOfOrigin?: string;
  validatedBy: string;
}

export interface LearningStats {
  totalArticles: number;
  userValidatedCount: number;
  aiSuggestedCount: number;
  avgConfidence: number;
  totalValidations: number;
}

/**
 * Record a user validation into the reference database
 * This is called after a user validates/corrects an HS code
 */
export async function recordValidation(
  record: LearningRecord
): Promise<{ success: boolean; message: string; isNew: boolean }> {
  try {
    const normalized = record.description.toLowerCase().trim();

    // Check if record already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('deb_article_reference')
      .select('id, validation_count, confidence_score')
      .eq('org_id', record.orgId)
      .eq('description_normalized', normalized)
      .single();

    let isNew = false;

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('deb_article_reference')
        .update({
          description: record.description,
          hs_code: record.hsCode,
          weight_net_kg: record.weightKg,
          sku: record.sku,
          country_of_origin: record.countryOfOrigin,
          source: 'user_validated',
          last_validated_at: new Date().toISOString()
          // validation_count and confidence_score will be incremented by trigger
        })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        message: `Updated existing reference (validation #${existing.validation_count + 1})`,
        isNew: false
      };
    } else {
      // Insert new record
      const { error: insertError } = await supabaseAdmin
        .from('deb_article_reference')
        .insert({
          org_id: record.orgId,
          description: record.description,
          description_normalized: normalized,
          hs_code: record.hsCode,
          weight_net_kg: record.weightKg,
          sku: record.sku,
          country_of_origin: record.countryOfOrigin,
          source: 'user_validated',
          confidence_score: 1.0000,
          validation_count: 1,
          created_by: record.validatedBy
        });

      if (insertError) {
        throw insertError;
      }

      isNew = true;

      return {
        success: true,
        message: 'New article added to reference database',
        isNew: true
      };
    }
  } catch (error: any) {
    console.error('Error recording validation:', error);
    return {
      success: false,
      message: `Failed to record validation: ${error.message}`,
      isNew: false
    };
  }
}

/**
 * Batch record multiple validations
 * Useful when user validates multiple lines at once
 */
export async function batchRecordValidations(
  records: LearningRecord[]
): Promise<{
  success: boolean;
  results: Array<{ description: string; success: boolean; message: string }>;
}> {
  const results = [];

  for (const record of records) {
    const result = await recordValidation(record);
    results.push({
      description: record.description,
      success: result.success,
      message: result.message
    });
  }

  const allSuccess = results.every(r => r.success);

  return {
    success: allSuccess,
    results
  };
}

/**
 * Get learning statistics for an organization
 */
export async function getLearningStats(orgId: string): Promise<LearningStats | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('deb_article_learning_stats')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      totalArticles: data.total_articles,
      userValidatedCount: data.user_validated_count,
      aiSuggestedCount: data.ai_suggested_count,
      avgConfidence: data.avg_confidence,
      totalValidations: data.total_validations
    };
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    return null;
  }
}

/**
 * Get all reference articles for an organization
 * Useful for export or review
 */
export async function getArticleReference(
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
    sortBy?: 'confidence' | 'validations' | 'recent';
    minConfidence?: number;
  } = {}
): Promise<{
  articles: Array<{
    id: string;
    description: string;
    sku?: string;
    hsCode: string;
    weightKg: number;
    confidence: number;
    validationCount: number;
    source: string;
    lastValidated: string;
  }>;
  total: number;
}> {
  try {
    let query = supabaseAdmin
      .from('deb_article_reference')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId);

    // Apply filters
    if (options.minConfidence !== undefined) {
      query = query.gte('confidence_score', options.minConfidence);
    }

    // Apply sorting
    switch (options.sortBy) {
      case 'confidence':
        query = query.order('confidence_score', { ascending: false });
        break;
      case 'validations':
        query = query.order('validation_count', { ascending: false });
        break;
      case 'recent':
        query = query.order('last_validated_at', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const articles = (data || []).map(item => ({
      id: item.id,
      description: item.description,
      sku: item.sku,
      hsCode: item.hs_code,
      weightKg: item.weight_net_kg,
      confidence: item.confidence_score,
      validationCount: item.validation_count,
      source: item.source,
      lastValidated: item.last_validated_at
    }));

    return {
      articles,
      total: count || 0
    };
  } catch (error) {
    console.error('Error fetching article reference:', error);
    return {
      articles: [],
      total: 0
    };
  }
}

/**
 * Delete an article from reference database
 * (e.g., if user realizes it was incorrect)
 */
export async function deleteArticleReference(
  orgId: string,
  articleId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('deb_article_reference')
      .delete()
      .eq('id', articleId)
      .eq('org_id', orgId);

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: 'Article deleted from reference database'
    };
  } catch (error: any) {
    console.error('Error deleting article reference:', error);
    return {
      success: false,
      message: `Failed to delete article: ${error.message}`
    };
  }
}

/**
 * Search for similar articles in reference database
 * Useful for suggesting existing entries when user enters new data
 */
export async function searchSimilarArticles(
  orgId: string,
  description: string,
  limit: number = 5
): Promise<Array<{
  id: string;
  description: string;
  hsCode: string;
  weightKg: number;
  confidence: number;
  similarity: number; // Placeholder - would require full-text search
}>> {
  try {
    const searchTerms = description.toLowerCase().trim().split(' ').slice(0, 3);

    const { data, error } = await supabaseAdmin
      .from('deb_article_reference')
      .select('*')
      .eq('org_id', orgId)
      .order('confidence_score', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    // Simple similarity: count matching words
    const results = data
      .map(item => {
        const itemTerms = item.description_normalized.split(' ');
        const matchCount = searchTerms.filter(term =>
          itemTerms.some(itemTerm => itemTerm.includes(term))
        ).length;

        return {
          id: item.id,
          description: item.description,
          hsCode: item.hs_code,
          weightKg: item.weight_net_kg,
          confidence: item.confidence_score,
          similarity: matchCount / searchTerms.length
        };
      })
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  } catch (error) {
    console.error('Error searching similar articles:', error);
    return [];
  }
}

/**
 * Import bulk articles from CSV or external source
 */
export async function bulkImportArticles(
  orgId: string,
  articles: Array<{
    description: string;
    hsCode: string;
    weightKg: number;
    sku?: string;
    countryOfOrigin?: string;
  }>,
  importedBy: string
): Promise<{
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}> {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const article of articles) {
    try {
      const normalized = article.description.toLowerCase().trim();

      await supabaseAdmin
        .from('deb_article_reference')
        .upsert({
          org_id: orgId,
          description: article.description,
          description_normalized: normalized,
          hs_code: article.hsCode,
          weight_net_kg: article.weightKg,
          sku: article.sku,
          country_of_origin: article.countryOfOrigin,
          source: 'imported',
          confidence_score: 0.8000, // Lower confidence for imported
          validation_count: 0,
          created_by: importedBy
        }, {
          onConflict: 'org_id,description_normalized'
        });

      imported++;
    } catch (error: any) {
      failed++;
      errors.push(`${article.description}: ${error.message}`);
    }
  }

  return {
    success: failed === 0,
    imported,
    failed,
    errors
  };
}

/**
 * Export reference database to CSV format
 */
export async function exportReferenceToCSV(orgId: string): Promise<string> {
  const { articles } = await getArticleReference(orgId, { limit: 10000 });

  const headers = [
    'Description',
    'SKU',
    'HS Code',
    'Weight (kg)',
    'Country of Origin',
    'Confidence',
    'Validations',
    'Source',
    'Last Validated'
  ];

  const rows = articles.map(article => [
    `"${article.description.replace(/"/g, '""')}"`,
    article.sku || '',
    article.hsCode,
    article.weightKg.toFixed(3),
    '',
    article.confidence.toFixed(4),
    article.validationCount,
    article.source,
    new Date(article.lastValidated).toISOString().split('T')[0]
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csv;
}
