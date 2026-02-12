'use client'

import React from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy } from 'lucide-react'
import type { Database } from '@/types/supabase'

type Group = Database['public']['Tables']['groups']['Row']

export function GroupList({ groups }: { groups: Group[] }) {
    if (groups.length === 0) {
        return (
            <div className="text-center p-8 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900">グループがまだありません</h3>
                <p className="text-gray-500 mt-1">グループを作成するか、既存のグループに参加してください。</p>
            </div>
        )
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('招待コードをコピーしました')
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
                <Card key={group.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            <Link href={`/groups/${group.id}`} className="hover:underline">
                                {group.name}
                            </Link>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span>Code: {group.invite_code}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(group.invite_code)}
                            >
                                <Copy className="h-3 w-3" />
                                <span className="sr-only">Copy invite code</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
