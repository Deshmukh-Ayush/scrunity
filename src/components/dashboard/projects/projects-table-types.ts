export interface ProjectTableItem {
  id: string
  name: string
  description: string | null
  status: string
  createdAt: string | Date
  updatedAt: string | Date
  members: {
    id: string
    name: string | null
    email: string
    image: string | null
  }[]
  contractValue: number | null
  currency?: string
  contractStatus: string | null
  deliverableStats: {
    total: number
    approved: number
  }
  healthStatus?: "on_track" | "action_required" | "blocked" | "completed"
}
