import { createClient } from '@supabase/supabase-js'

// استدعاء المفاتيح من ملف الـ .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// إنشاء الاتصال
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
