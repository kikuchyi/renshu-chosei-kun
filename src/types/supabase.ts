export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    email: string | null
                    display_name: string | null
                    avatar_url: string | null
                    created_at: string
                }
                Insert: {
                    id: string
                    email?: string | null
                    display_name?: string | null
                    avatar_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    email?: string | null
                    display_name?: string | null
                    avatar_url?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "users_id_fkey"
                        columns: ["id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            groups: {
                Row: {
                    id: string
                    name: string
                    invite_code: string
                    created_by: string
                    created_at: string
                    start_hour: number
                    end_hour: number
                }
                Insert: {
                    id?: string
                    name: string
                    invite_code?: string
                    created_by: string
                    created_at?: string
                    start_hour?: number
                    end_hour?: number
                }
                Update: {
                    id?: string
                    name?: string
                    invite_code?: string
                    created_by?: string
                    created_at?: string
                    start_hour?: number
                    end_hour?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "groups_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            group_members: {
                Row: {
                    group_id: string
                    user_id: string
                    role: 'admin' | 'member'
                    joined_at: string
                }
                Insert: {
                    group_id: string
                    user_id: string
                    role?: 'admin' | 'member'
                    joined_at?: string
                }
                Update: {
                    group_id?: string
                    user_id?: string
                    role?: 'admin' | 'member'
                    joined_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "group_members_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: false
                        referencedRelation: "groups"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "group_members_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            availabilities: {
                Row: {
                    id: string
                    user_id: string
                    group_id: string
                    start_time: string
                    end_time: string
                    priority: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    group_id: string
                    start_time: string
                    end_time: string
                    priority?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    group_id?: string
                    start_time?: string
                    end_time?: string
                    priority?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "availabilities_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: false
                        referencedRelation: "groups"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "availabilities_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            practice_events: {
                Row: {
                    id: string
                    group_id: string
                    start_time: string
                    end_time: string
                    created_by: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    group_id: string
                    start_time: string
                    end_time: string
                    created_by: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    group_id?: string
                    start_time?: string
                    end_time?: string
                    created_by?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "practice_events_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: false
                        referencedRelation: "groups"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "practice_events_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_busy_slots: {
                Row: {
                    id: string
                    user_id: string
                    start_time: string
                    end_time: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    start_time: string
                    end_time: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    start_time?: string
                    end_time?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_busy_slots_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
