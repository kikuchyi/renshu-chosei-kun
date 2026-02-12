import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function VerifyEmailPage() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>メールを確認してください</CardTitle>
                    <CardDescription>
                        確認リンクを送信しました。メールを確認し、リンクをクリックしてアカウントを有効化してください。
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                    <Button asChild variant="outline">
                        <Link href="/login">ログイン画面に戻る</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
