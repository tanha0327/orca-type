import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 環境変数が無い環境（ローカルの未設定時など）でもアプリ全体は動くように、null を許容する */
export const supabase = url && anonKey ? createClient(url, anonKey) : null
