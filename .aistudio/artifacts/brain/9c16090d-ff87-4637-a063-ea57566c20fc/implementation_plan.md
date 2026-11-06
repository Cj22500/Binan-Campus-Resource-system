# Biñan Campus Resource Management System (CRMS)

An enterprise-grade, bilingual (English and Filipino) Campus Resource Management System designed for students, faculty, staff, and administrators at the Biñan Campus. It unifies term-long course room assignments, ad-hoc room and facility reservations, smart scheduling with automatic fallback relocation, inventory lifecycle tracking, interactive 2D SVG digital twin floorplans with IoT telemetry, workflow approvals, RA 10173 Data Privacy compliance, and emergency response operations in a cohesive SaaS workspace.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and product choices have been locked in based on your feedback:
> - **Confirmed Decision 1 — Self-Contained Demo with Instant Role Switcher**: The system operates with a rich, pre-loaded Biñan Campus dataset persisted in browser storage (`localStorage` backed by reactive Angular Signals) and features an instant Role Switcher (`Student`, `Faculty`, `Staff`, `Admin`) so you can test role-based permissions, self-service requests, and administrative approvals immediately without external login barriers.
> - **Confirmed Decision 2 — Interactive 2D SVG Floorplan & Campus Digital Twin**: Facility visualization and IoT telemetry are powered by an interactive 2D SVG architectural map of the Biñan Campus buildings (Academic Hall, Science & Innovation Wing, Sports Complex, Student Center) with clickable room nodes, smart lock toggles, live occupancy sensors, energy usage readouts, and emergency safe-zone overlays.
> - **Confirmed Decision 3 — Modern Neutral SaaS Theme with Custom Institution Branding**: Styled as a high-craft neutral SaaS platform (`#F8FAFC` / `#FFFFFF` surfaces, slate hairlines, `#2563EB` cobalt primary accent, and semantic status colors) tailored for **Biñan Institute of Technology & Sciences (BITS)**.
> - **Confirmed Decision 4 — Term-Based Standard Course Rooms & Faculty Relocation Override**: Administrators can configure standing room assignments for courses/subjects across an entire academic term (e.g., `1st Semester AY 2026–2027`). If a course's standard room is marked unavailable (due to maintenance work orders, special campus-wide events, or facility issues), the system alerts the assigned instructor and unlocks a streamlined **Reserve Alternate Room** workflow (with 1-click Smart Scheduler recommendations) for the affected session(s).

---

## 1. Overview & Core Concept

- **What It Does**: Centralizes every physical, human, and financial campus resource into a single operational command center and self-service portal. Administrators lock in term-long standard rooms for academic courses, while faculty and students can book conflict-free classrooms, trigger alternate room reservations when a standard course room is down for maintenance, check out lab laptops or sports equipment, submit maintenance work orders, monitor building IoT sensors on a 2D floorplan, manage faculty workloads, pay rental deposits or library fines, and broadcast campus emergency alerts.
- **Target Audience / Persona**:
  - **Students**: View their course schedule (including any temporary room relocations), reserve study pods, borrow lab/sports gear, check digital RFID/QR ID eligibility, and pay equipment deposits/fines.
  - **Faculty**: View their assigned term courses and constant classrooms, seamlessly reserve an alternate room when their regular room is unavailable, schedule make-up lectures or labs using Smart Scheduling, request classroom AV support, and track teaching load.
  - **Operations Staff**: Process equipment check-in/check-out via QR/RFID badge scan simulation, manage maintenance work orders (which automatically flag impacted term courses), monitor IoT smart locks and HVAC energy draw, and track asset depreciation.
  - **Campus Administrators**: Set and manage Master Term Room Assignments for courses/subjects, approve multi-stage reservation and budget workflows, audit access logs, enforce Philippines Data Privacy Act (RA 10173) controls, manage SIS/LMS/HR ecosystem syncs, and trigger campus-wide Emergency Response protocols.
- **Key Value**: Eliminates double-booked classrooms, guarantees predictable term-long room assignments with frictionless fallback booking when disruptions occur, prevents unreturned equipment loss, and gives campus leadership predictive visibility into peak resource demand, departmental budgets, and crisis readiness.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Role-Adaptive Workspace & Bilingual Switch**: From the workspace toolbar, users can switch roles (`Student`, `Faculty`, `Staff`, `Admin`), toggle language between **English** and **Filipino (Tagalog)**, or activate **Accessibility Mode** (high contrast, enlarged touch targets, reduced motion). The navigation and available actions adapt immediately to the active role's RBAC permissions.
2. **Term Course Room Assignment & Faculty Alternate Room Override**:
   - **Admin Master Term Setup**: Administrators assign a constant home room, recurring schedule pattern (`MWF`, `TTh`, `Sat`), and time slot to each course/subject (e.g., `CS-301 Data Structures · Prof. Reyes · B1-R204 · MWF 09:00–10:30`) for the active term. These standing assignments automatically block out baseline room availability to prevent ad-hoc booking conflicts.
   - **Unavailability Detection & Teacher Relocation Flow**: If a constant room becomes unavailable on a specific date or period (e.g., `B1-R204` is placed under a Maintenance Work Order for HVAC repair, locked down, or preempted by an institutional event), the course card displays an `Action Required: Assigned Room Unavailable` alert for the instructor. The teacher clicks **"Reserve Alternate Room"**, which pre-fills the course's enrollment size, schedule slot, and required equipment into the Smart Scheduler so the teacher can select or auto-assign a replacement room in seconds.
3. **Smart Scheduling & Conflict-Free Room Booking**: For both ad-hoc bookings and temporary course relocations, users select a date, time slot, expected headcount, and required equipment (e.g., 40 seats, Interactive Smartboard, Chemistry Fume Hood). The **Smart Scheduler** evaluates all campus rooms against both ad-hoc bookings and standing term schedules, flags time conflicts in real time, and auto-recommends or assigns the optimal room with a single click.
4. **Interactive 2D SVG Digital Twin & IoT Control**: Users select a Biñan Campus building and floor to inspect an interactive 2D vector floorplan. Clicking any room reveals its standing term courses, live ad-hoc schedule, occupancy sensor count, HVAC power draw (kW), smart lock state (Authorized Staff/Admins can lock/unlock remotely), and active maintenance work orders. During an emergency drill or crisis, the floorplan switches to **Emergency Response Mode**, highlighting evacuation routes, safe muster zones, and trauma kit locations.
5. **Equipment Check-In/Out & Asset Lifecycle**: Users browse laptops, oscilloscopes, DSLR kits, and sports gear, verify their Student/Faculty eligibility rules, and request a loan. Staff scan or enter an RFID/QR badge ID to complete check-out/check-in, while administrators track straight-line depreciation, warranty expiration dates, and replacement schedules.
6. **Workflow Automation, Budget & Ecosystem Hub**: Pending room bookings, equipment loans, and maintenance requests flow into an automated approval pipeline where approvers can approve, reject, or request changes with automatic audit trail logging and department budget deduction (in PHP `₱`).

### Visual Identity & Theme
- **Aesthetic Direction**: High-craft Modern Neutral SaaS Dashboard with crisp architectural precision, single-elevation flat surfaces (`1px solid` slate borders), and zero visual clutter.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - **60% Dominant Neutral Canvas**: Cool Alabaster (`#F8FAFC`) workspace background with Pure White (`#FFFFFF`) primary data surfaces (and full Dark Mode support using `#0F172A` canvas and `#1E293B` structural surfaces).
  - **30% Structural Surfaces & Typography**: Deep Slate (`#0F172A`) primary prose, Muted Slate (`#475569`) secondary labels, and subtle hairline dividers (`#E2E8F0`).
  - **10% Accent & Semantic Budget**: Institutional Cobalt (`#2563EB`) for primary actions and active states; Emerald (`#16A34A`) for Available / Approved / Nominal IoT; Amber (`#D97706`) for Pending Approval / Room Relocated / Warranty Expiring; Crimson (`#DC2626`) for Assigned Room Unavailable / Conflict Detected / Emergency Lockdown.
- **Typography & Hierarchy (2+1 Font Rule)**:
  - **Display & Navigation**: `Plus Jakarta Sans` (600/700 weights, `text-wrap: balance`) for crisp institutional headers and section titles.
  - **Body & Dense Controls**: `Public Sans` (400/500 weights) for effortless scannability across forms, workflow queues, and bilingual labels.
  - **Tabular Data & Telemetry**: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for room capacities, course codes, RFID badge codes, PHP (`₱`) budget ledgers, IoT sensor readings, and timestamps.
- **Component Styling & Layout**:
  - **Workspace Layout**: Left collapsible navigation sidebar (`260px` wide) paired with a clean 3-zone top bar (Breadcrumb trail on the left, quick module jump links in the center, and primary "+ New Reservation" CTA on the right) above a full-width `1440px` desktop workspace canvas.
  - **Zero-Pill Metadata Discipline**: Static metadata (room capacities, course codes, building codes, timestamps, depreciation rates) renders as clean, unboxed inline text separated by middots (`·`), reserving interactive button styling strictly for clickable filter tabs and action controls.
- **Interactive Feedback & Motion**: Fast `150ms` compositor transitions (`transform`, `opacity`), immediate inline conflict validation, live toast notifications for course room relocations, approvals, and IoT state changes, and instant skeleton/empty states with clear call-to-action recovery buttons.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Two-Tier Scheduling Model (Standing Term Course Assignments + Exception & Ad-Hoc Bookings)**
  - *Chosen Approach*: Separate baseline academic term assignments (`TermCourseAssignment`) from date-specific reservations and overrides (`BookingRecord`). Standing term assignments establish the constant default room for each subject, while date-specific unavailability flags (triggered by maintenance work orders or admin blocks) automatically unlock faculty relocation overrides without erasing the underlying term assignment.
  - *Why*: Mirrors real university registrar and facilities operations—courses keep their permanent home room for the semester while handling single-day or week-long room outages gracefully.
  - *Alternatives Considered*: Expanding every term course into dozens of unlinked daily calendar rows makes bulk semester room changes and temporary fallback tracking brittle and cluttered.
- **Decision 2: Reactive Signal Store with LocalStorage Persistence & Seed Reset**
  - *Chosen Approach*: Centralize all campus entities (rooms, term course schedules, bookings, equipment, staff workloads, work orders, budgets, audit logs, IoT states) in a reactive Angular Signal service backed by `localStorage`, complete with a "Reset Demo Data" control.
  - *Why*: Guarantees instantaneous responsiveness, cross-tab state persistence when testing multi-step workflows (e.g., Admin marks a room down for maintenance -> Faculty logs in and reserves an alternate room), and zero setup friction.
- **Decision 3: Deterministic Constraint Engine for Smart & Predictive Scheduling**
  - *Chosen Approach*: Implement a transparent, rule-based optimization and forecasting engine that scores candidate rooms by capacity fit, required equipment match, building proximity, energy efficiency, and both standing term and ad-hoc availability.
  - *Why*: Delivers instant, explainable room auto-assignments and alternate-room fallback suggestions when a teacher's constant room is unavailable.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         BIÑAN CRMS WORKSPACE SHELL (App)                          │
│  ┌─────────────────────┐  ┌────────────────────────────────────────────────────┐  │
│  │  Sidebar Navigation │  │  Top Bar (Breadcrumbs · Module Links · Quick Book) │  │
│  │  + Role/Lang/A11y   │  └────────────────────────────────────────────────────┘  │
│  │    Toolbar          │  ┌────────────────────────────────────────────────────┐  │
│  │                     │  │             ACTIVE MODULE VIEWPORT                 │  │
│  │  • Command Overview │  │  ┌──────────────────────┐ ┌─────────────────────┐  │  │
│  │  • Digital Twin IoT │  │  │ 2D SVG Digital Twin  │ │ Rooms, Term Courses │  │  │
│  │  • Rooms, Term      │  │  │ & IoT Sensor Control │ │ & Smart Relocation  │  │  │
│  │    Courses & Smart  │  │  └──────────────────────┘ └─────────────────────┘  │  │
│  │    Scheduling       │  │  ┌──────────────────────┐ ┌─────────────────────┐  │  │
│  │  • Equipment &      │  │  │ Equipment Inventory  │ │ Staff & Faculty     │  │  │
│  │    Asset Lifecycle  │  │  │ & Lifecycle Tracker  │ │ Workload Allocator  │  │  │
│  │  • Staff & Faculty  │  │  └──────────────────────┘ └─────────────────────┘  │  │
│  │    Allocation       │  │  ┌──────────────────────┐ ┌─────────────────────┐  │  │
│  │  • Student Services │  │  │ Workflow Approvals,  │ │ Student ID, RFID/QR │  │  │
│  │    & ID / Payments  │  │  │ Maintenance & Budget │ │ & Payment Gateway   │  │  │
│  │  • Events &         │  │  └──────────────────────┘ └─────────────────────┘  │  │
│  │    Activities       │  │  ┌──────────────────────┐ ┌─────────────────────┐  │  │
│  │  • Operations,      │  │  │ Predictive Analytics │ │ RBAC, Audit Logs,   │  │  │
│  │    Workfl. & Budget │  │  │ & Custom CSV Reports │ │ RA 10173 & API Hub  │  │  │
│  │  • Analytics &      │  │  └──────────────────────┘ └─────────────────────┘  │  │
│  │    Predictive       │  │  ┌──────────────────────────────────────────────┐  │  │
│  │  • Security, Privacy│  │  │ Emergency Response Broadcast & Safe Zone Map │  │  │
│  │    & Ecosystem APIs │  │  └──────────────────────────────────────────────┘  │  │
│  └─────────────────────┘  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ Reactive Signals & Computed Selectors
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                    CAMPUS RESOURCE STATE & AUTOMATION SERVICE                     │
│  • Master Term Course Room Manager & Unavailability / Fallback Relocation Engine  │
│  • Conflict Detection & Smart Room Auto-Assigner (Capacity + Equipment + Time)    │
│  • Asset Depreciation Calculator & Warranty Alert Engine                          │
│  • RBAC Permission Guard, Immutable Audit Logger & RA 10173 Privacy Controller    │
│  • Bilingual I18n Store (EN / FIL) + LocalStorage Sync + REST API Simulator       │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **Term Course Room Assignments (`TermCourseAssignment`)**: ID, academic term (e.g., `1st Sem AY 2026–2027`), course code (e.g., `CS-301`), course title, department, instructor ID & name, enrolled students count, required equipment list, recurring days (`MWF`, `TTh`, `Sat`), start/end time, assigned standard room ID (`constantRoomId`), standard room status (`Active`, `Room Unavailable - Needs Relocation`, `Relocated for Session`), and active alternate booking ID (`alternateBookingId`, if relocated).
- **Rooms & Facilities (`FacilityRoom`)**: ID, code (e.g., `B1-R204`), name, building, floor, SVG coordinates (`x, y, width, height`), capacity, type (`Classroom`, `Laboratory`, `Auditorium`, `Study Pod`, `Sports Court`), availability state (`Operational`, `Under Maintenance`, `Closed`), unavailability reason, installed equipment list, hourly cost (`₱`), smart lock status (`Locked`, `Unlocked`, `Emergency Open`), live occupancy count, energy draw (`kW`), and HVAC temperature (`°C`).
- **Reservations, Overrides & Events (`BookingRecord`)**: ID, resource type (`Room` | `Equipment` | `Event`), booking subtype (`Ad-Hoc Reservation` | `Course Room Relocation` | `Campus Event`), linked course ID (optional), target room/asset ID, original unavailable room ID (if relocation), title, category, requester name/role/ID, date, start/end time, attendee count, status (`Approved`, `Pending Approval`, `Rejected`, `Checked Out`, `Completed`), auto-assigned flag, and approval notes.
- **Equipment & Asset Lifecycle (`EquipmentAsset`)**: ID, asset tag, serial number, name, category (`Laptops`, `Lab Tools`, `Sports Gear`, `Consumables`, `AV Gear`), total/available quantity, condition (`Optimal`, `Needs Maintenance`, `Decommissioned`), purchase date, purchase cost (`₱`), useful life years, current book value (straight-line depreciation), warranty expiry date, replacement schedule date, and current holder RFID/QR badge.
- **Staff & Faculty Allocation (`StaffMember`)**: ID, employee ID, name, department, role (`Faculty`, `Lab Technician`, `Facilities Staff`, `Security`), max weekly workload hours, assigned hours, assigned term courses/events/tasks, and current availability status.
- **Student Services & Payments (`StudentProfile`, `PaymentTransaction`)**: Student ID, RFID/NFC UID, QR code token, clearance status, eligibility tier, active loans, service requests, and fee/fine/deposit transactions (`GCash`, `Maya`, `Campus Card`, `Cashier`) with receipt generation.
- **Operations (`WorkOrder`, `DepartmentBudget`)**: Maintenance tickets (facility/asset target, blocks room availability flag, priority, type `Repair` | `Cleaning` | `Inspection`, assigned technician, SLA deadline, cost) and departmental budgets (allocated `₱`, spent `₱`, encumbered `₱`, usage charges).
- **Security, Compliance & Ecosystem (`AuditLogEntry`, `EcosystemIntegration`, `EmergencyAlert`)**: Timestamped actor/action/resource logs, RA 10173 consent & data retention settings, connected campus systems (`SIS`, `LMS`, `HR & Payroll`, `Library`, `CCTV & Access Control`, `Payment Gateway`) with sync health and interactive API payload preview, and active campus crisis broadcasts with safe zone capacities.

### Interactive Component & State Mapping
- **Master Term Course Room Manager (Admin) & Teacher Relocation Flow (Faculty)**:
  - **Admin Action**: Admins can assign or change the constant room for any course/subject for the term, or create a new term course assignment with automatic conflict checking against existing term schedules.
  - **Simulating & Handling Room Unavailability**: When a constant room is marked `Under Maintenance` (via a Work Order or Admin toggle) or has a conflicting high-priority campus event, all courses assigned to that room immediately surface an `Assigned Room Unavailable` alert banner.
  - **Teacher Override Action**: Clicking **"Reserve Alternate Room"** on an affected course launches the relocation drawer pre-populated with the course's headcount, time slot, and equipment needs. The teacher can pick any open room or click **"Auto-Assign Best Alternate Room"**, which immediately reserves the replacement room, marks the course session as `Relocated to [New Room]`, logs the audit event, and broadcasts a room-change notification to students and faculty.
- **Smart Scheduling Modal & Conflict Detector**: Evaluates both standing term course schedules and single-date bookings in real time so ad-hoc reservations can never double-book a room occupied by a term course (unless that course has been relocated for the day).
- **Interactive 2D SVG Digital Twin Map**: Clicking a room polygon opens the live side inspector showing its **Standing Term Courses**, current availability, IoT Smart Lock toggle, HVAC setpoints, and a toggle to mark the room under maintenance (allowing instant testing of the teacher alternate-room relocation workflow right from the map).
- **Equipment Check-In/Out & RFID/QR Scanner Simulator**: Validates **Resource Eligibility Rules**, updates inventory counts, and recalculates asset utilization and depreciation metrics.
- **Workflow Automation Queue**: Admins and Staff can filter pending room reservations, course relocations, equipment loans, and maintenance requests, and trigger one-click *Approve*, *Reject*, or *Batch Auto-Approve Eligible Requests*.
- **Emergency Response Command Bar & Safe Zone Mode**: Toggling an emergency drill or crisis alert displays a high-priority banner across the app, switches the 2D SVG map to display **Safe Zones & Muster Points**, unlocks emergency exits via IoT smart locks, and lists emergency equipment availability.
- **Analytics, Predictive Scheduling & Custom Report Exporter**: Interactive SVG charts display hourly utilization heatmaps (combining standing term courses and ad-hoc bookings), 7-day predictive shortage alerts, and one-click CSV/JSON report downloads.
