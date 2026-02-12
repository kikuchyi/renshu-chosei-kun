import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const origin = requestUrl.origin

    if (code) {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

        if (user) {
            // Check if profile exists
            const { data: profile } = await supabase
                .from('users')
                .select('display_name')
                .eq('id', user.id)
                .single()

            if (!profile) {
                // First time login - create profile
                await supabase.from('users').insert({
                    id: user.id,
                    email: user.email,
                    avatar_url: user.user_metadata?.avatar_url
                })
                return NextResponse.redirect(`${origin}/setup-profile`)
            }

            if (!profile.display_name) {
                // Profile exists but username not set
                return NextResponse.redirect(`${origin}/setup-profile`)
            }
        }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(`${origin}/`)
}
