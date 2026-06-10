export type UserRole =
  | 'Student'
  | 'Commandant'
  | 'Master'
  | 'Guard'
  | 'Accountant'
  | 'Admin'

export interface NavItem {
  to: string
  label: string
  shortLabel: string
  description: string
}

export interface AuthenticatedUser {
  id: string
  fullName: string
  email: string
  phone: string
  role: UserRole
  roomId: string | null
  mustChangePassword: boolean
  debtAmount: number | null
}

export interface Room {
  id: string
  roomNumber: string
  floor: number
  capacity: number
  occupied: number
  monthlyRate: number
  isUnderRepair: boolean
}

export interface RoomOccupancy {
  floor: number
  rooms: Room[]
}

export interface RoomResident {
  id: string
  fullName: string
  phone: string
  role: string
  debtAmount: number | null
}

export interface RoomDetail extends Room {
  residents: RoomResident[]
}

export interface Ticket {
  id: string
  title: string
  description: string
  category: string
  roomNumber: string
  status: string
  priority: string
  createdBy: string
  contactPhone: string | null
  assignedTo: string | null
  masterNotes: string | null
  createdAt: string
  resolvedAt: string | null
  attachmentIds: string[]
}

export interface TicketAttachment {
  id: string
  fileName: string
  contentType: string
  size: number
  previewUrl: string
}

export interface TicketDetail extends Omit<Ticket, 'attachmentIds'> {
  attachments: TicketAttachment[]
}

export interface TicketCategory {
  id: string
  categoryName: string
  slaHours: number
}

export interface GuestPass {
  id: string
  guestFullName: string
  guestDocument: string
  hostName: string
  accessCode: string
  status: string
  validFrom: string
  validTo: string
}

export interface PassLog {
  id: string
  passId: string
  guestFullName: string
  guardName: string
  entryTime: string | null
  exitTime: string | null
  remarks: string | null
}

export interface Charge {
  id: string
  title: string
  amount: number
  paidAmount: number
  currency: string
  dueDate: string
  isSettled: boolean
}

export interface Payment {
  id: string
  userId: string
  userName: string
  amount: number
  currency: string
  paymentMethod: string
  status: string
  externalReceiptId: string | null
  paidAt: string | null
  receiptFileId: string | null
  chargeId: string | null
}

export interface DormUser {
  id: string
  fullName: string
  email: string
  phone: string
  role: UserRole
  roomId: string | null
  debtAmount: number | null
  mustChangePassword: boolean
  isActive: boolean
}

export interface UserLookup {
  id: string
  fullName: string
  email: string
  phone: string
  role: string
  roomId: string | null
  roomNumber: string | null
  debtAmount: number | null
}

export interface RelocationRequest {
  id: string
  userId: string
  studentName: string
  fromRoomId: string
  fromRoomNumber: string
  toRoomId: string
  toRoomNumber: string
  reason: string
  status: string
  reviewComment: string | null
}

export interface Violation {
  id: string
  userId: string
  studentName: string
  roomId: string | null
  roomNumber: string | null
  severity: string
  description: string
  recordedBy: string
  occurredAt: string
}

export interface UploadedFile {
  id: string
  fileName: string
  contentType: string
  size: number
  ownerModule: string
  ownerEntityId: string | null
}

export interface NotificationItem {
  id: string
  title: string
  description: string
  tone: string
  createdAt: string
}

export interface NotificationFeed {
  items: NotificationItem[]
  unreadCount: number
}

export interface RoleDirectory {
  id: string
  name: string
  description: string
}

export interface CreateDormUserPayload {
  fullName: string
  email: string
  phone: string
  role: string
  roomId?: string | null
  tariffId?: string | null
}

export interface Tariff {
  id: string
  name: string
  monthlyRate: number
  floor: number | null
  isDefault: boolean
}
