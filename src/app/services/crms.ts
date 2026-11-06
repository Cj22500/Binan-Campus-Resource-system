import { Injectable, computed, effect, signal } from '@angular/core';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  AppLanguage,
  AuditLogEntry,
  BookingRecord,
  BuildingName,
  ConfirmDialogState,
  DepartmentBudget,
  EcosystemIntegration,
  EmergencyState,
  EquipmentAsset,
  FacilityRoom,
  ModuleId,
  NotificationToast,
  PaymentTransaction,
  ServiceRequest,
  SmartRoomRecommendation,
  StaffMember,
  StudentProfile,
  TermCourseAssignment,
  UserRole,
  WorkOrder,
} from '../models/crms.models';

const STORAGE_KEY = 'binan_crms_state_v3';

@Injectable({
  providedIn: 'root',
})
export class CrmsService {
  readonly activeModule = signal<ModuleId>('overview');
  readonly activeRole = signal<UserRole>('Admin');
  readonly language = signal<AppLanguage>('en');
  readonly darkMode = signal<boolean>(false);
  readonly highContrast = signal<boolean>(false);
  readonly largeText = signal<boolean>(false);
  readonly reducedMotion = signal<boolean>(false);
  readonly sidebarCollapsed = signal<boolean>(false);
  readonly isLoadingView = signal<boolean>(false);
  readonly currentTerm = signal<string>('1st Semester AY 2026-2027');

  setModule(id: ModuleId): void {
    this.activeModule.set(id);
  }

  // Global search & confirmation dialog state
  readonly globalSearchQuery = signal<string>('');
  readonly confirmDialog = signal<ConfirmDialogState>({
    open: false,
    title: '',
    consequence: '',
    confirmLabel: 'Confirm',
    severity: 'danger',
    onConfirm: () => undefined,
  });

  // Firebase Auth & Cloud Firestore Sync State
  readonly firebaseUser = signal<User | null>(null);
  readonly authReady = signal<boolean>(false);
  readonly cloudSynced = signal<boolean>(false);
  private firestoreUnsubscribes: Unsubscribe[] = [];

  readonly selectedBuilding = signal<BuildingName>('Main Academic Hall');
  readonly selectedFloor = signal<number | 'all'>('all');
  readonly selectedRoomId = signal<string>('RM-101');
  readonly quickBookModalOpen = signal<boolean>(false);
  readonly relocationCourseId = signal<string | null>(null);
  readonly guideOpen = signal<boolean>(false);

  readonly toasts = signal<NotificationToast[]>([]);

  readonly rooms = signal<FacilityRoom[]>(this.getInitialRooms());
  readonly termCourses = signal<TermCourseAssignment[]>(this.getInitialTermCourses());
  readonly bookings = signal<BookingRecord[]>(this.getInitialBookings());
  readonly equipment = signal<EquipmentAsset[]>(this.getInitialEquipment());
  readonly staff = signal<StaffMember[]>(this.getInitialStaff());
  readonly students = signal<StudentProfile[]>(this.getInitialStudents());
  readonly serviceRequests = signal<ServiceRequest[]>(this.getInitialServiceRequests());
  readonly payments = signal<PaymentTransaction[]>(this.getInitialPayments());
  readonly workOrders = signal<WorkOrder[]>(this.getInitialWorkOrders());
  readonly budgets = signal<DepartmentBudget[]>(this.getInitialBudgets());
  readonly auditLogs = signal<AuditLogEntry[]>(this.getInitialAuditLogs());
  readonly integrations = signal<EcosystemIntegration[]>(this.getInitialIntegrations());
  readonly emergency = signal<EmergencyState>({
    active: false,
    protocol: 'None',
    broadcastMessage: '',
    activatedBy: '',
    activatedAt: '',
    autoUnlockExits: true,
  });

  readonly activePersona = computed(() => {
    const fbUser = this.firebaseUser();
    const role = this.activeRole();
    const customName = fbUser?.displayName;
    switch (role) {
      case 'Admin':
        return {
          id: fbUser?.uid || 'ADM-001',
          name: customName || 'Dr. Marites Villanueva',
          title: 'VP for Campus Operations & University Registrar',
          department: 'Office of the Registrar & Facilities',
          badgeCode: 'RFID-8841-ADM',
        };
      case 'Faculty':
        return {
          id: fbUser?.uid || 'FAC-101',
          name: customName || 'Engr. Arnel Panganiban',
          title: 'Associate Professor, Dept. of Computer Engineering',
          department: 'College of Computing & Engineering',
          badgeCode: 'RFID-4410-FAC',
        };
      case 'Staff':
        return {
          id: fbUser?.uid || 'STF-204',
          name: customName || 'Engr. Carlo Catindig',
          title: 'Physical Plant & IoT Systems Supervisor',
          department: 'Facilities & Asset Management',
          badgeCode: 'RFID-5529-STF',
        };
      case 'Student':
        return {
          id: fbUser?.uid || 'STU-2026-0184',
          name: customName || 'Ma. Theresa Macaraeg',
          title: 'BS Computer Science - 3rd Year',
          department: 'Student Council / IEEE Biñan Chapter',
          badgeCode: 'RFID-9921-STU',
        };
    }
  });

  readonly disruptedTermCourses = computed(() => {
    const roomMap = new Map(this.rooms().map((r) => [r.id, r]));
    return this.termCourses().filter((course) => {
      const room = roomMap.get(course.constantRoomId);
      return room && room.availabilityState !== 'Operational' && !course.relocatedRoomId;
    });
  });

  readonly pendingApprovalsCount = computed(
    () => this.bookings().filter((b) => b.status === 'Pending Approval').length
  );

  readonly openWorkOrdersCount = computed(
    () => this.workOrders().filter((w) => w.status !== 'Resolved').length
  );

  readonly totalEnergyKw = computed(() =>
    Number(this.rooms().reduce((acc, r) => acc + r.energyKw, 0).toFixed(1))
  );

  readonly totalOccupancy = computed(() =>
    this.rooms().reduce((acc, r) => acc + r.occupancyCount, 0)
  );

  readonly totalCapacity = computed(() =>
    this.rooms().reduce((acc, r) => acc + r.capacity, 0)
  );

  readonly campusUtilizationPct = computed(() => {
    const cap = this.totalCapacity();
    if (cap <= 0) return 47.2;
    const raw = (this.totalOccupancy() / cap) * 100;
    return Number(raw.toFixed(1));
  });

  readonly totalBudgetAllocated = computed(() =>
    this.budgets().reduce((acc, b) => acc + b.allocatedPhp, 0)
  );

  readonly totalBudgetSpent = computed(() =>
    this.budgets().reduce((acc, b) => acc + b.spentPhp + b.encumberedPhp, 0)
  );

  readonly globalSearchResults = computed(() => {
    const q = this.globalSearchQuery().trim().toLowerCase();
    if (q.length < 2) return [];
    const results: {
      id: string;
      label: string;
      meta: string;
      module: ModuleId;
      roomId?: string;
      building?: BuildingName;
    }[] = [];

    for (const r of this.rooms()) {
      if (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.building.toLowerCase().includes(q)
      ) {
        results.push({
          id: 'RM-' + r.id,
          label: `${r.code} · ${r.name}`,
          meta: `${r.building} · ${r.availabilityState}`,
          module: 'digital-twin',
          roomId: r.id,
          building: r.building,
        });
      }
    }

    for (const c of this.termCourses()) {
      if (
        c.courseCode.toLowerCase().includes(q) ||
        c.courseTitle.toLowerCase().includes(q) ||
        c.instructorName.toLowerCase().includes(q)
      ) {
        results.push({
          id: 'CRS-' + c.id,
          label: `${c.courseCode} · ${c.courseTitle}`,
          meta: `${c.instructorName} · ${c.scheduleDays} ${c.startTime}-${c.endTime}`,
          module: 'rooms-courses',
        });
      }
    }

    for (const e of this.equipment()) {
      if (
        e.assetTag.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      ) {
        results.push({
          id: 'EQ-' + e.id,
          label: `${e.assetTag} · ${e.name}`,
          meta: `${e.availableQty}/${e.totalQty} available · ${e.category}`,
          module: 'equipment',
        });
      }
    }

    return results.slice(0, 7);
  });

  private readonly dictionary: Record<string, { en: string; fil: string }> = {
    'nav.overview': { en: 'Operations overview', fil: 'Pangkalahatang tanaw' },
    'nav.digitalTwin': { en: 'Campus floorplan', fil: 'Mapa ng gusali' },
    'nav.roomsCourses': { en: 'Term courses & rooms', fil: 'Kurso at silid' },
    'nav.equipment': { en: 'Equipment inventory', fil: 'Imbentaryo ng gamit' },
    'nav.staff': { en: 'Faculty & staff load', fil: 'Tungkulin ng guro' },
    'nav.studentServices': { en: 'Student ID & cashier', fil: 'Serbisyo sa mag-aaral' },
    'nav.events': { en: 'Event reservations', fil: 'Kaganapan sa kampus' },
    'nav.operations': { en: 'Approvals & upkeep', fil: 'Pag-apruba at kumpuni' },
    'nav.analytics': { en: 'Utilization & reports', fil: 'Ulat sa paggamit' },
    'nav.security': { en: 'Audit log & RA 10173', fil: 'Talaan at RA 10173' },
    'cta.newReservation': { en: 'Reserve room', fil: 'Mag-reserba ng silid' },
    'role.switcher': { en: 'Active role', fil: 'Aktibong tungkulin' },
    'banner.disruptedCourses': {
      en: 'Assigned term room under maintenance: alternate room reservation unlocked',
      fil: 'Kasalukuyang kinukumpuni ang silid: maaaring kumuha ng kapalit na silid',
    },
  };

  constructor() {
    this.detectSystemPreferences();
    this.loadFromStorage();
    this.initFirebaseAuth();

    effect(() => {
      if (typeof window === 'undefined') return;
      const docEl = document.documentElement;
      docEl.classList.toggle('dark', this.darkMode());
      docEl.classList.toggle('a11y-high-contrast', this.highContrast());
      docEl.classList.toggle('a11y-large-text', this.largeText());
      docEl.classList.toggle('a11y-reduced-motion', this.reducedMotion());
    });

    effect(() => {
      if (typeof window === 'undefined') return;
      const payload = {
        rooms: this.rooms(),
        termCourses: this.termCourses(),
        bookings: this.bookings(),
        equipment: this.equipment(),
        staff: this.staff(),
        students: this.students(),
        serviceRequests: this.serviceRequests(),
        payments: this.payments(),
        workOrders: this.workOrders(),
        budgets: this.budgets(),
        auditLogs: this.auditLogs(),
        integrations: this.integrations(),
        emergency: this.emergency(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage quota errors
      }
    });
  }

  private detectSystemPreferences(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    this.darkMode.set(false);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.reducedMotion.set(true);
    }
  }

  triggerSkeletonTransition(): void {
    if (this.reducedMotion()) return;
    this.isLoadingView.set(true);
    setTimeout(() => {
      this.isLoadingView.set(false);
    }, 180);
  }

  requestConfirmation(config: Omit<ConfirmDialogState, 'open'>): void {
    this.confirmDialog.set({
      ...config,
      open: true,
    });
  }

  closeConfirmation(): void {
    this.confirmDialog.update((prev) => ({ ...prev, open: false }));
  }

  executeConfirmation(): void {
    const current = this.confirmDialog();
    this.closeConfirmation();
    current.onConfirm();
  }

  // --- FIREBASE AUTHENTICATION & FIRESTORE PERSISTENCE ---

  private initFirebaseAuth(): void {
    if (typeof window === 'undefined') return;
    onAuthStateChanged(auth, async (user) => {
      this.cleanupFirestoreListeners();
      this.firebaseUser.set(user);
      this.authReady.set(true);

      if (user) {
        await this.ensureUserProfileAndSeedFirestore(user);
        this.attachFirestoreListeners(user);
      } else {
        this.cloudSynced.set(false);
      }
    });
  }

  async signInWithGoogle(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      this.logAudit(
        `Signed in via Google Firebase Auth (${cred.user.displayName || cred.user.uid})`,
        'Firebase Auth & Cloud DB',
        cred.user.uid,
        'Security'
      );
      this.pushToast(
        'Signed in with Google',
        `Authenticated as ${cred.user.displayName || 'User'}. Syncing course rooms and reservations with Cloud Firestore.`,
        'success'
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.pushToast('Sign-in cancelled or failed', msg, 'warning');
    }
  }

  async signOutFirebase(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      this.cleanupFirestoreListeners();
      await signOut(auth);
      this.cloudSynced.set(false);
      this.pushToast('Signed out', 'Using local browser storage.', 'info');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.pushToast('Sign-out error', msg, 'error');
    }
  }

  private sanitizeId(raw: string, maxLen = 128): string {
    const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen);
    return cleaned.length > 0 ? cleaned : 'ID-1';
  }

  private sanitizeStr(raw: string, minLen: number, maxLen: number, fallback = 'N/A'): string {
    const trimmed = (raw || '').trim();
    const base = trimmed.length >= minLen ? trimmed : fallback;
    return base.slice(0, maxLen);
  }

  private async ensureUserProfileAndSeedFirestore(user: User): Promise<void> {
    const uid = this.sanitizeId(user.uid, 128);
    const userPath = `users/${uid}`;
    const isBootstrappedAdmin = user.email === 'cyriljustin225@gmail.com';
    const assignedRole: UserRole = isBootstrappedAdmin ? 'Admin' : 'Faculty';
    this.activeRole.set(assignedRole);

    try {
      const existingSnap = await getDoc(doc(db, 'users', uid));
      if (!existingSnap.exists()) {
        await setDoc(doc(db, 'users', uid), {
          uid,
          displayName: this.sanitizeStr(user.displayName || 'Biñan Campus User', 1, 100),
          role: assignedRole,
          department: this.sanitizeStr('College of Computing & Engineering', 1, 120),
          badgeCode: this.sanitizeId('RFID-8841-BITS', 64),
          language: this.language(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const c of this.termCourses()) {
          await this.saveTermCourseToFirestore(c, uid, true);
        }

        for (const b of this.bookings()) {
          await this.saveBookingToFirestore(b, uid, true);
        }
      }
      this.cloudSynced.set(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }

  private attachFirestoreListeners(user: User): void {
    const uid = this.sanitizeId(user.uid, 128);

    const coursesQuery = query(
      collection(db, 'termCourses'),
      where('ownerId', '==', uid)
    );
    const unsubCourses = onSnapshot(
      coursesQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: TermCourseAssignment[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              academicTerm: data['academicTerm'] || this.currentTerm(),
              courseCode: data['courseCode'] || 'CS-101',
              courseTitle: data['courseTitle'] || 'Course',
              department: data['department'] || 'College of Computing & Engineering',
              instructorId: 'FAC-101',
              instructorName: data['instructorName'] || 'Engr. Arnel Panganiban',
              enrolledStudents: Number(data['enrolledStudents']) || 34,
              requiredEquipment: ['4K Laser Projector', 'Interactive Smartboard'],
              scheduleDays: (data['scheduleDays'] as 'MWF' | 'TTh' | 'Sat') || 'MWF',
              startTime: data['startTime'] || '09:00',
              endTime: data['endTime'] || '10:30',
              constantRoomId: data['constantRoomId'] || 'RM-101',
              relocatedRoomId: data['relocatedRoomId'] ? data['relocatedRoomId'] : undefined,
              relocatedDate: data['relocatedDate'] ? data['relocatedDate'] : undefined,
              relocationReason: data['relocationReason'] ? data['relocationReason'] : undefined,
            };
          });
          this.termCourses.set(loaded);
        }
        this.cloudSynced.set(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'termCourses');
      }
    );

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('ownerId', '==', uid)
    );
    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: BookingRecord[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              resourceType: data['resourceType'] || 'Room',
              bookingSubtype: data['bookingSubtype'] || 'Ad-Hoc Reservation',
              targetId: data['targetId'] || 'RM-101',
              targetName: data['targetName'] || 'Room',
              title: data['title'] || 'Reservation',
              category: data['category'] || 'Academic Class',
              requesterName: data['requesterName'] || 'Campus User',
              requesterRole: this.activeRole(),
              requesterId: uid,
              department: data['department'] || 'Office of the Registrar & Facilities',
              date: data['date'] || '2026-11-04',
              startTime: data['startTime'] || '09:00',
              endTime: data['endTime'] || '11:00',
              attendees: Number(data['attendees']) || 28,
              requiredEquipment: ['Interactive Smartboard'],
              status: data['status'] || 'Approved',
              autoAssigned: true,
              costPhp: Number(data['costPhp']) || 0,
              createdAt: 'Synced via Firestore',
            };
          });
          this.bookings.set(loaded);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      }
    );

    this.firestoreUnsubscribes.push(unsubCourses, unsubBookings);
  }

  private cleanupFirestoreListeners(): void {
    this.firestoreUnsubscribes.forEach((u) => u());
    this.firestoreUnsubscribes = [];
  }

  private async saveTermCourseToFirestore(
    course: TermCourseAssignment,
    uid: string,
    isCreate: boolean
  ): Promise<void> {
    const docId = this.sanitizeId(course.id, 128);
    const path = `termCourses/${docId}`;
    try {
      if (isCreate) {
        await setDoc(doc(db, 'termCourses', docId), {
          ownerId: uid,
          academicTerm: this.sanitizeStr(course.academicTerm, 1, 80, '1st Semester AY 2026-2027'),
          courseCode: this.sanitizeId(course.courseCode, 32),
          courseTitle: this.sanitizeStr(course.courseTitle, 2, 160, 'Academic Course'),
          department: this.sanitizeStr(course.department, 2, 120, 'Academic Department'),
          instructorName: this.sanitizeStr(course.instructorName, 2, 100, 'Faculty Instructor'),
          enrolledStudents: Math.max(1, Math.min(1000, Math.round(course.enrolledStudents))),
          scheduleDays: course.scheduleDays,
          startTime: this.sanitizeStr(course.startTime, 4, 10, '09:00'),
          endTime: this.sanitizeStr(course.endTime, 4, 10, '10:30'),
          constantRoomId: this.sanitizeId(course.constantRoomId, 64),
          relocatedRoomId: course.relocatedRoomId ? this.sanitizeId(course.relocatedRoomId, 64) : '',
          relocatedDate: course.relocatedDate ? course.relocatedDate.slice(0, 32) : '',
          relocationReason: course.relocationReason ? course.relocationReason.slice(0, 240) : '',
          status: course.relocatedRoomId ? 'relocated' : 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'termCourses', docId), {
          constantRoomId: this.sanitizeId(course.constantRoomId, 64),
          relocatedRoomId: course.relocatedRoomId ? this.sanitizeId(course.relocatedRoomId, 64) : '',
          relocatedDate: course.relocatedDate ? course.relocatedDate.slice(0, 32) : '',
          relocationReason: course.relocationReason ? course.relocationReason.slice(0, 240) : '',
          status: course.relocatedRoomId ? 'relocated' : 'active',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(
        error,
        isCreate ? OperationType.CREATE : OperationType.UPDATE,
        path
      );
    }
  }

  private async saveBookingToFirestore(
    booking: BookingRecord,
    uid: string,
    isCreate: boolean
  ): Promise<void> {
    const docId = this.sanitizeId(booking.id, 128);
    const path = `bookings/${docId}`;
    const allowedStatuses = ['Approved', 'Pending Approval', 'Rejected', 'Completed'];
    const safeStatus = allowedStatuses.includes(booking.status) ? booking.status : 'Approved';
    try {
      if (isCreate) {
        await setDoc(doc(db, 'bookings', docId), {
          ownerId: uid,
          resourceType: booking.resourceType,
          bookingSubtype: booking.bookingSubtype,
          targetId: this.sanitizeId(booking.targetId, 64),
          targetName: this.sanitizeStr(booking.targetName, 1, 140, 'Campus Facility'),
          title: this.sanitizeStr(booking.title, 2, 160, 'Campus Reservation'),
          category: booking.category,
          requesterName: this.sanitizeStr(booking.requesterName, 1, 100, 'Campus User'),
          department: this.sanitizeStr(booking.department, 1, 120, 'Campus Department'),
          date: this.sanitizeStr(booking.date, 8, 20, '2026-11-04'),
          startTime: this.sanitizeStr(booking.startTime, 4, 10, '09:00'),
          endTime: this.sanitizeStr(booking.endTime, 4, 10, '11:00'),
          attendees: Math.max(1, Math.min(5000, Math.round(booking.attendees))),
          status: safeStatus,
          costPhp: Math.max(0, Math.min(1000000, Number(booking.costPhp) || 0)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'bookings', docId), {
          status: safeStatus,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(
        error,
        isCreate ? OperationType.CREATE : OperationType.UPDATE,
        path
      );
    }
  }

  t(key: string): string {
    const entry = this.dictionary[key];
    if (!entry) return key;
    return entry[this.language()];
  }

  getRoomById(roomId: string | undefined): FacilityRoom | undefined {
    if (!roomId) return undefined;
    return this.rooms().find((r) => r.id === roomId);
  }

  pushToast(
    title: string,
    message: string,
    type: NotificationToast['type'] = 'info',
    undoConfig?: { label: string; onUndo: () => void }
  ): void {
    const id = 'TST-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const toast: NotificationToast = {
      id,
      title,
      message,
      type,
      timestamp: 'Just now',
      undoLabel: undoConfig?.label,
      onUndo: undoConfig?.onUndo,
    };
    this.toasts.update((list) => [toast, ...list.slice(0, 3)]);
    setTimeout(() => {
      this.dismissToast(id);
    }, 6000);
  }

  triggerToastUndo(toast: NotificationToast): void {
    if (toast.onUndo) {
      toast.onUndo();
    }
    this.dismissToast(toast.id);
  }

  dismissToast(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  logAudit(
    action: string,
    module: string,
    targetRef: string,
    severity: AuditLogEntry['severity'] = 'Info'
  ): void {
    const persona = this.activePersona();
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const entry: AuditLogEntry = {
      id: 'AUD-' + Math.floor(10000 + Math.random() * 90000),
      timestamp: formatted,
      actorName: persona.name,
      actorRole: this.activeRole(),
      action,
      module,
      targetRef,
      ipAddress: '10.42.88.14 (Biñan Campus Intranet)',
      severity,
    };
    this.auditLogs.update((logs) => [entry, ...logs]);
  }

  // --- TERM COURSE ROOM ASSIGNMENT & TEACHER RELOCATION OVERRIDE ---

  updateCourseConstantRoom(
    courseId: string,
    newRoomId: string
  ): { ok: boolean; message: string } {
    const course = this.termCourses().find((c) => c.id === courseId);
    const room = this.getRoomById(newRoomId);
    if (!course || !room) {
      return { ok: false, message: 'Course or room not found.' };
    }

    const conflict = this.termCourses().find(
      (other) =>
        other.id !== courseId &&
        other.constantRoomId === newRoomId &&
        other.scheduleDays === course.scheduleDays &&
        this.timesOverlap(course.startTime, course.endTime, other.startTime, other.endTime)
    );

    if (conflict) {
      return {
        ok: false,
        message: `Conflict with ${conflict.courseCode} (${conflict.scheduleDays} ${conflict.startTime}-${conflict.endTime}) in ${room.code}.`,
      };
    }

    const prevRoomId = course.constantRoomId;
    const updatedCourse: TermCourseAssignment = {
      ...course,
      constantRoomId: newRoomId,
      relocatedRoomId: undefined,
      relocatedDate: undefined,
      relocationReason: undefined,
      relocationBookingId: undefined,
    };

    this.termCourses.update((list) =>
      list.map((c) => (c.id === courseId ? updatedCourse : c))
    );

    const fbUser = this.firebaseUser();
    if (fbUser) {
      void this.saveTermCourseToFirestore(updatedCourse, fbUser.uid, false);
    }

    this.logAudit(
      `Assigned constant term room ${room.code} for ${course.courseCode} (${this.currentTerm()})`,
      'Term Courses & Rooms',
      course.courseCode
    );
    this.pushToast(
      'Constant term room updated',
      `${course.courseCode} constant room set to ${room.code} (${room.name}).`,
      'success',
      {
        label: 'Undo change',
        onUndo: () => {
          this.updateCourseConstantRoom(courseId, prevRoomId);
        },
      }
    );
    return { ok: true, message: 'Updated successfully.' };
  }

  addTermCourseAssignment(payload: {
    courseCode: string;
    courseTitle: string;
    department: string;
    instructorName: string;
    enrolledStudents: number;
    requiredEquipment: string[];
    scheduleDays: 'MWF' | 'TTh' | 'Sat';
    startTime: string;
    endTime: string;
    constantRoomId: string;
  }): { ok: boolean; message: string } {
    const room = this.getRoomById(payload.constantRoomId);
    if (!room) {
      return { ok: false, message: 'Selected constant room does not exist.' };
    }

    if (payload.startTime >= payload.endTime) {
      return { ok: false, message: 'End time must be after start time.' };
    }

    const conflict = this.termCourses().find(
      (other) =>
        other.constantRoomId === payload.constantRoomId &&
        other.scheduleDays === payload.scheduleDays &&
        this.timesOverlap(payload.startTime, payload.endTime, other.startTime, other.endTime)
    );

    if (conflict) {
      return {
        ok: false,
        message: `Term conflict: ${room.code} is already assigned to ${conflict.courseCode} on ${conflict.scheduleDays} ${conflict.startTime}-${conflict.endTime}.`,
      };
    }

    const newCourse: TermCourseAssignment = {
      id: 'CRS-' + Math.floor(1000 + Math.random() * 9000),
      academicTerm: this.currentTerm(),
      courseCode: payload.courseCode.toUpperCase(),
      courseTitle: payload.courseTitle,
      department: payload.department,
      instructorId: 'FAC-' + Math.floor(100 + Math.random() * 899),
      instructorName: payload.instructorName,
      enrolledStudents: payload.enrolledStudents,
      requiredEquipment: payload.requiredEquipment,
      scheduleDays: payload.scheduleDays,
      startTime: payload.startTime,
      endTime: payload.endTime,
      constantRoomId: payload.constantRoomId,
    };

    this.termCourses.update((list) => [newCourse, ...list]);

    const fbUser = this.firebaseUser();
    if (fbUser) {
      void this.saveTermCourseToFirestore(newCourse, fbUser.uid, true);
    }

    this.logAudit(
      `Created term course assignment ${newCourse.courseCode} in constant room ${room.code}`,
      'Term Courses & Rooms',
      newCourse.courseCode
    );
    this.pushToast(
      'Term course added',
      `${newCourse.courseCode} assigned to constant room ${room.code} (${newCourse.scheduleDays} ${newCourse.startTime}-${newCourse.endTime}).`,
      'success'
    );
    return { ok: true, message: 'Course assignment added.' };
  }

  relocateCourseSession(
    courseId: string,
    alternateRoomId: string,
    date: string,
    reason: string,
    autoAssigned = false
  ): { ok: boolean; message: string } {
    const course = this.termCourses().find((c) => c.id === courseId);
    const altRoom = this.getRoomById(alternateRoomId);
    const origRoom = this.getRoomById(course?.constantRoomId);
    if (!course || !altRoom) {
      return { ok: false, message: 'Course or alternate room not found.' };
    }

    if (altRoom.availabilityState !== 'Operational') {
      return { ok: false, message: `${altRoom.code} is currently ${altRoom.availabilityState}.` };
    }

    const conflict = this.checkRoomConflict(
      alternateRoomId,
      date,
      course.startTime,
      course.endTime,
      course.id
    );
    if (conflict.hasConflict) {
      return { ok: false, message: conflict.details || 'Room has a scheduling conflict.' };
    }

    const bookingId = 'BKG-REL-' + Math.floor(1000 + Math.random() * 9000);
    const newBooking: BookingRecord = {
      id: bookingId,
      resourceType: 'Room',
      bookingSubtype: 'Course Room Relocation',
      linkedCourseId: course.id,
      originalRoomId: course.constantRoomId,
      targetId: altRoom.id,
      targetName: `${altRoom.code} · ${altRoom.name}`,
      title: `${course.courseCode}: ${course.courseTitle} (Relocated from ${origRoom?.code || course.constantRoomId})`,
      category: 'Make-Up / Relocation',
      requesterName: course.instructorName,
      requesterRole: 'Faculty',
      requesterId: course.instructorId,
      department: course.department,
      date,
      startTime: course.startTime,
      endTime: course.endTime,
      attendees: course.enrolledStudents,
      requiredEquipment: course.requiredEquipment,
      status: 'Approved',
      autoAssigned,
      fitScore: 96,
      costPhp: 0,
      notes: reason,
      createdAt: '2026-11-04 08:40',
    };

    const updatedCourse: TermCourseAssignment = {
      ...course,
      relocatedRoomId: altRoom.id,
      relocatedDate: date,
      relocationReason: reason,
      relocationBookingId: bookingId,
    };

    this.bookings.update((list) => [newBooking, ...list]);
    this.termCourses.update((list) =>
      list.map((c) => (c.id === courseId ? updatedCourse : c))
    );

    const fbUser = this.firebaseUser();
    if (fbUser) {
      void this.saveBookingToFirestore(newBooking, fbUser.uid, true);
      void this.saveTermCourseToFirestore(updatedCourse, fbUser.uid, false);
    }

    this.logAudit(
      `Relocated ${course.courseCode} from unavailable constant room ${origRoom?.code} to ${altRoom.code} for ${date}`,
      'Term Courses & Rooms',
      `${course.courseCode} -> ${altRoom.code}`
    );
    this.pushToast(
      'Alternate room reserved',
      `${course.courseCode} (${course.instructorName}) relocated to ${altRoom.code} for ${date}.`,
      'success',
      {
        label: 'Undo relocation',
        onUndo: () => this.clearCourseRelocation(course.id),
      }
    );
    this.relocationCourseId.set(null);
    return { ok: true, message: `Relocated to ${altRoom.code}` };
  }

  clearCourseRelocation(courseId: string): void {
    const course = this.termCourses().find((c) => c.id === courseId);
    if (!course) return;
    const bookingId = course.relocationBookingId;
    if (bookingId) {
      this.bookings.update((list) => list.filter((b) => b.id !== bookingId));
    }
    const updatedCourse: TermCourseAssignment = {
      ...course,
      relocatedRoomId: undefined,
      relocatedDate: undefined,
      relocationReason: undefined,
      relocationBookingId: undefined,
    };
    this.termCourses.update((list) =>
      list.map((c) => (c.id === courseId ? updatedCourse : c))
    );
    const fbUser = this.firebaseUser();
    if (fbUser) {
      void this.saveTermCourseToFirestore(updatedCourse, fbUser.uid, false);
    }
    this.pushToast(
      'Returned to constant room',
      `${course.courseCode} restored to its assigned term room.`,
      'info'
    );
  }

  toggleRoomAvailability(
    roomId: string,
    newState: FacilityRoom['availabilityState'],
    reason?: string
  ): void {
    const room = this.getRoomById(roomId);
    if (!room) return;
    const prevState = room.availabilityState;
    const prevReason = room.unavailabilityReason;

    this.rooms.update((list) =>
      list.map((r) =>
        r.id === roomId
          ? {
              ...r,
              availabilityState: newState,
              unavailabilityReason:
                newState === 'Operational'
                  ? undefined
                  : reason || 'Scheduled HVAC and smartboard inspection',
            }
          : r
      )
    );

    if (newState === 'Operational') {
      const affectedCourses = this.termCourses().filter((c) => c.constantRoomId === roomId);
      affectedCourses.forEach((c) => {
        if (c.relocatedRoomId) {
          this.clearCourseRelocation(c.id);
        }
      });
      this.logAudit(
        `Restored room ${room.code} to Operational status`,
        'Campus Floorplan & IoT',
        room.code
      );
      this.pushToast(
        'Room restored to operational',
        `${room.code} (${room.name}) is operational again.`,
        'success'
      );
    } else {
      const affected = this.termCourses().filter((c) => c.constantRoomId === roomId);
      this.logAudit(
        `Marked room ${room.code} as ${newState} (${affected.length} term courses impacted)`,
        'Campus Floorplan & IoT',
        room.code,
        'Warning'
      );
      this.pushToast(
        'Room marked under maintenance',
        `${room.code} is now ${newState}. ${affected.length} assigned term course(s) unlocked for teacher alternate room booking.`,
        'warning',
        {
          label: 'Undo outage',
          onUndo: () => this.toggleRoomAvailability(roomId, prevState, prevReason),
        }
      );
    }
  }

  // --- CONFLICT DETECTION & SMART SCHEDULING ---

  timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    return startA < endB && startB < endA;
  }

  dateMatchesScheduleDays(dateStr: string, scheduleDays: 'MWF' | 'TTh' | 'Sat'): boolean {
    const parsed = new Date(dateStr + 'T12:00:00');
    if (isNaN(parsed.getTime())) return true;
    const day = parsed.getDay();
    if (scheduleDays === 'MWF') return day === 1 || day === 3 || day === 5;
    if (scheduleDays === 'TTh') return day === 2 || day === 4;
    if (scheduleDays === 'Sat') return day === 6;
    return false;
  }

  checkRoomConflict(
    roomId: string,
    date: string,
    startTime: string,
    endTime: string,
    ignoreCourseId?: string
  ): { hasConflict: boolean; details?: string } {
    const room = this.getRoomById(roomId);
    if (!room) return { hasConflict: true, details: 'Room does not exist.' };

    if (startTime >= endTime) {
      return { hasConflict: true, details: 'End time must be later than start time.' };
    }

    if (room.availabilityState !== 'Operational') {
      return {
        hasConflict: true,
        details: `${room.code} is ${room.availabilityState} (${room.unavailabilityReason || 'Unavailable'})`,
      };
    }

    const conflictingCourse = this.termCourses().find((course) => {
      if (course.id === ignoreCourseId) return false;
      const effectiveRoomId =
        course.relocatedDate === date && course.relocatedRoomId
          ? course.relocatedRoomId
          : course.constantRoomId;
      if (effectiveRoomId !== roomId) return false;
      if (!this.dateMatchesScheduleDays(date, course.scheduleDays)) return false;
      return this.timesOverlap(startTime, endTime, course.startTime, course.endTime);
    });

    if (conflictingCourse) {
      return {
        hasConflict: true,
        details: `Double-booking conflict: reserved for term course ${conflictingCourse.courseCode} (${conflictingCourse.instructorName}, ${conflictingCourse.scheduleDays} ${conflictingCourse.startTime}-${conflictingCourse.endTime})`,
      };
    }

    const conflictingBooking = this.bookings().find((b) => {
      if (b.resourceType !== 'Room' || b.targetId !== roomId) return false;
      if (b.status === 'Rejected' || b.status === 'Completed') return false;
      if (b.date !== date) return false;
      return this.timesOverlap(startTime, endTime, b.startTime, b.endTime);
    });

    if (conflictingBooking) {
      return {
        hasConflict: true,
        details: `Double-booking conflict: booked for "${conflictingBooking.title}" (${conflictingBooking.startTime}-${conflictingBooking.endTime})`,
      };
    }

    return { hasConflict: false };
  }

  getSmartRecommendations(params: {
    attendees: number;
    date: string;
    startTime: string;
    endTime: string;
    requiredEquipment: string[];
    ignoreCourseId?: string;
    excludeRoomId?: string;
  }): SmartRoomRecommendation[] {
    return this.rooms()
      .filter((r) => r.id !== params.excludeRoomId)
      .map((room) => {
        const conflict = this.checkRoomConflict(
          room.id,
          params.date,
          params.startTime,
          params.endTime,
          params.ignoreCourseId
        );

        let score = 100;
        const reasons: string[] = [];

        if (room.capacity < params.attendees) {
          score -= 45;
          reasons.push(`Under capacity (${room.capacity}/${params.attendees} seats)`);
        } else {
          const overhead = room.capacity - params.attendees;
          const efficiencyPenalty = Math.min(20, Math.floor(overhead / 5) * 2);
          score -= efficiencyPenalty;
          reasons.push(`Capacity fit (${room.capacity} seats for ${params.attendees})`);
        }

        if (params.requiredEquipment.length > 0) {
          const matched = params.requiredEquipment.filter((req) =>
            room.installedEquipment.some((eq) => eq.toLowerCase().includes(req.toLowerCase()))
          );
          const missingCount = params.requiredEquipment.length - matched.length;
          score -= missingCount * 18;
          if (missingCount === 0) {
            reasons.push(`All required equipment installed (${matched.join(', ')})`);
          } else {
            reasons.push(`Matches ${matched.length}/${params.requiredEquipment.length} tools`);
          }
        } else {
          reasons.push(`${room.installedEquipment.slice(0, 2).join(' · ')}`);
        }

        if (room.energyKw <= 3.5) {
          reasons.push(`Low power draw (${room.energyKw} kW)`);
        }

        if (conflict.hasConflict) {
          score = Math.max(5, score - 60);
        }

        return {
          room,
          fitScore: Math.max(5, Math.min(99, score)),
          reasons,
          hasConflict: conflict.hasConflict,
          conflictDetails: conflict.details,
        };
      })
      .sort((a, b) => {
        if (a.hasConflict !== b.hasConflict) return a.hasConflict ? 1 : -1;
        return b.fitScore - a.fitScore;
      });
  }

  createBooking(payload: {
    resourceType: BookingRecord['resourceType'];
    bookingSubtype: BookingRecord['bookingSubtype'];
    targetId: string;
    title: string;
    category: BookingRecord['category'];
    department: string;
    date: string;
    startTime: string;
    endTime: string;
    attendees: number;
    requiredEquipment: string[];
    autoAssigned: boolean;
    fitScore?: number;
    notes?: string;
  }): { ok: boolean; message: string } {
    const persona = this.activePersona();
    let targetName = payload.targetId;
    let costPhp = 0;

    if (payload.startTime >= payload.endTime) {
      return { ok: false, message: 'End time must be later than start time.' };
    }

    if (payload.resourceType === 'Room') {
      const room = this.getRoomById(payload.targetId);
      if (!room) return { ok: false, message: 'Selected room not found.' };
      const conflict = this.checkRoomConflict(
        room.id,
        payload.date,
        payload.startTime,
        payload.endTime
      );
      if (conflict.hasConflict) {
        return { ok: false, message: conflict.details || 'Room conflict detected.' };
      }
      targetName = `${room.code} · ${room.name}`;
      costPhp = room.hourlyCostPhp * 2;
    } else if (payload.resourceType === 'Equipment') {
      const item = this.equipment().find((e) => e.id === payload.targetId);
      if (!item) return { ok: false, message: 'Selected equipment not found.' };
      if (item.availableQty <= 0) return { ok: false, message: 'No units currently available.' };
      targetName = `${item.assetTag} · ${item.name}`;
      costPhp = 350;
    }

    const autoApproved = this.activeRole() === 'Admin' || this.activeRole() === 'Faculty';

    const record: BookingRecord = {
      id: 'BKG-' + Math.floor(1000 + Math.random() * 9000),
      resourceType: payload.resourceType,
      bookingSubtype: payload.bookingSubtype,
      targetId: payload.targetId,
      targetName,
      title: payload.title,
      category: payload.category,
      requesterName: persona.name,
      requesterRole: this.activeRole(),
      requesterId: persona.id,
      department: payload.department,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      attendees: payload.attendees,
      requiredEquipment: payload.requiredEquipment,
      status: autoApproved ? 'Approved' : 'Pending Approval',
      autoAssigned: payload.autoAssigned,
      fitScore: payload.fitScore,
      costPhp,
      notes: payload.notes,
      createdAt: '2026-11-04 08:50',
    };

    this.bookings.update((list) => [record, ...list]);

    const fbUser = this.firebaseUser();
    if (fbUser) {
      void this.saveBookingToFirestore(record, fbUser.uid, true);
    }

    this.logAudit(
      `Created ${record.bookingSubtype} "${record.title}" for ${record.targetName} (${record.status})`,
      'Reservations & Scheduling',
      record.id
    );
    this.pushToast(
      autoApproved ? 'Reservation confirmed' : 'Submitted for approval',
      `${record.title} in ${record.targetName} on ${record.date} (${record.startTime}-${record.endTime}).`,
      'success'
    );
    return { ok: true, message: 'Created successfully.' };
  }

  updateBookingStatus(
    bookingId: string,
    status: BookingRecord['status']
  ): void {
    const target = this.bookings().find((b) => b.id === bookingId);
    if (!target) return;
    const prevStatus = target.status;

    const updated: BookingRecord = { ...target, status };
    this.bookings.update((list) =>
      list.map((b) => (b.id === bookingId ? updated : b))
    );

    const fbUser = this.firebaseUser();
    if (fbUser) {
      void this.saveBookingToFirestore(updated, fbUser.uid, false);
    }

    if (status === 'Approved' && target.costPhp > 0) {
      this.budgets.update((list) =>
        list.map((dept) =>
          dept.department === target.department
            ? { ...dept, spentPhp: dept.spentPhp + target.costPhp }
            : dept
        )
      );
    }

    this.logAudit(
      `Updated booking ${bookingId} status to ${status}`,
      'Workflow Approvals',
      bookingId
    );
    this.pushToast(
      `Reservation ${status.toLowerCase()}`,
      `"${target.title}" (${target.targetName}) marked as ${status}.`,
      status === 'Approved' ? 'success' : status === 'Rejected' ? 'warning' : 'info',
      {
        label: 'Undo status change',
        onUndo: () => this.updateBookingStatus(bookingId, prevStatus),
      }
    );
  }

  batchAutoApproveEligible(): void {
    const pending = this.bookings().filter((b) => b.status === 'Pending Approval');
    const count = pending.length;
    if (count === 0) {
      this.pushToast('Approval queue clear', 'No pending requests require approval.', 'info');
      return;
    }

    this.requestConfirmation({
      title: 'Approve all reservations?',
      consequence: `You are about to approve ${count} pending reservation request${count > 1 ? 's' : ''}. You can undo this action immediately from the notification.`,
      confirmLabel: `Approve ${count} booking${count > 1 ? 's' : ''}`,
      severity: 'warning',
      onConfirm: () => {
        const previousBookings = [...this.bookings()];
        const fbUser = this.firebaseUser();
        this.bookings.update((list) =>
          list.map((b) => {
            if (b.status === 'Pending Approval') {
              const next = { ...b, status: 'Approved' as const };
              if (fbUser) {
                void this.saveBookingToFirestore(next, fbUser.uid, false);
              }
              return next;
            }
            return b;
          })
        );
        this.logAudit(
          `Approved ${count} reservation requests in bulk`,
          'Workflow Approvals',
          `BATCH-${count}`
        );
        this.pushToast(
          'Bulk approval completed',
          `Approved ${count} pending reservation${count > 1 ? 's' : ''}.`,
          'success',
          {
            label: 'Undo',
            onUndo: () => {
              this.bookings.set(previousBookings);
              if (fbUser) {
                for (const b of previousBookings) {
                  void this.saveBookingToFirestore(b, fbUser.uid, false);
                }
              }
              this.pushToast(
                'Bulk approval undone',
                `Restored previous states for ${count} reservations.`,
                'info'
              );
            },
          }
        );
      },
    });
  }

  // --- FRIENDLY DATE/TIME & STRING FORMATTERS ---

  format12HourTime(timeStr: string): string {
    if (!timeStr) return '';
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return timeStr;
    const hour = parseInt(parts[0], 10);
    const minute = parts[1];
    if (isNaN(hour)) return timeStr;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute} ${ampm}`;
  }

  formatTimeRange12Hour(timeRange: string): string {
    if (!timeRange) return '';
    const parts = timeRange.split(/[\s-]+/);
    if (parts.length >= 2) {
      const startParts = parts[0].split(':');
      const endParts = parts[1].split(':');
      if (startParts.length === 2 && endParts.length === 2) {
        const startH = parseInt(startParts[0], 10);
        const startM = startParts[1];
        const endH = parseInt(endParts[0], 10);
        const endM = endParts[1];
        if (!isNaN(startH) && !isNaN(endH)) {
          const startAmPm = startH >= 12 ? 'PM' : 'AM';
          const endAmPm = endH >= 12 ? 'PM' : 'AM';
          const start12H = startH % 12 === 0 ? 12 : startH % 12;
          const end12H = endH % 12 === 0 ? 12 : endH % 12;
          if (startAmPm === endAmPm) {
            return `${start12H}:${startM}-${end12H}:${endM} ${endAmPm}`;
          }
          return `${start12H}:${startM} ${startAmPm}-${end12H}:${endM} ${endAmPm}`;
        }
      }
    }
    return timeRange;
  }

  formatFriendlyDate(dateStr: string): string {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (trimmed === '2026-11-05') return 'Today, Nov 5';
    if (trimmed === '2026-11-06') return 'Tomorrow, Nov 6';
    if (trimmed === '2026-11-07') return 'Nov 7';
    if (trimmed === '2026-11-08') return 'Nov 8';
    if (trimmed === '2026-11-09') return 'Nov 9';
    if (trimmed === '2026-11-10') return 'Nov 10';
    if (trimmed === '2026-11-12') return 'Nov 12';
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[d.getMonth()]} ${d.getDate()}`;
    }
    return dateStr;
  }

  formatDateTime12Hour(dateStr: string, timeRange: string): string {
    const friendlyDate = this.formatFriendlyDate(dateStr);
    const friendlyTime = this.formatTimeRange12Hour(timeRange);
    return `${friendlyDate}, ${friendlyTime}`;
  }

  formatCourseSchedule12Hour(days: string, startTime: string, endTime: string): string {
    const range = this.formatTimeRange12Hour(`${startTime}-${endTime}`);
    return `${days}, ${range}`;
  }

  formatSentenceCase(text: string): string {
    if (!text) return '';
    const lower = text.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  // --- IOT & DIGITAL TWIN CONTROLS ---

  toggleRoomSmartLock(roomId: string): void {
    const room = this.getRoomById(roomId);
    if (!room) return;
    const nextState: FacilityRoom['smartLockState'] =
      room.smartLockState === 'Locked' ? 'Unlocked' : 'Locked';

    this.rooms.update((list) =>
      list.map((r) => (r.id === roomId ? { ...r, smartLockState: nextState } : r))
    );
    this.logAudit(
      `Toggled IoT door lock on ${room.code} to ${nextState}`,
      'Campus Floorplan & IoT',
      room.code
    );
    this.pushToast(
      `Door lock: ${nextState}`,
      `${room.code} (${room.name}) access door is now ${nextState}.`,
      'info'
    );
  }

  adjustRoomHvac(roomId: string, delta: number): void {
    this.rooms.update((list) =>
      list.map((r) => {
        if (r.id !== roomId) return r;
        const nextTemp = Number(Math.max(18, Math.min(27, r.hvacTempC + delta)).toFixed(1));
        const nextKw = Number(Math.max(1.2, r.energyKw - delta * 0.35).toFixed(1));
        return { ...r, hvacTempC: nextTemp, energyKw: nextKw };
      })
    );
  }

  // --- EQUIPMENT & ASSET LIFECYCLE ---

  getAssetBookValue(asset: EquipmentAsset): number {
    const purchaseYear = new Date(asset.purchaseDate).getFullYear();
    const ageYears = Math.max(0, 2026 - purchaseYear);
    const annualDepreciation =
      (asset.purchaseCostPhp - asset.salvageValuePhp) / Math.max(1, asset.usefulLifeYears);
    const currentVal = asset.purchaseCostPhp - annualDepreciation * ageYears;
    return Math.max(asset.salvageValuePhp, Math.round(currentVal));
  }

  checkoutEquipment(
    assetId: string,
    badgeOrId: string,
    borrowerName: string,
    dueDate: string
  ): { ok: boolean; message: string } {
    const asset = this.equipment().find((e) => e.id === assetId);
    if (!asset) return { ok: false, message: 'Equipment asset not found.' };
    if (asset.availableQty <= 0) return { ok: false, message: 'No units available for check-out.' };
    if (asset.condition !== 'Optimal') {
      return { ok: false, message: `Asset is currently marked "${asset.condition}".` };
    }

    const matchedStudent = this.students().find(
      (s) =>
        s.rfidUid.toLowerCase() === badgeOrId.toLowerCase() ||
        s.studentNumber.toLowerCase() === badgeOrId.toLowerCase()
    );
    if (matchedStudent) {
      if (matchedStudent.clearanceStatus !== 'Cleared') {
        return {
          ok: false,
          message: `Eligibility blocked: ${matchedStudent.name} has "${matchedStudent.clearanceStatus}". Settle balance of ₱${matchedStudent.outstandingBalancePhp} in Student Cashier first.`,
        };
      }
      if (
        asset.eligibilityRule === 'Faculty & Lab Certified Only' &&
        matchedStudent.eligibilityTier === 'Standard'
      ) {
        return {
          ok: false,
          message: `Eligibility blocked: ${asset.name} requires "Lab Certified" badge tier.`,
        };
      }
      if (asset.eligibilityRule === 'Faculty & Staff Only') {
        return {
          ok: false,
          message: `Eligibility blocked: ${asset.name} is restricted to Faculty & Staff only.`,
        };
      }
    }

    this.equipment.update((list) =>
      list.map((e) =>
        e.id === assetId
          ? {
              ...e,
              availableQty: e.availableQty - 1,
              currentHolderBadge: badgeOrId,
              currentHolderName: matchedStudent ? matchedStudent.name : borrowerName,
              dueDate,
            }
          : e
      )
    );

    if (matchedStudent) {
      this.students.update((list) =>
        list.map((s) =>
          s.id === matchedStudent.id
            ? { ...s, activeLoansCount: s.activeLoansCount + 1 }
            : s
        )
      );
    }

    this.logAudit(
      `Issued ${asset.assetTag} (${asset.name}) to badge ${badgeOrId}`,
      'Equipment Inventory',
      asset.assetTag
    );
    this.pushToast(
      'Equipment issued',
      `${asset.name} (${asset.assetTag}) issued to ${matchedStudent ? matchedStudent.name : borrowerName} via RFID ${badgeOrId}.`,
      'success'
    );
    return { ok: true, message: 'Checked out successfully.' };
  }

  checkinEquipment(assetId: string): void {
    const asset = this.equipment().find((e) => e.id === assetId);
    if (!asset || asset.availableQty >= asset.totalQty) return;

    this.equipment.update((list) =>
      list.map((e) =>
        e.id === assetId
          ? {
              ...e,
              availableQty: Math.min(e.totalQty, e.availableQty + 1),
              currentHolderBadge: undefined,
              currentHolderName: undefined,
              dueDate: undefined,
            }
          : e
      )
    );

    this.logAudit(
      `Checked in ${asset.assetTag} (${asset.name}) and verified condition`,
      'Equipment Inventory',
      asset.assetTag
    );
    this.pushToast(
      'Equipment returned',
      `${asset.name} (${asset.assetTag}) returned to inventory.`,
      'info'
    );
  }

  // --- STAFF & FACULTY RESOURCE ALLOCATION ---

  assignTaskToStaff(
    staffId: string,
    payload: {
      title: string;
      type: 'Course Lecture' | 'Lab Supervision' | 'Event Coordination' | 'Facility Operations';
      schedule: string;
      roomCode: string;
      hours: number;
    }
  ): { ok: boolean; message: string } {
    const member = this.staff().find((s) => s.id === staffId);
    if (!member) return { ok: false, message: 'Staff member not found.' };

    if (member.assignedHours + payload.hours > member.maxWeeklyHours) {
      return {
        ok: false,
        message: `Workload cap exceeded: ${member.name} has ${member.assignedHours}/${member.maxWeeklyHours} hrs assigned.`,
      };
    }

    const newItem = {
      id: 'ASN-' + Math.floor(1000 + Math.random() * 9000),
      ...payload,
    };

    this.staff.update((list) =>
      list.map((s) =>
        s.id === staffId
          ? {
              ...s,
              assignedHours: s.assignedHours + payload.hours,
              assignments: [newItem, ...s.assignments],
            }
          : s
      )
    );

    this.logAudit(
      `Assigned "${payload.title}" (${payload.hours}h/wk) to ${member.name}`,
      'Faculty & Staff Load',
      member.employeeId
    );
    this.pushToast(
      'Personnel assigned',
      `Assigned "${payload.title}" to ${member.name} (${member.assignedHours + payload.hours}/${member.maxWeeklyHours} hrs).`,
      'success'
    );
    return { ok: true, message: 'Assigned successfully.' };
  }

  // --- STUDENT SERVICES, RFID/QR & PAYMENTS ---

  processPayment(payload: {
    studentId: string;
    description: string;
    category: PaymentTransaction['category'];
    amountPhp: number;
    method: PaymentTransaction['method'];
  }): void {
    const student = this.students().find((s) => s.id === payload.studentId);
    const payerName = student ? student.name : this.activePersona().name;
    const tx: PaymentTransaction = {
      id: 'PAY-' + Math.floor(10000 + Math.random() * 90000),
      referenceNo: `${payload.method.toUpperCase().replace(/\s+/g, '')}-${Date.now().toString().slice(-6)}`,
      payerId: student ? student.studentNumber : this.activePersona().id,
      payerName,
      description: payload.description,
      category: payload.category,
      amountPhp: payload.amountPhp,
      method: payload.method,
      status: 'Paid',
      timestamp: '2026-11-04 08:45',
    };

    this.payments.update((list) => [tx, ...list]);

    if (student) {
      const remaining = Math.max(0, student.outstandingBalancePhp - payload.amountPhp);
      this.students.update((list) =>
        list.map((s) =>
          s.id === student.id
            ? {
                ...s,
                outstandingBalancePhp: remaining,
                clearanceStatus: remaining === 0 ? 'Cleared' : s.clearanceStatus,
              }
            : s
        )
      );
    }

    this.logAudit(
      `Processed payment ${tx.referenceNo} of ₱${payload.amountPhp} via ${payload.method}`,
      'Student ID & Cashier',
      tx.referenceNo
    );
    this.pushToast(
      'Payment recorded',
      `₱${payload.amountPhp.toLocaleString()} paid via ${payload.method} (Ref: ${tx.referenceNo}). Clearance updated.`,
      'success'
    );
  }

  submitServiceRequest(payload: {
    studentId: string;
    requestType: ServiceRequest['requestType'];
    details: string;
  }): void {
    const student = this.students().find((s) => s.id === payload.studentId);
    const req: ServiceRequest = {
      id: 'SRQ-' + Math.floor(1000 + Math.random() * 9000),
      studentId: student ? student.studentNumber : 'STU-2026-0184',
      studentName: student ? student.name : 'Ma. Theresa Macaraeg',
      requestType: payload.requestType,
      details: payload.details,
      status: 'Pending',
      submittedAt: '2026-11-04',
    };
    this.serviceRequests.update((list) => [req, ...list]);
    this.logAudit(
      `Submitted student service request "${payload.requestType}"`,
      'Student ID & Cashier',
      req.id
    );
    this.pushToast(
      'Service request submitted',
      `${req.requestType} logged for review (${req.id}).`,
      'success'
    );
  }

  approveServiceRequest(reqId: string): void {
    const req = this.serviceRequests().find((r) => r.id === reqId);
    if (!req) return;
    this.serviceRequests.update((list) =>
      list.map((r) => (r.id === reqId ? { ...r, status: 'Approved' } : r))
    );
    if (req.requestType === 'Lab Access Permission') {
      this.students.update((list) =>
        list.map((s) =>
          s.studentNumber === req.studentId
            ? { ...s, eligibilityTier: 'Lab Certified' }
            : s
        )
      );
    }
    this.pushToast(
      'Service request approved',
      `${req.requestType} for ${req.studentName} approved.`,
      'success'
    );
  }

  // --- MAINTENANCE & WORK ORDERS ---

  createWorkOrder(payload: {
    targetRoomId: string;
    issueType: WorkOrder['issueType'];
    priority: WorkOrder['priority'];
    blocksRoomAvailability: boolean;
    assignedStaffName: string;
    estimatedCostPhp: number;
  }): void {
    const room = this.getRoomById(payload.targetRoomId);
    const targetName = room ? `${room.code} · ${room.name}` : payload.targetRoomId;
    const wo: WorkOrder = {
      id: 'WO-' + Math.floor(1000 + Math.random() * 9000),
      ticketNo: 'MT-2026-' + Math.floor(100 + Math.random() * 899),
      targetRoomId: payload.targetRoomId,
      targetName,
      issueType: payload.issueType,
      priority: payload.priority,
      blocksRoomAvailability: payload.blocksRoomAvailability,
      assignedStaffName: payload.assignedStaffName,
      status: 'Open',
      estimatedCostPhp: payload.estimatedCostPhp,
      slaDeadline: '2026-11-05 17:00',
      createdAt: '2026-11-04',
    };

    this.workOrders.update((list) => [wo, ...list]);

    if (payload.blocksRoomAvailability && room) {
      this.toggleRoomAvailability(
        room.id,
        'Under Maintenance',
        `Work Order ${wo.ticketNo}: ${wo.issueType}`
      );
    } else {
      this.logAudit(
        `Created maintenance ticket ${wo.ticketNo} (${wo.issueType}) for ${targetName}`,
        'Approvals & Upkeep',
        wo.ticketNo
      );
      this.pushToast(
        'Work order dispatched',
        `${wo.ticketNo} (${wo.issueType}) assigned to ${wo.assignedStaffName}.`,
        'info'
      );
    }
  }

  updateWorkOrderStatus(woId: string, status: WorkOrder['status']): void {
    const wo = this.workOrders().find((w) => w.id === woId);
    if (!wo) return;

    this.workOrders.update((list) =>
      list.map((w) => (w.id === woId ? { ...w, status } : w))
    );

    if (status === 'Resolved' && wo.blocksRoomAvailability) {
      this.toggleRoomAvailability(wo.targetRoomId, 'Operational');
    } else {
      this.pushToast(
        'Work order updated',
        `Ticket ${wo.ticketNo} marked as ${status}.`,
        'success'
      );
    }
  }

  // --- EMERGENCY RESPONSE & ECOSYSTEM ---

  triggerEmergencyProtocol(
    protocol: EmergencyState['protocol'],
    broadcastMessage: string
  ): void {
    const persona = this.activePersona();
    this.emergency.set({
      active: true,
      protocol,
      broadcastMessage,
      activatedBy: persona.name,
      activatedAt: '2026-11-04 09:15 PST',
      autoUnlockExits: true,
    });

    this.rooms.update((list) =>
      list.map((r) => ({
        ...r,
        smartLockState:
          protocol === 'Facility Security Lockdown' ? 'Locked' : 'Emergency Open',
      }))
    );

    this.logAudit(
      `Activated emergency protocol: ${protocol}`,
      'Emergency Response',
      protocol,
      'Security'
    );
    this.pushToast(
      `Emergency alert active: ${protocol}`,
      broadcastMessage,
      'error',
      {
        label: 'Stand down alert',
        onUndo: () => this.resolveEmergency(),
      }
    );
  }

  resolveEmergency(): void {
    this.emergency.set({
      active: false,
      protocol: 'None',
      broadcastMessage: '',
      activatedBy: '',
      activatedAt: '',
      autoUnlockExits: true,
    });
    this.rooms.update((list) =>
      list.map((r) => ({ ...r, smartLockState: 'Locked' }))
    );
    this.logAudit(
      'Resolved campus emergency protocol and restored standard door lock policies',
      'Emergency Response',
      'ALL-CLEAR',
      'Info'
    );
    this.pushToast(
      'All-clear broadcast sent',
      'Campus facilities restored to standard operational access.',
      'success'
    );
  }

  syncEcosystemIntegration(integrationId: string): void {
    const target = this.integrations().find((i) => i.id === integrationId);
    if (!target) return;

    this.integrations.update((list) =>
      list.map((i) =>
        i.id === integrationId
          ? {
              ...i,
              status: 'Connected',
              lastSync: '2026-11-04 09:18',
              recordsSynced: i.recordsSynced + Math.floor(11 + Math.random() * 37),
            }
          : i
      )
    );
    this.logAudit(
      `Synchronized ${target.systemName} (${target.category}) via REST connector`,
      'Audit Log & RA 10173',
      target.id
    );
    this.pushToast(
      'Integration synchronized',
      `${target.systemName} synced with zero schema errors.`,
      'success'
    );
  }

  resetDemoData(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.rooms.set(this.getInitialRooms());
    this.termCourses.set(this.getInitialTermCourses());
    this.bookings.set(this.getInitialBookings());
    this.equipment.set(this.getInitialEquipment());
    this.staff.set(this.getInitialStaff());
    this.students.set(this.getInitialStudents());
    this.serviceRequests.set(this.getInitialServiceRequests());
    this.payments.set(this.getInitialPayments());
    this.workOrders.set(this.getInitialWorkOrders());
    this.budgets.set(this.getInitialBudgets());
    this.auditLogs.set(this.getInitialAuditLogs());
    this.integrations.set(this.getInitialIntegrations());
    this.emergency.set({
      active: false,
      protocol: 'None',
      broadcastMessage: '',
      activatedBy: '',
      activatedAt: '',
      autoUnlockExits: true,
    });
    this.pushToast(
      'Dataset restored to defaults',
      'All Biñan Campus rooms, term course schedules, and inventory records have been reset.',
      'info'
    );
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.rooms) this.rooms.set(parsed.rooms);
      if (parsed.termCourses) this.termCourses.set(parsed.termCourses);
      if (parsed.bookings) this.bookings.set(parsed.bookings);
      if (parsed.equipment) this.equipment.set(parsed.equipment);
      if (parsed.staff) this.staff.set(parsed.staff);
      if (parsed.students) this.students.set(parsed.students);
      if (parsed.serviceRequests) this.serviceRequests.set(parsed.serviceRequests);
      if (parsed.payments) this.payments.set(parsed.payments);
      if (parsed.workOrders) this.workOrders.set(parsed.workOrders);
      if (parsed.budgets) this.budgets.set(parsed.budgets);
      if (parsed.auditLogs) this.auditLogs.set(parsed.auditLogs);
      if (parsed.integrations) this.integrations.set(parsed.integrations);
      if (parsed.emergency) this.emergency.set(parsed.emergency);
    } catch {
      // Fallback to initial seed data
    }
  }

  private getInitialRooms(): FacilityRoom[] {
    return [
      {
        id: 'RM-101',
        code: 'Rm 101, Rizal Hall',
        name: 'Rizal Lecture Room 101',
        building: 'Main Academic Hall',
        floor: 1,
        svgX: 30,
        svgY: 30,
        svgW: 240,
        svgH: 145,
        capacity: 44,
        type: 'Classroom',
        availabilityState: 'Operational',
        installedEquipment: ['4K Laser Projector', 'Interactive Smartboard', 'Lapel Audio Receiver', 'Dual Split Inverter AC'],
        hourlyCostPhp: 840,
        smartLockState: 'Unlocked',
        occupancyCount: 37,
        energyKw: 3.4,
        hvacTempC: 22.4,
        isSafeZone: false,
      },
      {
        id: 'RM-102',
        code: 'Rm 102, Rizal Hall',
        name: 'Bonifacio Seminar Room 102',
        building: 'Main Academic Hall',
        floor: 1,
        svgX: 290,
        svgY: 30,
        svgW: 220,
        svgH: 145,
        capacity: 38,
        type: 'Classroom',
        availabilityState: 'Operational',
        installedEquipment: ['Interactive Smartboard', '4K Laser Projector', 'Document Camera'],
        hourlyCostPhp: 780,
        smartLockState: 'Unlocked',
        occupancyCount: 0,
        energyKw: 1.6,
        hvacTempC: 24.1,
        isSafeZone: false,
      },
      {
        id: 'RM-103',
        code: 'Rm 103, Mabini Wing',
        name: 'Mabini Case Room 103',
        building: 'Main Academic Hall',
        floor: 1,
        svgX: 530,
        svgY: 30,
        svgW: 240,
        svgH: 145,
        capacity: 48,
        type: 'Classroom',
        availabilityState: 'Under Maintenance',
        unavailabilityReason: 'Work Order MT-2026-409: Chilled water AC compressor replacement',
        installedEquipment: ['4K Laser Projector', 'Interactive Smartboard', 'Lapel Audio Receiver'],
        hourlyCostPhp: 920,
        smartLockState: 'Locked',
        occupancyCount: 2,
        energyKw: 0.7,
        hvacTempC: 26.8,
        isSafeZone: false,
      },
      {
        id: 'RM-104',
        code: 'Aud 104, Main Hall',
        name: 'Plaridel Campus Auditorium',
        building: 'Main Academic Hall',
        floor: 1,
        svgX: 30,
        svgY: 215,
        svgW: 480,
        svgH: 155,
        capacity: 240,
        type: 'Auditorium',
        availabilityState: 'Operational',
        installedEquipment: ['Line Array Sound System', 'Stage LED Projection Wall', 'PTZ Lecture Cameras', 'Acoustic Stage Rig'],
        hourlyCostPhp: 3450,
        smartLockState: 'Locked',
        occupancyCount: 118,
        energyKw: 11.4,
        hvacTempC: 21.2,
        isSafeZone: true,
        safeZoneCapacity: 310,
      },
      {
        id: 'RM-105',
        code: 'Rm 202, Mabini Wing',
        name: 'Faculty & Thesis Colloquium Room',
        building: 'Main Academic Hall',
        floor: 2,
        svgX: 530,
        svgY: 215,
        svgW: 240,
        svgH: 155,
        capacity: 42,
        type: 'Classroom',
        availabilityState: 'Operational',
        installedEquipment: ['Interactive Smartboard', '4K Laser Projector', 'Glass Whiteboard Wall', 'USB-C Table Hubs'],
        hourlyCostPhp: 760,
        smartLockState: 'Unlocked',
        occupancyCount: 19,
        energyKw: 2.3,
        hvacTempC: 22.8,
        isSafeZone: false,
      },
      {
        id: 'RM-201',
        code: 'Rm 201, Science Bldg',
        name: 'Computing & Networks Lab 201',
        building: 'Science & Innovation Wing',
        floor: 2,
        svgX: 30,
        svgY: 30,
        svgW: 360,
        svgH: 150,
        capacity: 40,
        type: 'Laboratory',
        availabilityState: 'Operational',
        installedEquipment: ['40x Linux/Windows Workstations', 'Interactive Smartboard', 'Managed Fiber Switch', 'Precision Rack Cooling'],
        hourlyCostPhp: 1750,
        smartLockState: 'Unlocked',
        occupancyCount: 35,
        energyKw: 8.7,
        hvacTempC: 20.3,
        isSafeZone: false,
      },
      {
        id: 'RM-202',
        code: 'Rm 202, Science Bldg',
        name: 'Microprocessors & Robotics Lab 202',
        building: 'Science & Innovation Wing',
        floor: 2,
        svgX: 410,
        svgY: 30,
        svgW: 360,
        svgH: 150,
        capacity: 36,
        type: 'Laboratory',
        availabilityState: 'Under Maintenance',
        unavailabilityReason: 'Work Order MT-2026-412: 3-phase bench power and oscilloscope calibration',
        installedEquipment: ['40x Linux/Windows Workstations', 'Digital Oscilloscope Benches', 'Bench Fume Extractors', 'Interactive Smartboard'],
        hourlyCostPhp: 1620,
        smartLockState: 'Locked',
        occupancyCount: 1,
        energyKw: 1.1,
        hvacTempC: 25.4,
        isSafeZone: false,
      },
      {
        id: 'RM-203',
        code: 'Rm 204, Science Bldg',
        name: 'Analytical Chemistry Wet Lab 204',
        building: 'Science & Innovation Wing',
        floor: 1,
        svgX: 30,
        svgY: 215,
        svgW: 740,
        svgH: 155,
        capacity: 38,
        type: 'Laboratory',
        availabilityState: 'Operational',
        installedEquipment: ['Ducted Chemical Fume Hoods', 'Safety Drench Shower', 'Analytical Microbalances', 'Interactive Smartboard'],
        hourlyCostPhp: 1890,
        smartLockState: 'Unlocked',
        occupancyCount: 29,
        energyKw: 6.3,
        hvacTempC: 21.5,
        isSafeZone: false,
      },
      {
        id: 'RM-301',
        code: 'Court A, Sports Complex',
        name: 'Biñan Varsity Gymnasium & Muster Court',
        building: 'University Sports Complex',
        floor: 1,
        svgX: 30,
        svgY: 30,
        svgW: 480,
        svgH: 340,
        capacity: 480,
        type: 'Sports Court',
        availabilityState: 'Operational',
        installedEquipment: ['Digital Shotclock & Scoreboard', 'PA Sound System', 'First Aid Triage Bay', 'Backup Diesel Generator'],
        hourlyCostPhp: 2750,
        smartLockState: 'Unlocked',
        occupancyCount: 64,
        energyKw: 7.4,
        hvacTempC: 24.6,
        isSafeZone: true,
        safeZoneCapacity: 780,
      },
      {
        id: 'RM-302',
        code: 'Rm 108, Sports Complex',
        name: 'Human Kinetics & Conditioning Room',
        building: 'University Sports Complex',
        floor: 1,
        svgX: 530,
        svgY: 30,
        svgW: 240,
        svgH: 340,
        capacity: 34,
        type: 'Sports Court',
        availabilityState: 'Operational',
        installedEquipment: ['Rowing Ergometers', 'Wall Mirrors', 'PA Sound System'],
        hourlyCostPhp: 880,
        smartLockState: 'Unlocked',
        occupancyCount: 21,
        energyKw: 2.8,
        hvacTempC: 22.1,
        isSafeZone: true,
        safeZoneCapacity: 85,
      },
      {
        id: 'RM-401',
        code: 'Rm 201, Student Union',
        name: 'Laguna Colloquium & Seminar Hall',
        building: 'Student Union Center',
        floor: 2,
        svgX: 30,
        svgY: 30,
        svgW: 450,
        svgH: 340,
        capacity: 76,
        type: 'Classroom',
        availabilityState: 'Operational',
        installedEquipment: ['4K Laser Projector', 'Interactive Smartboard', 'Modular Seminar Tables', 'Document Camera'],
        hourlyCostPhp: 1180,
        smartLockState: 'Unlocked',
        occupancyCount: 41,
        energyKw: 4.2,
        hvacTempC: 22.3,
        isSafeZone: true,
        safeZoneCapacity: 140,
      },
      {
        id: 'RM-402',
        code: 'Pod B, Student Union',
        name: 'Student Research & Thesis Study Commons',
        building: 'Student Union Center',
        floor: 1,
        svgX: 500,
        svgY: 30,
        svgW: 270,
        svgH: 340,
        capacity: 32,
        type: 'Study Pod',
        availabilityState: 'Operational',
        installedEquipment: ['Campus Wi-Fi 6E AP', 'Interactive Smartboard', 'RFID Parcel & Day Lockers'],
        hourlyCostPhp: 420,
        smartLockState: 'Unlocked',
        occupancyCount: 23,
        energyKw: 1.9,
        hvacTempC: 23.2,
        isSafeZone: false,
      },
    ];
  }

  private getInitialTermCourses(): TermCourseAssignment[] {
    return [
      {
        id: 'CRS-101',
        academicTerm: '1st Semester AY 2026-2027',
        courseCode: 'CS-301',
        courseTitle: 'Data Structures & Algorithm Analysis',
        department: 'College of Computing & Engineering',
        instructorId: 'FAC-101',
        instructorName: 'Engr. Arnel Panganiban',
        enrolledStudents: 39,
        requiredEquipment: ['4K Laser Projector', 'Interactive Smartboard'],
        scheduleDays: 'MWF',
        startTime: '09:00',
        endTime: '10:30',
        constantRoomId: 'RM-103',
      },
      {
        id: 'CRS-102',
        academicTerm: '1st Semester AY 2026-2027',
        courseCode: 'CPE-304L',
        courseTitle: 'Microprocessors & Interfacing Lab',
        department: 'College of Computing & Engineering',
        instructorId: 'FAC-101',
        instructorName: 'Engr. Arnel Panganiban',
        enrolledStudents: 34,
        requiredEquipment: ['40x Linux/Windows Workstations', 'Interactive Smartboard'],
        scheduleDays: 'TTh',
        startTime: '13:00',
        endTime: '15:00',
        constantRoomId: 'RM-202',
      },
      {
        id: 'CRS-103',
        academicTerm: '1st Semester AY 2026-2027',
        courseCode: 'CS-402',
        courseTitle: 'Statistical Pattern Recognition & ML',
        department: 'College of Computing & Engineering',
        instructorId: 'FAC-101',
        instructorName: 'Engr. Arnel Panganiban',
        enrolledStudents: 36,
        requiredEquipment: ['40x Linux/Windows Workstations', 'Interactive Smartboard'],
        scheduleDays: 'MWF',
        startTime: '10:30',
        endTime: '12:00',
        constantRoomId: 'RM-201',
      },
      {
        id: 'CRS-104',
        academicTerm: '1st Semester AY 2026-2027',
        courseCode: 'CHEM-201L',
        courseTitle: 'Quantitative Analytical Chemistry Lab',
        department: 'College of Science & Biotechnology',
        instructorId: 'FAC-102',
        instructorName: 'Dr. Lourdes Dimaculangan',
        enrolledStudents: 31,
        requiredEquipment: ['Ducted Chemical Fume Hoods', 'Interactive Smartboard'],
        scheduleDays: 'TTh',
        startTime: '09:00',
        endTime: '12:00',
        constantRoomId: 'RM-203',
      },
      {
        id: 'CRS-105',
        academicTerm: '1st Semester AY 2026-2027',
        courseCode: 'ACTG-210',
        courseTitle: 'Cost Accounting & Budget Control',
        department: 'College of Business & Accountancy',
        instructorId: 'FAC-103',
        instructorName: 'Prof. Josefa Macaraeg',
        enrolledStudents: 41,
        requiredEquipment: ['4K Laser Projector', 'Interactive Smartboard'],
        scheduleDays: 'MWF',
        startTime: '08:00',
        endTime: '09:30',
        constantRoomId: 'RM-101',
      },
      {
        id: 'CRS-106',
        academicTerm: '1st Semester AY 2026-2027',
        courseCode: 'HK-104',
        courseTitle: 'Human Kinetics & Team Conditioning',
        department: 'Department of Physical Education',
        instructorId: 'FAC-104',
        instructorName: 'Coach Rafael Tolentino',
        enrolledStudents: 29,
        requiredEquipment: ['Rowing Ergometers', 'PA Sound System'],
        scheduleDays: 'Sat',
        startTime: '08:00',
        endTime: '11:00',
        constantRoomId: 'RM-302',
      },
    ];
  }

  private getInitialBookings(): BookingRecord[] {
    return [
      {
        id: 'BKG-8011',
        resourceType: 'Event',
        bookingSubtype: 'Campus Event',
        targetId: 'RM-104',
        targetName: 'Aud 104, Main Hall · Plaridel Campus Auditorium',
        title: 'Laguna Engineering & Research Colloquium 2026',
        category: 'Seminar & Symposium',
        requesterName: 'Engr. Arnel Panganiban',
        requesterRole: 'Faculty',
        requesterId: 'FAC-101',
        department: 'College of Computing & Engineering',
        date: '2026-11-05',
        startTime: '13:00',
        endTime: '17:00',
        attendees: 215,
        requiredEquipment: ['Line Array Sound System', 'Stage LED Projection Wall', 'PTZ Lecture Cameras'],
        status: 'Approved',
        autoAssigned: true,
        fitScore: 97,
        costPhp: 6900,
        createdAt: '2026-11-02 14:12',
      },
      {
        id: 'BKG-8012',
        resourceType: 'Room',
        bookingSubtype: 'Ad-Hoc Reservation',
        targetId: 'RM-401',
        targetName: 'Rm 201, Student Union · Laguna Colloquium & Seminar Hall',
        title: 'IEEE Biñan Chapter Embedded Systems Review',
        category: 'Club Activity',
        requesterName: 'Ma. Theresa Macaraeg',
        requesterRole: 'Student',
        requesterId: 'STU-2026-0184',
        department: 'Student Council / IEEE Biñan Chapter',
        date: '2026-11-04',
        startTime: '15:00',
        endTime: '18:00',
        attendees: 62,
        requiredEquipment: ['4K Laser Projector', 'Interactive Smartboard'],
        status: 'Pending Approval',
        autoAssigned: true,
        fitScore: 94,
        costPhp: 2360,
        createdAt: '2026-11-03 10:05',
      },
      {
        id: 'BKG-8013',
        resourceType: 'Equipment',
        bookingSubtype: 'Equipment Loan',
        targetId: 'EQ-103',
        targetName: 'AST-AV-009 · Sony FX3 Camera & Lapel Kit',
        title: 'Campus Journalism Documentary Field Recording',
        category: 'Club Activity',
        requesterName: 'Ma. Theresa Macaraeg',
        requesterRole: 'Student',
        requesterId: 'STU-2026-0184',
        department: 'Student Council / IEEE Biñan Chapter',
        date: '2026-11-06',
        startTime: '09:00',
        endTime: '16:00',
        attendees: 6,
        requiredEquipment: ['Cinema Camera', 'Fluid Head Tripod'],
        status: 'Pending Approval',
        autoAssigned: false,
        costPhp: 480,
        createdAt: '2026-11-03 16:40',
      },
      {
        id: 'BKG-8014',
        resourceType: 'Room',
        bookingSubtype: 'Ad-Hoc Reservation',
        targetId: 'RM-402',
        targetName: 'Pod B, Student Union · Student Research & Thesis Study Commons',
        title: 'Undergraduate Thesis Defense Prep - Group 4',
        category: 'Student Study',
        requesterName: 'Ma. Theresa Macaraeg',
        requesterRole: 'Student',
        requesterId: 'STU-2026-0184',
        department: 'College of Computing & Engineering',
        date: '2026-11-04',
        startTime: '13:00',
        endTime: '15:00',
        attendees: 11,
        requiredEquipment: ['Interactive Smartboard'],
        status: 'Approved',
        autoAssigned: true,
        fitScore: 93,
        costPhp: 840,
        createdAt: '2026-11-03 09:20',
      },
      {
        id: 'BKG-8015',
        resourceType: 'Event',
        bookingSubtype: 'Campus Event',
        targetId: 'RM-301',
        targetName: 'Court A, Sports Complex · Biñan Varsity Gymnasium & Muster Court',
        title: 'CALABARZON Inter-Collegiate Volleyball Eliminations',
        category: 'Sports Tournament',
        requesterName: 'Coach Rafael Tolentino',
        requesterRole: 'Faculty',
        requesterId: 'FAC-104',
        department: 'Department of Physical Education',
        date: '2026-11-07',
        startTime: '08:00',
        endTime: '17:00',
        attendees: 410,
        requiredEquipment: ['Digital Shotclock & Scoreboard', 'PA Sound System'],
        status: 'Pending Approval',
        autoAssigned: false,
        fitScore: 98,
        costPhp: 13750,
        createdAt: '2026-11-03 11:15',
      },
    ];
  }

  private getInitialEquipment(): EquipmentAsset[] {
    return [
      {
        id: 'EQ-101',
        assetTag: 'AST-LPT-042',
        serialNumber: 'SN-MBP16-88412A',
        name: 'MacBook Pro 16" M3 Mobile Lab Fleet',
        category: 'Laptops',
        totalQty: 24,
        availableQty: 18,
        locationRoomId: 'RM-201',
        condition: 'Optimal',
        purchaseDate: '2024-06-15',
        purchaseCostPhp: 164800,
        usefulLifeYears: 5,
        salvageValuePhp: 24500,
        warrantyExpiry: '2027-06-15',
        replacementScheduleDate: '2029-06-15',
        currentHolderBadge: 'RFID-9921-STU',
        currentHolderName: 'Ma. Theresa Macaraeg',
        dueDate: '2026-11-06',
        eligibilityRule: 'All Cleared Users',
      },
      {
        id: 'EQ-102',
        assetTag: 'AST-LAB-108',
        serialNumber: 'SN-TEK-40921B',
        name: 'Tektronix 4-Ch Mixed Domain Oscilloscope',
        category: 'Lab Tools',
        totalQty: 16,
        availableQty: 13,
        locationRoomId: 'RM-202',
        condition: 'Optimal',
        purchaseDate: '2023-08-10',
        purchaseCostPhp: 127500,
        usefulLifeYears: 7,
        salvageValuePhp: 18200,
        warrantyExpiry: '2028-08-10',
        replacementScheduleDate: '2030-08-10',
        currentHolderBadge: 'RFID-4410-FAC',
        currentHolderName: 'Engr. Arnel Panganiban',
        dueDate: '2026-11-05',
        eligibilityRule: 'Faculty & Lab Certified Only',
      },
      {
        id: 'EQ-103',
        assetTag: 'AST-AV-009',
        serialNumber: 'SN-SNY-FX3-771',
        name: 'Sony FX3 Camera & Wireless Lapel Kit',
        category: 'AV Gear',
        totalQty: 6,
        availableQty: 5,
        locationRoomId: 'RM-401',
        condition: 'Optimal',
        purchaseDate: '2025-01-20',
        purchaseCostPhp: 214500,
        usefulLifeYears: 5,
        salvageValuePhp: 34000,
        warrantyExpiry: '2028-01-20',
        replacementScheduleDate: '2030-01-20',
        eligibilityRule: 'All Cleared Users',
      },
      {
        id: 'EQ-104',
        assetTag: 'AST-SPT-310',
        serialNumber: 'SN-MOL-VB2025',
        name: 'Molten V5M5000 Competition Volleyball Kit (12 Balls + Net)',
        category: 'Sports Gear',
        totalQty: 10,
        availableQty: 7,
        locationRoomId: 'RM-301',
        condition: 'Optimal',
        purchaseDate: '2025-05-01',
        purchaseCostPhp: 47600,
        usefulLifeYears: 3,
        salvageValuePhp: 4200,
        warrantyExpiry: '2027-05-01',
        replacementScheduleDate: '2028-05-01',
        eligibilityRule: 'All Cleared Users',
      },
      {
        id: 'EQ-105',
        assetTag: 'AST-CHM-502',
        serialNumber: 'SN-MET-AB204',
        name: 'Mettler Toledo Analytical Microbalance (0.1mg)',
        category: 'Lab Tools',
        totalQty: 8,
        availableQty: 8,
        locationRoomId: 'RM-203',
        condition: 'Optimal',
        purchaseDate: '2022-11-12',
        purchaseCostPhp: 189400,
        usefulLifeYears: 8,
        salvageValuePhp: 19500,
        warrantyExpiry: '2026-12-15',
        replacementScheduleDate: '2030-11-12',
        eligibilityRule: 'Faculty & Lab Certified Only',
      },
      {
        id: 'EQ-106',
        assetTag: 'AST-CNS-880',
        serialNumber: 'LOT-BIO-2026Q4',
        name: 'Titration Reagent & Micropipette Tip Box Set',
        category: 'Consumables',
        totalQty: 120,
        availableQty: 93,
        locationRoomId: 'RM-203',
        condition: 'Optimal',
        purchaseDate: '2026-08-01',
        purchaseCostPhp: 31850,
        usefulLifeYears: 1,
        salvageValuePhp: 0,
        warrantyExpiry: '2027-08-01',
        replacementScheduleDate: '2027-02-01',
        eligibilityRule: 'Faculty & Lab Certified Only',
      },
    ];
  }

  private getInitialStaff(): StaffMember[] {
    return [
      {
        id: 'STF-101',
        employeeId: 'FAC-101',
        name: 'Engr. Arnel Panganiban',
        department: 'College of Computing & Engineering',
        role: 'Faculty',
        email: 'a.panganiban@binan-its.edu.ph',
        specialization: 'Embedded Systems, Computer Architecture & Algorithms',
        maxWeeklyHours: 24,
        assignedHours: 18,
        availability: 'Available',
        assignments: [
          {
            id: 'ASN-1',
            title: 'CS-301 Data Structures & Algorithm Analysis',
            type: 'Course Lecture',
            schedule: 'MWF 09:00-10:30',
            roomCode: 'Rm 103, Mabini Wing (Under Maintenance)',
            hours: 6,
          },
          {
            id: 'ASN-2',
            title: 'CPE-304L Microprocessors & Interfacing Lab',
            type: 'Lab Supervision',
            schedule: 'TTh 13:00-15:00',
            roomCode: 'Rm 202, Science Bldg (Under Maintenance)',
            hours: 6,
          },
          {
            id: 'ASN-3',
            title: 'CS-402 Statistical Pattern Recognition & ML',
            type: 'Course Lecture',
            schedule: 'MWF 10:30-12:00',
            roomCode: 'Rm 201, Science Bldg',
            hours: 6,
          },
        ],
      },
      {
        id: 'STF-102',
        employeeId: 'FAC-102',
        name: 'Dr. Lourdes Dimaculangan',
        department: 'College of Science & Biotechnology',
        role: 'Faculty',
        email: 'l.dimaculangan@binan-its.edu.ph',
        specialization: 'Analytical Chemistry & Water Quality Instrumentation',
        maxWeeklyHours: 21,
        assignedHours: 15,
        availability: 'In Class / Duty',
        assignments: [
          {
            id: 'ASN-4',
            title: 'CHEM-201L Quantitative Analytical Chemistry',
            type: 'Lab Supervision',
            schedule: 'TTh 09:00-12:00',
            roomCode: 'Rm 204, Science Bldg',
            hours: 9,
          },
          {
            id: 'ASN-5',
            title: 'Chemical Safety & Fume Hood Inspection Lead',
            type: 'Facility Operations',
            schedule: 'Fri 14:00-17:00',
            roomCode: 'Rm 204, Science Bldg',
            hours: 6,
          },
        ],
      },
      {
        id: 'STF-103',
        employeeId: 'STF-204',
        name: 'Engr. Carlo Catindig',
        department: 'Facilities & Asset Management',
        role: 'Facilities Staff',
        email: 'c.catindig@binan-its.edu.ph',
        specialization: 'HVAC Chilled Water Plant, RFID Controllers & Power Metering',
        maxWeeklyHours: 40,
        assignedHours: 32,
        availability: 'Available',
        assignments: [
          {
            id: 'ASN-6',
            title: 'Rm 103 Mabini Wing Chilled Water Compressor Replacement',
            type: 'Facility Operations',
            schedule: 'Daily 08:00-12:00',
            roomCode: 'Rm 103, Mabini Wing',
            hours: 20,
          },
          {
            id: 'ASN-7',
            title: 'Campus RFID Door Lock & Energy Sub-Meter Calibration',
            type: 'Facility Operations',
            schedule: 'TTh 13:00-17:00',
            roomCode: 'All Buildings',
            hours: 12,
          },
        ],
      },
      {
        id: 'STF-104',
        employeeId: 'LAB-309',
        name: 'Paolo Manansala, ECT',
        department: 'College of Computing & Engineering',
        role: 'Lab Technician',
        email: 'p.manansala@binan-its.edu.ph',
        specialization: 'Oscilloscope Calibration & Linux Lab Image Deployment',
        maxWeeklyHours: 40,
        assignedHours: 28,
        availability: 'Available',
        assignments: [
          {
            id: 'ASN-8',
            title: 'Rm 202 Science Bldg 3-Phase Bench & Oscilloscope Calibration',
            type: 'Facility Operations',
            schedule: 'MWF 09:00-16:00',
            roomCode: 'Rm 202, Science Bldg',
            hours: 28,
          },
        ],
      },
    ];
  }

  private getInitialStudents(): StudentProfile[] {
    return [
      {
        id: 'STU-1',
        studentNumber: 'STU-2026-0184',
        name: 'Ma. Theresa Macaraeg',
        program: 'BS Computer Science',
        yearLevel: '3rd Year',
        rfidUid: 'RFID-9921-STU',
        qrBadgeId: 'QR-0184',
        clearanceStatus: 'Cleared',
        eligibilityTier: 'Varsity & Lab Certified',
        outstandingBalancePhp: 0,
        activeLoansCount: 1,
        dpaConsentSigned: true,
      },
      {
        id: 'STU-2',
        studentNumber: 'STU-2026-0412',
        name: 'Juan Miguel Evangelista',
        program: 'BS Computer Engineering',
        yearLevel: '4th Year',
        rfidUid: 'RFID-7734-STU',
        qrBadgeId: 'QR-0412',
        clearanceStatus: 'Hold - Unpaid Fine',
        eligibilityTier: 'Lab Certified',
        outstandingBalancePhp: 475,
        activeLoansCount: 0,
        dpaConsentSigned: true,
      },
      {
        id: 'STU-3',
        studentNumber: 'STU-2026-0891',
        name: 'Katrina Mae Soriano',
        program: 'BS Chemical Engineering',
        yearLevel: '2nd Year',
        rfidUid: 'RFID-6102-STU',
        qrBadgeId: 'QR-0891',
        clearanceStatus: 'Cleared',
        eligibilityTier: 'Standard',
        outstandingBalancePhp: 0,
        activeLoansCount: 0,
        dpaConsentSigned: true,
      },
    ];
  }

  private getInitialServiceRequests(): ServiceRequest[] {
    return [
      {
        id: 'SRQ-401',
        studentId: 'STU-2026-0891',
        studentName: 'Katrina Mae Soriano',
        requestType: 'Lab Access Permission',
        details: 'Requesting Analytical Chemistry Lab 204 microbalance certification for CHEM-201L.',
        status: 'Pending',
        submittedAt: '2026-11-03',
      },
      {
        id: 'SRQ-402',
        studentId: 'STU-2026-0184',
        studentName: 'Ma. Theresa Macaraeg',
        requestType: 'Locker Rental',
        details: 'Science Bldg 2nd Floor RFID Locker #B-14 for 1st Semester AY 2026-2027.',
        status: 'Approved',
        submittedAt: '2026-10-28',
      },
    ];
  }

  private getInitialPayments(): PaymentTransaction[] {
    return [
      {
        id: 'PAY-90101',
        referenceNo: 'GCASH-849201',
        payerId: 'STU-2026-0184',
        payerName: 'Ma. Theresa Macaraeg',
        description: 'Refundable Equipment Security Deposit (MacBook Pro 16" M3)',
        category: 'Equipment Deposit',
        amountPhp: 1500,
        method: 'GCash',
        status: 'Paid',
        timestamp: '2026-11-01 14:22',
      },
      {
        id: 'PAY-90102',
        referenceNo: 'MAYA-331094',
        payerId: 'STU-2026-0891',
        payerName: 'Katrina Mae Soriano',
        description: 'Science Wing Locker Rental Fee (1st Sem AY 2026-2027)',
        category: 'Facility Rental',
        amountPhp: 650,
        method: 'Maya',
        status: 'Paid',
        timestamp: '2026-10-29 11:08',
      },
    ];
  }

  private getInitialWorkOrders(): WorkOrder[] {
    return [
      {
        id: 'WO-101',
        ticketNo: 'MT-2026-409',
        targetRoomId: 'RM-103',
        targetName: 'Rm 103, Mabini Wing · Mabini Case Room 103',
        issueType: 'HVAC Repair',
        priority: 'Critical',
        blocksRoomAvailability: true,
        assignedStaffName: 'Engr. Carlo Catindig',
        status: 'In Progress',
        estimatedCostPhp: 18450,
        slaDeadline: '2026-11-05 12:00',
        createdAt: '2026-11-03',
      },
      {
        id: 'WO-102',
        ticketNo: 'MT-2026-412',
        targetRoomId: 'RM-202',
        targetName: 'Rm 202, Science Bldg · Microprocessors & Robotics Lab 202',
        issueType: 'Electrical Inspection',
        priority: 'High',
        blocksRoomAvailability: true,
        assignedStaffName: 'Paolo Manansala, ECT',
        status: 'In Progress',
        estimatedCostPhp: 9280,
        slaDeadline: '2026-11-05 16:00',
        createdAt: '2026-11-03',
      },
      {
        id: 'WO-103',
        ticketNo: 'MT-2026-398',
        targetRoomId: 'RM-104',
        targetName: 'Aud 104, Main Hall · Plaridel Campus Auditorium',
        issueType: 'Projector / AV Fix',
        priority: 'Routine',
        blocksRoomAvailability: false,
        assignedStaffName: 'Engr. Carlo Catindig',
        status: 'Resolved',
        estimatedCostPhp: 4150,
        slaDeadline: '2026-11-02 17:00',
        createdAt: '2026-11-01',
      },
    ];
  }

  private getInitialBudgets(): DepartmentBudget[] {
    return [
      {
        id: 'BDG-1',
        department: 'College of Computing & Engineering',
        code: 'CCE-2026',
        allocatedPhp: 1850000,
        spentPhp: 942650,
        encumberedPhp: 214800,
        monthlyBurnPhp: 192400,
        costCenterLead: 'Dean Rogelio Salazar, PhD',
      },
      {
        id: 'BDG-2',
        department: 'College of Science & Biotechnology',
        code: 'CSB-2026',
        allocatedPhp: 1420000,
        spentPhp: 684320,
        encumberedPhp: 148500,
        monthlyBurnPhp: 146800,
        costCenterLead: 'Dr. Lourdes Dimaculangan',
      },
      {
        id: 'BDG-3',
        department: 'Facilities & Asset Management',
        code: 'FAM-2026',
        allocatedPhp: 2150000,
        spentPhp: 1184900,
        encumberedPhp: 312400,
        monthlyBurnPhp: 248600,
        costCenterLead: 'Engr. Carlo Catindig',
      },
      {
        id: 'BDG-4',
        department: 'Department of Physical Education',
        code: 'DPE-2026',
        allocatedPhp: 780000,
        spentPhp: 318450,
        encumberedPhp: 74200,
        monthlyBurnPhp: 64500,
        costCenterLead: 'Coach Rafael Tolentino',
      },
      {
        id: 'BDG-5',
        department: 'Student Council / IEEE Biñan Chapter',
        code: 'SC-2026',
        allocatedPhp: 460000,
        spentPhp: 194300,
        encumberedPhp: 38900,
        monthlyBurnPhp: 39200,
        costCenterLead: 'Ma. Theresa Macaraeg',
      },
    ];
  }

  private getInitialAuditLogs(): AuditLogEntry[] {
    return [
      {
        id: 'AUD-84021',
        timestamp: '2026-11-04 08:14:22',
        actorName: 'Dr. Marites Villanueva',
        actorRole: 'Admin',
        action: 'Verified 1st Semester AY 2026-2027 constant room assignments across 6 courses',
        module: 'Term Courses & Rooms',
        targetRef: 'TERM-2026-S1',
        ipAddress: '10.42.88.14 (Biñan Campus Intranet)',
        severity: 'Info',
      },
      {
        id: 'AUD-84019',
        timestamp: '2026-11-03 16:45:09',
        actorName: 'Engr. Carlo Catindig',
        actorRole: 'Staff',
        action: 'Dispatched Work Order MT-2026-409; marked Rm 103, Mabini Wing Under Maintenance',
        module: 'Approvals & Upkeep',
        targetRef: 'MT-2026-409',
        ipAddress: '10.42.88.51 (Facilities VLAN)',
        severity: 'Warning',
      },
      {
        id: 'AUD-84015',
        timestamp: '2026-11-03 14:10:44',
        actorName: 'Paolo Manansala, ECT',
        actorRole: 'Staff',
        action: 'Dispatched Work Order MT-2026-412; marked Rm 202, Science Bldg Under Maintenance',
        module: 'Approvals & Upkeep',
        targetRef: 'MT-2026-412',
        ipAddress: '10.42.88.62 (Science Wing VLAN)',
        severity: 'Warning',
      },
      {
        id: 'AUD-84008',
        timestamp: '2026-11-02 09:30:00',
        actorName: 'Dr. Marites Villanueva',
        actorRole: 'Admin',
        action: 'Completed quarterly RA 10173 Data Privacy Act audit and RFID token rotation',
        module: 'Audit Log & RA 10173',
        targetRef: 'NPC-RA10173-Q4',
        ipAddress: '10.42.88.14 (Biñan Campus Intranet)',
        severity: 'Security',
      },
    ];
  }

  private getInitialIntegrations(): EcosystemIntegration[] {
    return [
      {
        id: 'INT-SIS',
        systemName: 'Biñan Banner Student Information System (SIS)',
        category: 'SIS',
        vendorOrProtocol: 'REST / OAuth2 JSON v2.4',
        status: 'Connected',
        lastSync: '2026-11-04 08:30 (4 mins ago)',
        recordsSynced: 14823,
        endpointUrl: 'GET https://api.binan-its.edu.ph/v2/sis/enrollments?term=2026-S1',
        samplePayload: `{
  "term": "1st Semester AY 2026-2027",
  "campus": "Binan Laguna Main",
  "syncedCourses": 6,
  "activeStudents": 4892,
  "dpaComplianceSeal": "NPC-PIC-2026-BINAN-0842"
}`,
      },
      {
        id: 'INT-LMS',
        systemName: 'Canvas LMS & Lecture Capture Sync',
        category: 'LMS',
        vendorOrProtocol: 'LTI 1.3 Advantage / Webhook',
        status: 'Connected',
        lastSync: '2026-11-04 08:25 (9 mins ago)',
        recordsSynced: 3419,
        endpointUrl: 'POST https://api.binan-its.edu.ph/v2/lms/room-relocation-webhook',
        samplePayload: `{
  "event": "COURSE_ROOM_RELOCATED",
  "courseCode": "CS-301",
  "originalRoom": "Rm 103, Mabini Wing",
  "alternateRoom": "Rm 102, Rizal Hall",
  "notifyEnrolledStudents": true
}`,
      },
      {
        id: 'INT-HR',
        systemName: 'Workday Campus HR & Faculty Payroll',
        category: 'HR & Payroll',
        vendorOrProtocol: 'REST / Mutual TLS',
        status: 'Connected',
        lastSync: '2026-11-04 07:00',
        recordsSynced: 642,
        endpointUrl: 'GET https://api.binan-its.edu.ph/v2/hr/faculty-teaching-load',
        samplePayload: `{
  "employeeId": "FAC-101",
  "name": "Engr. Arnel Panganiban",
  "maxWeeklyUnits": 24,
  "assignedHours": 18,
  "overloadStatus": "WITHIN_CAP"
}`,
      },
      {
        id: 'INT-LIB',
        systemName: 'Koha Integrated Library & Media Cataloging',
        category: 'Library',
        vendorOrProtocol: 'SIP2 / REST JSON',
        status: 'Connected',
        lastSync: '2026-11-04 08:15',
        recordsSynced: 28914,
        endpointUrl: 'GET https://api.binan-its.edu.ph/v2/library/borrower-clearance/STU-2026-0184',
        samplePayload: `{
  "studentNumber": "STU-2026-0184",
  "libraryOverdueBooks": 0,
  "mediaEquipmentCleared": true
}`,
      },
      {
        id: 'INT-SEC',
        systemName: 'Hikvision CCTV & HID RFID Access Control',
        category: 'Campus Security & CCTV',
        vendorOrProtocol: 'MQTT / ONVIF Telemetry',
        status: 'Connected',
        lastSync: 'Live stream (320ms latency)',
        recordsSynced: 94127,
        endpointUrl: 'WSS wss://iot.binan-its.edu.ph/mqtt/smart-locks',
        samplePayload: `{
  "roomCode": "Rm 101, Rizal Hall",
  "smartLockState": "Unlocked",
  "rfidLastBadge": "RFID-4410-FAC",
  "occupancyHeadcount": 37,
  "hvacPowerKw": 3.4
}`,
      },
      {
        id: 'INT-PAY',
        systemName: 'PayMongo Campus Gateway (GCash / Maya / Card)',
        category: 'Payment Gateway',
        vendorOrProtocol: 'ISO 20022 QR Ph / Webhook',
        status: 'Connected',
        lastSync: '2026-11-04 08:31',
        recordsSynced: 5193,
        endpointUrl: 'POST https://api.binan-its.edu.ph/v2/payments/qrph-webhook',
        samplePayload: `{
  "referenceNo": "GCASH-849201",
  "payerStudentNumber": "STU-2026-0184",
  "amountPhp": 1500,
  "status": "PAID",
  "autoClearance": "CLEARED"
}`,
      },
    ];
  }
}
