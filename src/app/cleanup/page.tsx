import { createClient } from '@/utils/supabase/server'
import { deleteCleanupEvent } from '@/app/actions'
import { redirect } from 'next/navigation'

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic'

export default async function CleanupPage() {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    const { data: events } = await supabase.from('practice_events').select('*').order('start_time')

    return (
        <div className="p-10 font-sans">
            <h1 className="text-2xl font-bold mb-6">データクリーンアップ (Practice Events)</h1>
            <p className="mb-4 text-gray-600">削除したいデータの「削除」ボタンを押してください。</p>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border border-gray-300 p-2 text-left">日時 (JST)</th>
                            <th className="border border-gray-300 p-2 text-left">Group ID</th>
                            <th className="border border-gray-300 p-2 text-left">Event ID</th>
                            <th className="border border-gray-300 p-2 text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events?.map(event => (
                            <tr key={event.id} className="hover:bg-gray-50">
                                <td className="border border-gray-300 p-2">
                                    {new Date(event.start_time).toLocaleString('ja-JP')}
                                    <br />
                                    <span className="text-xs text-gray-500">UTC: {event.start_time}</span>
                                </td>
                                <td className="border border-gray-300 p-2 text-xs font-mono">{event.group_id}</td>
                                <td className="border border-gray-300 p-2 text-xs font-mono">{event.id}</td>
                                <td className="border border-gray-300 p-2 text-center">
                                    <form action={deleteCleanupEvent.bind(null, event.id)}>
                                        <button
                                            type="submit"
                                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-1 rounded text-sm transition-colors"
                                            onClick={(e) => {
                                                if (!confirm('本当に削除しますか？')) e.preventDefault()
                                            }}
                                        >
                                            削除
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {(!events || events.length === 0) && (
                            <tr>
                                <td colSpan={4} className="border border-gray-300 p-4 text-center text-gray-500">
                                    データがありません
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-8">
                <a href="/" className="text-blue-600 hover:underline">← ダッシュボードに戻る</a>
            </div>
        </div>
    )
}
