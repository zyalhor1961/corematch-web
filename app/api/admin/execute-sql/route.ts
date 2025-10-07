import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { sql } = await request.json();

    if (!sql) {
      return NextResponse.json(
        { error: 'SQL query is required' },
        { status: 400 }
      );
    }

    console.log('Executing SQL:', sql);

    // Execute the SQL directly using the admin client
    const { data, error } = await supabaseAdmin
      .rpc('exec_sql', { sql });

    if (error) {
      console.error('SQL execution error:', error);
      return NextResponse.json(
        { error: 'SQL execution failed', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: data,
      message: 'SQL executed successfully'
    });

  } catch (error) {
    console.error('Execute SQL error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}