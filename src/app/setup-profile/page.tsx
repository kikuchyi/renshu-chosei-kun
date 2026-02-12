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

export default async function SetupProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

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
        <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">プロフィール設定</CardTitle>
                    <CardDescription>
                        アプリ内で表示されるユーザー名を設定してください。
                    </CardDescription>
                </CardHeader>
                <form action={updateProfile}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">ユーザー名</Label>
                            <Input
                                id="displayName"
                                name="displayName"
                                placeholder="例: Yamada Tarou"
                                required
                                minLength={2}
                                maxLength={20}
                            />
                            <p className="text-xs text-muted-foreground">
                                この名前はグループのメンバー一覧に表示されます。
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full">はじめる</Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
