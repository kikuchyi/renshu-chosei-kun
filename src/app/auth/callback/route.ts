import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const origin = requestUrl.origin

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || origin

    if (code) {
        const supabase = await createClient()
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('Auth callback error:', error)
            return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error.message)}`)
        }

        const user = data.user
        if (user) {
            // Check if profile exists
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('display_name')
                .eq('id', user.id)
                .single()

            if (profileError || !profile) {
                // First time login - create profile
                await supabase.from('users').insert({
                    id: user.id,
                    email: user.email,
                    avatar_url: user.user_metadata?.avatar_url
                })
                return NextResponse.redirect(`${baseUrl}/setup-profile`)
            }

            if (!profile.display_name) {
                // Profile exists but username not set
                return NextResponse.redirect(`${baseUrl}/setup-profile`)
            }
        }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(`${baseUrl}/`)
}
