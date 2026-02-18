import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DeleteAccountButton } from '@/components/delete-account-button'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    async function updateProfile(formData: FormData) {
        'use server'
        const displayName = formData.get('displayName') as string
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return

        const { error } = await supabase
            .from('users')
            .update({ display_name: displayName })
            .eq('id', user.id)

        if (error) {
            console.error('Error updating profile:', error)
            return
        }

        revalidatePath('/', 'layout')
        redirect('/')
    }

    return (
        <div className="container mx-auto py-10 px-4">
            <Button variant="ghost" asChild className="mb-6 pl-0 hover:bg-transparent">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    ダッシュボードに戻る
                </Link>
            </Button>

            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl">アカウント設定</CardTitle>
                    <CardDescription>
                        プロフィール情報を更新できます。
                    </CardDescription>
                </CardHeader>
                <form action={updateProfile}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">ユーザー名</Label>
                            <Input
                                id="displayName"
                                name="displayName"
                                defaultValue={profile?.display_name || ''}
                                required
                                minLength={2}
                                maxLength={20}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>メールアドレス</Label>
                            <Input value={user.email} disabled className="bg-gray-50" />
                            <p className="text-xs text-muted-foreground">
                                メールアドレスは変更できません。
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full">更新する</Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Danger Zone */}
            <div className="max-w-md mx-auto mt-8 p-4 border border-red-200 rounded-lg bg-red-50/50">
                <h3 className="text-sm font-medium text-red-800 mb-3">危険な操作</h3>
                <DeleteAccountButton />
            </div>
        </div>
    )
}
