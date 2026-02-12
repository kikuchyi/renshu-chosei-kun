'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
    const searchParams = useSearchParams()
    const message = searchParams.get('message')

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">エラー</h1>
                <p className="text-gray-700 mb-6">
                    {message || '申し訳ありません、問題が発生しました。'}
                </p>
                <a
                    href="/login"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                >
                    ログイン画面に戻る
                </a>
            </div>
        </div>
    )
}

export default function ErrorPage() {
    return (
        <Suspense fallback={<p>Loading...</p>}>
            <ErrorContent />
        </Suspense>
    )
}
