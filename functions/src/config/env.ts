export interface AppConfig {
  supabaseUrl?: string;
  supabaseKey?: string; // anon or service key
  supabaseEvaluacionesTable?: string;
}

export function getConfig(): AppConfig {
  return {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    supabaseEvaluacionesTable: process.env.SUPABASE_EVALUACIONES_TABLE,
  };
}


