import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmsService } from './services/crms';
import { DigitalTwinView } from './components/digital-twin-view';
import { RoomsCoursesView } from './components/rooms-courses-view';
import { EquipmentLifecycleView } from './components/equipment-lifecycle-view';
import { StaffStudentEventsView } from './components/staff-student-events-view';
import { OperationsAnalyticsSecurityView } from './components/operations-analytics-security-view';
import { GeminiChatbot } from './components/gemini-chatbot';
import { BookingRecord, BuildingName, FacilityRoom, ModuleId, TermCourseAssignment, UserRole, WorkOrder } from './models/crms.models';

export interface NavItemDef {
  id: ModuleId;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    DigitalTwinView,
    RoomsCoursesView,
    EquipmentLifecycleView,
    StaffStudentEventsView,
    OperationsAnalyticsSecurityView,
    GeminiChatbot,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly crms = inject(CrmsService);
  private readonly fb = inject(FormBuilder);

  readonly roles: UserRole[] = ['Admin', 'Faculty', 'Staff', 'Student'];
  readonly searchDropdownOpen = signal<boolean>(false);
  readonly accountMenuOpen = signal<boolean>(false);
  readonly privacyModalOpen = signal<boolean>(false);
  readonly mobileSearchOpen = signal<boolean>(false);
  readonly moreSheetOpen = signal<boolean>(false);

  // Simplified navigation (maximum 6 items, with Admin visible only to Administrators)
  readonly allNavItems: NavItemDef[] = [
    { id: 'overview', label: 'Home', icon: 'home' },
    { id: 'rooms-courses', label: 'Rooms', icon: 'meeting_room' },
    { id: 'operations', label: 'Bookings', icon: 'calendar_month' },
    { id: 'equipment', label: 'Equipment', icon: 'inventory_2' },
    { id: 'analytics', label: 'Reports', icon: 'bar_chart' },
    { id: 'security-ecosystem', label: 'Admin', icon: 'admin_panel_settings', adminOnly: true },
  ];

  readonly visibleNavItems = computed(() => {
    const isAdmin = this.crms.activeRole() === 'Admin';
    return this.allNavItems.filter((item) => !item.adminOnly || isAdmin);
  });

  readonly operationalRoomsCount = computed(
    () => this.crms.rooms().filter((r) => r.availabilityState === 'Operational').length
  );

  readonly userDisplayName = computed(() => {
    return this.crms.activePersona().name;
  });

  readonly userFirstName = computed(() => {
    const name = this.crms.activePersona().name;
    const clean = name.replace(/^(Dr\.|Engr\.|Prof\.|Dean)\s+/i, '').trim();
    if (clean.startsWith('Ma. ')) {
      const parts = clean.split(' ');
      return parts.length > 1 ? parts[1] : 'Theresa';
    }
    return clean.split(' ')[0] || clean;
  });

  readonly recentActivity = computed(() => {
    return this.crms.bookings().slice(0, 4);
  });

  readonly openMaintenanceOrders = computed(() =>
    this.crms.workOrders().filter((w) => w.status !== 'Resolved')
  );

  // ==========================================
  // GUIDED 3-STEP BOOKING FLOW
  // Step 1: Pick Date & Time
  // Step 2: Show Available Rooms with Capacity
  // Step 3: Review & Confirm
  // ==========================================
  readonly bookingStep = signal<1 | 2 | 3>(1);

  readonly bookingForm = this.fb.nonNullable.group({
    title: ['Inter-Departmental Curriculum Review', [Validators.required, Validators.minLength(3)]],
    category: [
      'Academic Class' as BookingRecord['category'],
      Validators.required,
    ],
    date: ['2026-11-05', Validators.required],
    startTime: ['10:30', Validators.required],
    endTime: ['12:00', Validators.required],
    attendees: [32, [Validators.required, Validators.min(1), Validators.max(300)]],
    selectedRoomId: ['RM-101', Validators.required],
  });

  // Track changes to recalculate available rooms
  readonly bookingEvaluationTrigger = signal<number>(0);

  // Available operational rooms for selected date & time in Step 2
  readonly availableRoomsForBooking = computed(() => {
    this.bookingEvaluationTrigger();
    const raw = this.bookingForm.getRawValue();
    const date = raw.date;
    const start = raw.startTime;
    const end = raw.endTime;
    const neededSeats = Number(raw.attendees) || 1;

    return this.crms.rooms().map((rm) => {
      const isOperational = rm.availabilityState === 'Operational';
      const hasSeatCapacity = rm.capacity >= neededSeats;
      const conflictCheck = isOperational
        ? this.crms.checkRoomConflict(rm.id, date, start, end)
        : { hasConflict: true, details: `${rm.code} is under maintenance.` };

      const isEligible = isOperational && hasSeatCapacity && !conflictCheck.hasConflict;

      return {
        room: rm,
        isEligible,
        isOperational,
        hasSeatCapacity,
        hasConflict: conflictCheck.hasConflict,
        conflictDetails: conflictCheck.details,
      };
    });
  });

  readonly eligibleRoomsOnly = computed(() =>
    this.availableRoomsForBooking().filter((r) => r.isEligible)
  );

  // Selected room object
  readonly currentlySelectedRoom = computed(() => {
    const raw = this.bookingForm.getRawValue();
    return this.crms.getRoomById(raw.selectedRoomId);
  });

  // Nearest alternative room when preferred room is conflicted or unavailable
  readonly nearestAlternativeRoom = computed(() => {
    const current = this.currentlySelectedRoom();
    const eligible = this.eligibleRoomsOnly();
    if (!eligible.length) return null;
    if (current && current.availabilityState === 'Operational') {
      const curEligible = eligible.find((e) => e.room.id === current.id);
      if (curEligible) return null; // Current room is already fine
    }
    // Return first eligible room closest in capacity
    return eligible[0]?.room || null;
  });

  setModule(id: ModuleId): void {
    this.moreSheetOpen.set(false);
    this.mobileSearchOpen.set(false);
    if (this.crms.activeModule() !== id) {
      this.crms.triggerSkeletonTransition();
      this.crms.activeModule.set(id);
    }
  }

  setRole(role: UserRole): void {
    this.crms.activeRole.set(role);
    this.crms.pushToast(
      `Role switched to ${role}`,
      `Viewing as ${this.crms.activePersona().name} (${this.crms.activePersona().title}).`,
      'info'
    );
  }

  onGlobalSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.crms.globalSearchQuery.set(val);
    this.searchDropdownOpen.set(val.trim().length > 1);
  }

  selectSearchResult(item: {
    id: string;
    label: string;
    meta: string;
    module: ModuleId;
    roomId?: string;
    building?: BuildingName;
  }): void {
    if (item.building) {
      this.crms.selectedBuilding.set(item.building);
    }
    if (item.roomId) {
      this.crms.selectedRoomId.set(item.roomId);
    }
    this.setModule(item.module);
    this.searchDropdownOpen.set(false);
    this.crms.globalSearchQuery.set('');
  }

  clearGlobalSearch(): void {
    this.crms.globalSearchQuery.set('');
    this.searchDropdownOpen.set(false);
  }

  jumpToCourseRelocation(course: TermCourseAssignment): void {
    this.crms.relocationCourseId.set(course.id);
    this.setModule('rooms-courses');
  }

  inspectRoomOnFloorplan(roomId: string): void {
    const room = this.crms.getRoomById(roomId);
    if (room) {
      this.crms.selectedBuilding.set(room.building);
    }
    this.crms.selectedRoomId.set(roomId);
    this.setModule('digital-twin');
  }

  advanceWorkOrder(wo: WorkOrder): void {
    const nextStatus: WorkOrder['status'] =
      wo.status === 'Open' ? 'In Progress' : 'Resolved';
    this.crms.updateWorkOrderStatus(wo.id, nextStatus);
  }

  confirmResetDemoData(): void {
    this.crms.requestConfirmation({
      title: 'Reset campus operational data?',
      consequence:
        'All rooms, term course assignments, equipment loans, and approval queues will return to their initial baseline. Any unsaved reservations created in this session will be overwritten.',
      confirmLabel: 'Reset all data',
      severity: 'danger',
      onConfirm: () => {
        this.crms.resetDemoData();
      },
    });
  }

  // ==========================================
  // GUIDED BOOKING WIZARD HANDLERS
  // ==========================================
  openBookingWizard(preset?: {
    roomId?: string;
    category?: BookingRecord['category'];
    title?: string;
  }): void {
    if (preset?.roomId) {
      this.bookingForm.patchValue({ selectedRoomId: preset.roomId });
    }
    if (preset?.category) {
      this.bookingForm.patchValue({ category: preset.category });
    }
    if (preset?.title) {
      this.bookingForm.patchValue({ title: preset.title });
    }
    this.bookingStep.set(1);
    this.bookingEvaluationTrigger.update((v) => v + 1);
    this.crms.quickBookModalOpen.set(true);
  }

  closeBookingWizard(): void {
    this.crms.quickBookModalOpen.set(false);
    this.bookingStep.set(1);
  }

  goToBookingStep2(): void {
    if (this.bookingForm.controls.title.invalid ||
        this.bookingForm.controls.date.invalid ||
        this.bookingForm.controls.startTime.invalid ||
        this.bookingForm.controls.endTime.invalid ||
        this.bookingForm.controls.attendees.invalid) {
      this.crms.pushToast('Check required fields', 'Please provide a title, date, valid times, and expected attendance.', 'warning');
      return;
    }
    this.bookingEvaluationTrigger.update((v) => v + 1);
    // Auto-select first eligible room if current is conflicted
    const current = this.currentlySelectedRoom();
    const eligible = this.eligibleRoomsOnly();
    if (!current || current.availabilityState !== 'Operational' || !eligible.some((e) => e.room.id === current.id)) {
      if (eligible.length > 0) {
        this.bookingForm.patchValue({ selectedRoomId: eligible[0].room.id });
      }
    }
    this.bookingStep.set(2);
  }

  selectRoomForBooking(room: FacilityRoom): void {
    this.bookingForm.patchValue({ selectedRoomId: room.id });
    this.bookingStep.set(3);
  }

  confirmBookingSubmission(): void {
    const raw = this.bookingForm.getRawValue();
    const res = this.crms.createBooking({
      resourceType: 'Room',
      bookingSubtype: 'Ad-Hoc Reservation',
      targetId: raw.selectedRoomId,
      title: raw.title,
      category: raw.category,
      department: this.crms.activePersona().department,
      date: raw.date,
      startTime: raw.startTime,
      endTime: raw.endTime,
      attendees: Number(raw.attendees),
      requiredEquipment: ['4K Laser Projector', 'Interactive Smartboard'],
      autoAssigned: false,
    });

    if (res.ok) {
      this.closeBookingWizard();
      this.crms.pushToast(
        'Reservation submitted',
        `Booked ${this.currentlySelectedRoom()?.code} for ${raw.date} (${raw.startTime} - ${raw.endTime}).`,
        'success'
      );
    } else {
      this.crms.pushToast('Reservation conflict', res.message, 'error');
    }
  }
}
