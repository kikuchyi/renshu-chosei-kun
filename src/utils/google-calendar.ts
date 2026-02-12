export interface CalendarEvent {
    id: string
    summary: string
    start: {
        dateTime?: string
        date?: string
    }
    end: {
        dateTime?: string
        date?: string
    }
}

export async function listEvents(accessToken: string, timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
    })

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    if (!response.ok) {
        const error = await response.json()
        console.error('Error fetching calendar events:', error)
        throw new Error('Googleカレンダーの取得に失敗しました')
    }

    const data = await response.json()
    return data.items || []
}
