'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function signInWithGoogle() {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
            scopes: 'https://www.googleapis.com/auth/calendar.readonly',
            redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`,
        },
    })

    if (error) {
        redirect('/error?message=' + encodeURIComponent(error.message))
    }

    if (data.url) {
        redirect(data.url)
    }
}
