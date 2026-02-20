'use client'

import { Button } from '@/components/ui/button'
import { LogIn } from 'lucide-react'
import { signInWithGoogle } from '@/app/login/actions'

export function GoogleReLoginButton() {
    return (
        <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                Google再ログイン
            </Button>
        </form>
    )
}
