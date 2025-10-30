import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

export const POST = withAuth(async (request, session) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[setup-db] ⚠️ BLOCKED: Attempted access in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'This route is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[setup-db] ⚠️ DEV ONLY: User ${session.user.id} accessing dev route`);

  try {
    console.log('[setup-db] Setting up database tables...');

    // Create projects table first (it's the most critical for your issue)
    const createProjectsTable = `
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        job_title VARCHAR(255),
        requirements TEXT,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Create candidates table
    const createCandidatesTable = `
      CREATE TABLE IF NOT EXISTS candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID,
        org_id UUID,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        source VARCHAR(100),
        cv_url TEXT,
        cv_filename VARCHAR(255),
        score INTEGER CHECK (score >= 0 AND score <= 100),
        explanation TEXT,
        notes TEXT,
        shortlisted BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'rejected')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Create basic organizations table
    const createOrganizationsTable = `
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'starter',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Create organization_members table
    const createOrgMembersTable = `
      CREATE TABLE IF NOT EXISTS organization_members (
        org_id UUID,
        user_id UUID,
        role VARCHAR(50) NOT NULL DEFAULT 'org_admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (org_id, user_id)
      );
    `;

    // Create profiles table
    const createProfilesTable = `
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        email VARCHAR(255),
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'startup',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    console.log('Creating tables...');

    // Execute all table creation queries
    const queries = [
      createProfilesTable,
      createOrganizationsTable,
      createOrgMembersTable,
      createProjectsTable,
      createCandidatesTable
    ];

    const results = [];
    for (const query of queries) {
      try {
        const { data, error } = await supabaseAdmin.from('_dummy').select('*').limit(0); // Test connection first

        // Since we can't execute raw SQL directly via the client, we'll need to do this differently
        // Let's just try to create a record in projects to see if the table exists
        const { data: testData, error: testError } = await supabaseAdmin
          .from('projects')
          .select('id')
          .limit(1);

        if (testError && testError.message.includes('relation "projects" does not exist')) {
          results.push({ table: 'projects', status: 'missing', error: testError.message });
        } else {
          results.push({ table: 'projects', status: 'exists' });
        }

      } catch (err: any) {
        results.push({ query, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database setup check completed',
      results: results,
      manual_sql: {
        profiles: createProfilesTable,
        organizations: createOrganizationsTable,
        organization_members: createOrgMembersTable,
        projects: createProjectsTable,
        candidates: createCandidatesTable
      },
      instructions: 'If tables are missing, please run these SQL commands in your Supabase SQL editor'
    });

  } catch (error) {
    console.error('[setup-db] Database setup error:', error);
    return NextResponse.json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});