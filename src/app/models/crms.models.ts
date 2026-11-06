export type UserRole = 'Admin' | 'Faculty' | 'Staff' | 'Student';
export type AppLanguage = 'en' | 'fil';

export type ModuleId =
  | 'overview'
  | 'digital-twin'
  | 'rooms-courses'
  | 'equipment'
  | 'staff'
  | 'student-services'
  | 'events'
  | 'operations'
  | 'analytics'
  | 'security-ecosystem';

export type BuildingName =
  | 'Main Academic Hall'
  | 'Science & Innovation Wing'
  | 'University Sports Complex'
  | 'Student Union Center';

export interface FacilityRoom {
  id: string;
  code: string;
  name: string;
  building: BuildingName;
  floor: number;
  svgX: number;
  svgY: number;
  svgW: number;
  svgH: number;
  capacity: number;
  type: 'Classroom' | 'Laboratory' | 'Auditorium' | 'Study Pod' | 'Sports Court';
  availabilityState: 'Operational' | 'Under Maintenance' | 'Closed';
  unavailabilityReason?: string;
  installedEquipment: string[];
  hourlyCostPhp: number;
  smartLockState: 'Locked' | 'Unlocked' | 'Emergency Open';
  occupancyCount: number;
  energyKw: number;
  hvacTempC: number;
  isSafeZone: boolean;
  safeZoneCapacity?: number;
}

export interface TermCourseAssignment {
  id: string;
  academicTerm: string;
  courseCode: string;
  courseTitle: string;
  department: string;
  instructorId: string;
  instructorName: string;
  enrolledStudents: number;
  requiredEquipment: string[];
  scheduleDays: 'MWF' | 'TTh' | 'Sat';
  startTime: string;
  endTime: string;
  constantRoomId: string;
  relocatedRoomId?: string;
  relocatedDate?: string;
  relocationReason?: string;
  relocationBookingId?: string;
}

export interface ApprovalTimelineStep {
  stage: string;
  actor: string;
  timestamp: string;
  state: 'completed' | 'current' | 'pending' | 'rejected';
}

export interface BookingRecord {
  id: string;
  resourceType: 'Room' | 'Equipment' | 'Event';
  bookingSubtype: 'Ad-Hoc Reservation' | 'Course Room Relocation' | 'Campus Event' | 'Equipment Loan';
  linkedCourseId?: string;
  originalRoomId?: string;
  targetId: string;
  targetName: string;
  title: string;
  category: 'Academic Class' | 'Make-Up / Relocation' | 'Seminar & Symposium' | 'Club Activity' | 'Student Study' | 'Lab Research' | 'Sports Tournament';
  requesterName: string;
  requesterRole: UserRole;
  requesterId: string;
  department: string;
  date: string;
  startTime: string;
  endTime: string;
  attendees: number;
  requiredEquipment: string[];
  status: 'Approved' | 'Pending Approval' | 'Rejected' | 'Checked Out' | 'Completed';
  autoAssigned: boolean;
  fitScore?: number;
  costPhp: number;
  notes?: string;
  createdAt: string;
}

export interface EquipmentAsset {
  id: string;
  assetTag: string;
  serialNumber: string;
  name: string;
  category: 'Laptops' | 'Lab Tools' | 'Sports Gear' | 'Consumables' | 'AV Gear';
  totalQty: number;
  availableQty: number;
  locationRoomId: string;
  condition: 'Optimal' | 'Needs Maintenance' | 'Decommissioned';
  purchaseDate: string;
  purchaseCostPhp: number;
  usefulLifeYears: number;
  salvageValuePhp: number;
  warrantyExpiry: string;
  replacementScheduleDate: string;
  currentHolderBadge?: string;
  currentHolderName?: string;
  dueDate?: string;
  eligibilityRule: 'All Cleared Users' | 'Faculty & Lab Certified Only' | 'Faculty & Staff Only';
}

export interface StaffAssignmentItem {
  id: string;
  title: string;
  type: 'Course Lecture' | 'Lab Supervision' | 'Event Coordination' | 'Facility Operations';
  schedule: string;
  roomCode: string;
  hours: number;
}

export interface StaffMember {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  role: 'Faculty' | 'Lab Technician' | 'Facilities Staff' | 'Security';
  email: string;
  specialization: string;
  maxWeeklyHours: number;
  assignedHours: number;
  availability: 'Available' | 'In Class / Duty' | 'On Leave';
  assignments: StaffAssignmentItem[];
}

export interface StudentProfile {
  id: string;
  studentNumber: string;
  name: string;
  program: string;
  yearLevel: string;
  rfidUid: string;
  qrBadgeId: string;
  clearanceStatus: 'Cleared' | 'Hold - Unpaid Fine' | 'Hold - Overdue Equipment';
  eligibilityTier: 'Standard' | 'Lab Certified' | 'Varsity & Lab Certified';
  outstandingBalancePhp: number;
  activeLoansCount: number;
  dpaConsentSigned: boolean;
}

export interface ServiceRequest {
  id: string;
  studentId: string;
  studentName: string;
  requestType: 'ID Badge Replacement' | 'Lab Access Permission' | 'Locker Rental' | 'Clearance Certificate' | 'Accessibility Accommodation';
  details: string;
  status: 'Approved' | 'Pending' | 'Completed';
  submittedAt: string;
}

export interface PaymentTransaction {
  id: string;
  referenceNo: string;
  payerId: string;
  payerName: string;
  description: string;
  category: 'Equipment Deposit' | 'Overdue Fine' | 'Facility Rental' | 'ID Replacement Fee';
  amountPhp: number;
  method: 'GCash' | 'Maya' | 'Campus Card' | 'Cashier';
  status: 'Paid' | 'Pending' | 'Refunded';
  timestamp: string;
}

export interface WorkOrder {
  id: string;
  ticketNo: string;
  targetRoomId: string;
  targetName: string;
  issueType: 'HVAC Repair' | 'Projector / AV Fix' | 'Smart Lock Calibration' | 'Deep Cleaning' | 'Electrical Inspection';
  priority: 'Critical' | 'High' | 'Routine';
  blocksRoomAvailability: boolean;
  assignedStaffName: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  estimatedCostPhp: number;
  slaDeadline: string;
  createdAt: string;
}

export interface DepartmentBudget {
  id: string;
  department: string;
  code: string;
  allocatedPhp: number;
  spentPhp: number;
  encumberedPhp: number;
  monthlyBurnPhp: number;
  costCenterLead: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  module: string;
  targetRef: string;
  ipAddress: string;
  severity: 'Info' | 'Warning' | 'Security';
}

export interface EcosystemIntegration {
  id: string;
  systemName: string;
  category: 'SIS' | 'LMS' | 'HR & Payroll' | 'Library' | 'Campus Security & CCTV' | 'Payment Gateway';
  vendorOrProtocol: string;
  status: 'Connected' | 'Syncing' | 'Warning';
  lastSync: string;
  recordsSynced: number;
  endpointUrl: string;
  samplePayload: string;
}

export interface EmergencyState {
  active: boolean;
  protocol: 'None' | 'Earthquake Drill / Seismic Alert' | 'Severe Typhoon / Flood Warning' | 'Facility Security Lockdown';
  broadcastMessage: string;
  activatedBy: string;
  activatedAt: string;
  autoUnlockExits: boolean;
}

export interface SmartRoomRecommendation {
  room: FacilityRoom;
  fitScore: number;
  reasons: string[];
  hasConflict: boolean;
  conflictDetails?: string;
}

export interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  undoLabel?: string;
  onUndo?: () => void;
}

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  consequence: string;
  confirmLabel: string;
  severity: 'danger' | 'warning';
  onConfirm: () => void;
}
