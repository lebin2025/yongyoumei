/**
 * Supabase 云端数据库配置
 */
const SUPABASE_URL = 'https://mudyanoiaskfrangprww.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZHlhbm9pYXNrZnJhbmdwcnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0Njk4MzksImV4cCI6MjA5ODA0NTgzOX0.cQNntCFW9JKlylqHnCZZrhSqVUML69xhAfOCQRlO-ps';

var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
