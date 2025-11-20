/**
 * Common Storage Nodes
 * Reusable nodes for database operations
 */

import type { NodeFunction } from '../../core/types';

/**
 * Store document in Supabase
 */
export const storeDocument: NodeFunction<
  {
    table: string;
    data: Record<string, any>;
    orgId: string;
    userId?: string;
  },
  { documentId: string; created: boolean }
> = async (state, input) => {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { table, data, orgId, userId } = input;

    // Add org_id and user_id to data
    const recordData = {
      ...data,
      org_id: orgId,
      ...(userId && { user_id: userId }),
    };

    const { data: record, error } = await supabase
      .from(table)
      .insert(recordData)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Supabase insert error: ${error.message}`);
    }

    const documentId = record?.id;

    return {
      success: true,
      data: {
        documentId,
        created: true,
      },
      stateUpdates: {
        documentId,
        storedInTable: table,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document storage failed',
    };
  }
};

/**
 * Update document in Supabase
 */
export const updateDocument: NodeFunction<
  {
    table: string;
    documentId: string;
    updates: Record<string, any>;
    orgId: string;
  },
  { updated: boolean }
> = async (state, input) => {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { table, documentId, updates, orgId } = input;

    const { error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', documentId)
      .eq('org_id', orgId);

    if (error) {
      throw new Error(`Supabase update error: ${error.message}`);
    }

    return {
      success: true,
      data: { updated: true },
      stateUpdates: {
        documentUpdated: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document update failed',
    };
  }
};

/**
 * Delete document from Supabase
 */
export const deleteDocument: NodeFunction<
  {
    table: string;
    documentId: string;
    orgId: string;
  },
  { deleted: boolean }
> = async (state, input) => {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { table, documentId, orgId } = input;

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', documentId)
      .eq('org_id', orgId);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }

    return {
      success: true,
      data: { deleted: true },
      stateUpdates: {
        documentDeleted: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document deletion failed',
    };
  }
};

/**
 * Query documents from Supabase
 */
export const queryDocuments: NodeFunction<
  {
    table: string;
    orgId: string;
    filters?: Record<string, any>;
    orderBy?: string;
    limit?: number;
  },
  { documents: any[]; count: number }
> = async (state, input) => {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { table, orgId, filters = {}, orderBy, limit = 100 } = input;

    let query = supabase.from(table).select('*').eq('org_id', orgId);

    // Apply filters
    for (const [field, value] of Object.entries(filters)) {
      query = query.eq(field, value);
    }

    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy, { ascending: false });
    }

    // Apply limit
    query = query.limit(limit);

    const { data: documents, error } = await query;

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    return {
      success: true,
      data: {
        documents: documents || [],
        count: documents?.length || 0,
      },
      stateUpdates: {
        queriedDocuments: documents,
        documentCount: documents?.length || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document query failed',
    };
  }
};

/**
 * Store file in Supabase Storage
 */
export const storeFile: NodeFunction<
  {
    bucket: string;
    path: string;
    fileBuffer: ArrayBuffer;
    contentType: string;
    orgId: string;
  },
  { publicUrl: string; path: string }
> = async (state, input) => {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { bucket, path, fileBuffer, contentType, orgId } = input;

    // Upload file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Storage upload error: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      success: true,
      data: {
        publicUrl,
        path: data.path,
      },
      stateUpdates: {
        fileUrl: publicUrl,
        filePath: data.path,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'File storage failed',
    };
  }
};

/**
 * Delete file from Supabase Storage
 */
export const deleteFile: NodeFunction<
  {
    bucket: string;
    path: string;
  },
  { deleted: boolean }
> = async (state, input) => {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { bucket, path } = input;

    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      throw new Error(`Storage delete error: ${error.message}`);
    }

    return {
      success: true,
      data: { deleted: true },
      stateUpdates: {
        fileDeleted: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'File deletion failed',
    };
  }
};

/**
 * Batch insert records
 */
export const batchInsert: NodeFunction<
  {
    table: string;
    records: Record<string, any>[];
    orgId: string;
    batchSize?: number;
  },
  { inserted: number; failed: number }
> = async (state, input) => {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { table, records, orgId, batchSize = 100 } = input;

    let inserted = 0;
    let failed = 0;

    // Add org_id to all records
    const recordsWithOrgId = records.map((r) => ({ ...r, org_id: orgId }));

    // Process in batches
    for (let i = 0; i < recordsWithOrgId.length; i += batchSize) {
      const batch = recordsWithOrgId.slice(i, i + batchSize);

      const { data, error } = await supabase.from(table).insert(batch).select('id');

      if (error) {
        console.error(`Batch insert error:`, error);
        failed += batch.length;
      } else {
        inserted += data?.length || 0;
      }
    }

    return {
      success: true,
      data: { inserted, failed },
      stateUpdates: {
        batchInsertResults: { inserted, failed },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Batch insert failed',
    };
  }
};

/**
 * Execute raw SQL query (use with caution)
 */
export const executeSQL: NodeFunction<
  {
    query: string;
    params?: any[];
  },
  { rows: any[]; count: number }
> = async (state, input) => {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { query, params = [] } = input;

    // Note: Supabase client doesn't support raw SQL directly
    // This would require using a Postgres client or stored procedure
    // For now, return an error
    throw new Error('Raw SQL execution not supported via Supabase client. Use stored procedures instead.');
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SQL execution failed',
    };
  }
};
