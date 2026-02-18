'use client'

import React, { useState } from 'react'
import { AvailabilityInput } from '@/components/availability-input'
import { AvailabilityHeatmap } from '@/components/availability-heatmap'
import type { Database } from '@/types/supabase'

type Availability = Database['public']['Tables']['availabilities']['Row']
type PracticeEvent = Database['public']['Tables']['practice_events']['Row']
type BusySlot = Database['public']['Tables']['user_busy_slots']['Row']

interface GroupScheduleManagerProps {
    groupId: string
    userId: string
    availabilities: Availability[]
    practiceEvents: PracticeEvent[]
    busySlots: BusySlot[]
    groupBusySlots: { user_id: string; start_time: string; end_time: string }[]
    calendarEvents: any[]
    startHour: number
    endHour: number
}

export function GroupScheduleManager({
    groupId,
    userId,
    availabilities,
    practiceEvents,
    busySlots,
    groupBusySlots,
    calendarEvents,
    startHour,
    endHour
}: GroupScheduleManagerProps) {
    const [currentDate, setCurrentDate] = useState(new Date())

    return (
        <div className="space-y-8">
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold tracking-tight">予定の入力</h2>
                </div>
                <AvailabilityInput
                    groupId={groupId}
                    userId={userId}
                    availabilities={availabilities}
                    calendarEvents={calendarEvents}
                    groupBusySlots={groupBusySlots}
                    startHour={startHour}
                    endHour={endHour}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                />
            </section>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold tracking-tight">練習日の決定</h2>
                </div>
                <AvailabilityHeatmap
                    groupId={groupId}
                    availabilities={availabilities}
                    practiceEvents={practiceEvents}
                    busySlots={busySlots}
                    calendarEvents={calendarEvents}
                    startHour={startHour}
                    endHour={endHour}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                />
            </section>
        </div>
    )
}
