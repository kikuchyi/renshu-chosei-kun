import { signInWithGoogle } from './actions'
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
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function LoginPage(props: PageProps) {
    const searchParams = await props.searchParams
    const error = searchParams.error as string | undefined

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-[400px]">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">練習調整くん</CardTitle>
                    <CardDescription>
                        Googleアカウントでログインして続行してください
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-md">
                            エラー: {error}
                        </div>
                    )}
                    <form action={signInWithGoogle}>
                        <Button type="submit" variant="outline" className="w-full py-6 text-lg font-medium border-2 hover:bg-gray-50">
                            <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            Googleでログイン
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col text-center text-sm text-gray-500">
                    <p>Googleカレンダー連携のために必要です</p>
                </CardFooter>
            </Card>
        </div>
    )
}
