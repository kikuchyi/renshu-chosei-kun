'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { updateProfile } from '@/app/actions'
import { toast } from 'sonner'

export default function SetupProfilePage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        try {
            await updateProfile(formData)
            toast.success('プロフィールを更新しました')
            router.push('/')
            router.refresh()
        } catch (error) {
            console.error('Error updating profile:', error)
            toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
        } finally {
            setIsLoading(false)
        }
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
                <form action={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="displayName">ユーザー名</Label>
                            <Input
                                id="displayName"
                                name="displayName"
                                placeholder="例: 山田 太郎"
                                required
                                minLength={2}
                                maxLength={20}
                                disabled={isLoading}
                            />
                            <p className="text-xs text-muted-foreground">
                                この名前はグループのメンバー一覧に表示されます。
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? '保存中...' : 'はじめる'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
