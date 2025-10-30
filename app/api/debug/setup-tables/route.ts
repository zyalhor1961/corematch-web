import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    console.log('Setting up missing tables...');

    // Create organizations table
    const createOrganizationsTable = `
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );
    `;

    // Create organization_members table
    const createOrganizationMembersTable = `
      CREATE TABLE IF NOT EXISTS organization_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'org_member' CHECK (role IN ('org_admin', 'org_manager', 'org_member')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        UNIQUE(org_id, user_id)
      );
    `;

    // Create projects table
    const createProjectsTable = `
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        job_title TEXT,
        requirements TEXT,
        created_by UUID REFERENCES profiles(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );
    `;

    // Create candidates table
    const createCandidatesTable = `
      CREATE TABLE IF NOT EXISTS candidates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT,
        email TEXT,
        phone TEXT,
        notes TEXT,
        score DECIMAL(5,2),
        recommendation TEXT,
        analysis JSONB,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'rejected')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );
    `;

    // Create my_orgs view
    const createMyOrgsView = `
      CREATE OR REPLACE VIEW my_orgs AS
      SELECT 
        o.id,
        o.name as org_name,
        o.plan,
        o.status,
        om.role,
        om.user_id,
        om.created_at as joined_at
      FROM organizations o
      JOIN organization_members om ON o.id = om.org_id;
    `;

    console.log('Executing SQL commands...');

    // Execute all SQL commands
    const { error: orgError } = await supabaseAdmin.rpc('exec_sql', { 
      sql: createOrganizationsTable 
    });

    const { error: memberError } = await supabaseAdmin.rpc('exec_sql', { 
      sql: createOrganizationMembersTable 
    });

    const { error: projectError } = await supabaseAdmin.rpc('exec_sql', { 
      sql: createProjectsTable 
    });

    const { error: candidateError } = await supabaseAdmin.rpc('exec_sql', { 
      sql: createCandidatesTable 
    });

    const { error: viewError } = await supabaseAdmin.rpc('exec_sql', { 
      sql: createMyOrgsView 
    });

    // Alternative method using direct SQL execution
    if (orgError || memberError || projectError || candidateError || viewError) {
      console.log('RPC method failed, trying direct execution...');
      
      try {
        await supabaseAdmin.from('_temp').select('*').limit(1); // Test connection
        
        // Since direct SQL execution might not work, let's use a different approach
        // Create tables using insert operations on system tables (not recommended but might work)
        
        return NextResponse.json({
          success: false,
          message: 'Need manual table creation',
          errors: {
            orgError: orgError?.message,
            memberError: memberError?.message,
            projectError: projectError?.message,
            candidateError: candidateError?.message,
            viewError: viewError?.message
          },
          sql_commands: {
            organizations: createOrganizationsTable,
            organization_members: createOrganizationMembersTable,
            projects: createProjectsTable,
            candidates: createCandidatesTable,
            my_orgs_view: createMyOrgsView
          }
        });
        
      } catch (directError) {
        return NextResponse.json({
          success: false,
          error: 'Cannot execute SQL directly',
          message: 'Tables need to be created manually in Supabase dashboard',
          sql_commands: {
            organizations: createOrganizationsTable,
            organization_members: createOrganizationMembersTable,
            projects: createProjectsTable,
            candidates: createCandidatesTable,
            my_orgs_view: createMyOrgsView
          }
        }, { status: 500 });
      }
    }

    console.log('Tables created successfully');

    return NextResponse.json({
      success: true,
      message: 'All tables created successfully',
      tables_created: [
        'organizations',
        'organization_members',
        'projects', 
        'candidates',
        'my_orgs (view)'
      ]
    });

  } catch (error) {
    console.error('Setup tables error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Setup failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}