import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmsService } from '../services/crms';

@Component({
  selector: 'app-staff-student-events-view',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (crms.activeModule()) {
      @case ('staff') {
        <div class="space-y-5">
          <div class="pb-4 border-b border-[#dcdcd5] dark:border-[#2c322e]">
            <p class="text-xs font-mono text-[#656d68] dark:text-[#88928c]">
              TEACHING UNITS · LAB TECHNICIAN COVERAGE · WORKLOAD CAP GOVERNANCE
            </p>
            <h1 class="text-xl lg:text-2xl font-bold text-[#161917] dark:text-[#eceee9] mt-1">
              Faculty and staff resource allocation
            </h1>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <!-- Left 8 Cols: Personnel Roster & Teaching / Operations Load -->
            <div class="lg:col-span-8 bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
              @for (member of crms.staff(); track member.id) {
                @let loadPct = Math.min(100, Math.round((member.assignedHours / member.maxWeeklyHours) * 100));
                <div class="p-4 space-y-3">
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div class="text-xs font-mono text-[#656d68] dark:text-[#88928c]">
                        {{ member.employeeId }} · {{ member.role }} · {{ member.department }}
                      </div>
                      <h2 class="text-base font-bold text-[#161917] dark:text-[#eceee9] mt-0.5">
                        {{ member.name }}
                      </h2>
                      <p class="text-xs text-[#4a504c] dark:text-[#b5bdb8]">
                        {{ member.specialization }} · <span class="font-mono">{{ member.email }}</span>
                      </p>
                    </div>

                    <div class="text-left sm:text-right font-mono tabular-nums">
                      <span
                        class="text-xs font-semibold inline-flex items-center gap-1"
                        [class.text-[#14532d]]="member.availability === 'Available' && !crms.darkMode()"
                        [class.dark:text-[#4ade80]]="member.availability === 'Available' && crms.darkMode()"
                        [class.text-amber-800]="member.availability !== 'Available' && !crms.darkMode()"
                        [class.dark:text-amber-300]="member.availability !== 'Available' && crms.darkMode()"
                      >
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                          {{ member.availability === 'Available' ? 'check_circle' : 'schedule' }}
                        </mat-icon>
                        <span>{{ member.availability }}</span>
                      </span>
                      <div class="text-sm font-bold text-[#161917] dark:text-[#eceee9] mt-0.5">
                        {{ member.assignedHours }} / {{ member.maxWeeklyHours }} hrs/wk ({{ loadPct }}%)
                      </div>
                    </div>
                  </div>

                  <!-- Linear Workload Meter (6px radius, no rounded-full) -->
                  <div class="w-full h-2 bg-[#efefeb] dark:bg-[#202422] rounded-[4px] overflow-hidden">
                    <div
                      class="h-full transition-all"
                      [class.bg-[#14532d]]="loadPct < 85 && !crms.darkMode()"
                      [class.bg-[#22c55e]]="loadPct < 85 && crms.darkMode()"
                      [class.bg-amber-600]="loadPct >= 85 && loadPct < 100"
                      [class.bg-red-700]="loadPct >= 100"
                      [style.width.%]="loadPct"
                    ></div>
                  </div>

                  <!-- Assigned Classes / Events / Tasks -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                    @for (asn of member.assignments; track asn.id) {
                      <div class="p-2.5 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-xs">
                        <div class="flex items-center justify-between font-mono text-[11px] text-[#656d68] dark:text-[#88928c]">
                          <span>{{ asn.type }}</span>
                          <span>{{ asn.hours }}h/wk · {{ asn.roomCode }}</span>
                        </div>
                        <p class="font-semibold text-[#161917] dark:text-[#eceee9] mt-1">
                          {{ asn.title }}
                        </p>
                        <p class="font-mono text-[11px] text-[#4a504c] dark:text-[#b5bdb8] mt-0.5">
                          {{ asn.schedule }}
                        </p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Right 4 Cols: Assign Personnel Form -->
            <div class="lg:col-span-4 bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] p-4 space-y-4">
              <div class="pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                <h3 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                  Assign personnel to class or task
                </h3>
                <p class="text-xs text-[#656d68] dark:text-[#88928c] mt-0.5">
                  Enforces weekly HR teaching and operations caps before assignment.
                </p>
              </div>

              @if (crms.activeRole() === 'Student') {
                <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-xs text-[#4a504c] dark:text-[#b5bdb8]">
                  Student accounts have read-only access to faculty schedules. Switch to Administrator or Faculty to allocate personnel.
                </div>
              } @else {
                @if (staffError()) {
                  <div role="alert" class="p-3 rounded-[6px] bg-red-50 dark:bg-red-950/50 border border-red-700/40 text-xs text-red-900 dark:text-red-200 flex items-start gap-2">
                    <mat-icon class="!w-4 !h-4 !text-[16px] shrink-0 mt-0.5">error_outline</mat-icon>
                    <span>{{ staffError() }}</span>
                  </div>
                }

                <form [formGroup]="staffForm" (ngSubmit)="submitStaffAssignment()" class="space-y-3 text-xs">
                  <div>
                    <label for="stf-member" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Faculty or staff member <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <select
                      id="stf-member"
                      formControlName="staffId"
                      class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                    >
                      @for (m of crms.staff(); track m.id) {
                        <option [value]="m.id">
                          {{ m.name }} ({{ m.assignedHours }}/{{ m.maxWeeklyHours }}h)
                        </option>
                      }
                    </select>
                  </div>

                  <div>
                    <label for="stf-title" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Assignment title <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="stf-title"
                      type="text"
                      formControlName="title"
                      class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="stf-type" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                        Assignment type <span class="text-red-700 dark:text-red-400">*</span>
                      </label>
                      <select
                        id="stf-type"
                        formControlName="type"
                        class="w-full px-2.5 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                      >
                        <option value="Course Lecture">Course Lecture</option>
                        <option value="Lab Supervision">Lab Supervision</option>
                        <option value="Event Coordination">Event Coordination</option>
                        <option value="Facility Operations">Facility Operations</option>
                      </select>
                    </div>
                    <div>
                      <label for="stf-hours" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                        Weekly hours <span class="text-red-700 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="stf-hours"
                        type="number"
                        formControlName="hours"
                        class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono tabular-nums text-[#161917] dark:text-[#eceee9]"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="stf-sched" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                        Schedule slot <span class="text-red-700 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="stf-sched"
                        type="text"
                        formControlName="schedule"
                        class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-[#161917] dark:text-[#eceee9]"
                      />
                    </div>
                    <div>
                      <label for="stf-room" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                        Assigned room <span class="text-red-700 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="stf-room"
                        type="text"
                        formControlName="roomCode"
                        class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-[#161917] dark:text-[#eceee9]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    class="w-full min-h-[38px] py-2 px-4 text-xs font-semibold bg-[#14532d] hover:bg-[#166534] text-[#fbfbfa] rounded-[6px] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">person_add</mat-icon>
                    <span>Assign personnel</span>
                  </button>
                </form>
              }
            </div>
          </div>
        </div>
      }

      @case ('student-services') {
        <div class="space-y-5">
          <div class="pb-4 border-b border-[#dcdcd5] dark:border-[#2c322e]">
            <p class="text-xs font-mono text-[#656d68] dark:text-[#88928c]">
              RFID / QR / NFC CAMPUS PASS · ELIGIBILITY CLEARANCE · CASHIER SETTLEMENT
            </p>
            <h1 class="text-xl lg:text-2xl font-bold text-[#161917] dark:text-[#eceee9] mt-1">
              Student ID badge, clearance, and cashier gateway
            </h1>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <!-- Left 5 Cols: Digital RFID Badge & Student Directory -->
            <div class="lg:col-span-5 space-y-4">
              @if (selectedStudent(); as stu) {
                <div class="p-4 rounded-[10px] bg-[#161917] text-[#eceee9] border border-[#2c322e] space-y-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-[11px] font-mono text-[#4ade80] tracking-wide">
                        BIÑAN CAMPUS IDENTIFICATION PASS
                      </p>
                      <h2 class="text-lg font-bold mt-1">{{ stu.name }}</h2>
                      <p class="text-xs text-[#b5bdb8]">
                        {{ stu.program }} · {{ stu.yearLevel }}
                      </p>
                    </div>
                    <mat-icon class="!w-5 !h-5 !text-[20px] text-[#4ade80]">contactless</mat-icon>
                  </div>

                  <div class="grid grid-cols-3 gap-3 items-center pt-3 border-t border-[#2c322e]">
                    <div class="col-span-2 space-y-1.5 text-xs font-mono">
                      <div>
                        <span class="text-[#88928c]">Student No: </span>
                        <span class="font-semibold">{{ stu.studentNumber }}</span>
                      </div>
                      <div>
                        <span class="text-[#88928c]">RFID UID: </span>
                        <span class="text-[#4ade80] font-semibold">{{ stu.rfidUid }}</span>
                      </div>
                      <div>
                        <span class="text-[#88928c]">Badge Tier: </span>
                        <span>{{ stu.eligibilityTier }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-[#88928c]">Status: </span>
                        <span
                          class="font-semibold"
                          [class.text-[#4ade80]]="stu.clearanceStatus === 'Cleared'"
                          [class.text-amber-300]="stu.clearanceStatus !== 'Cleared'"
                        >
                          {{ stu.clearanceStatus }}
                        </span>
                      </div>
                    </div>

                    <div class="bg-[#fbfbfa] p-2 rounded-[6px] flex flex-col items-center justify-center text-[#161917]">
                      <mat-icon class="!w-12 !h-12 !text-[48px]">qr_code_2</mat-icon>
                      <span class="text-[9px] font-mono font-semibold mt-0.5">QR VERIFIED</span>
                    </div>
                  </div>
                </div>
              }

              <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] p-4 space-y-2.5">
                <h3 class="text-xs font-bold text-[#161917] dark:text-[#eceee9]">
                  Select student record to inspect or clear balance
                </h3>
                <div class="space-y-2">
                  @for (stu of crms.students(); track stu.id) {
                    <button
                      type="button"
                      (click)="selectStudent(stu.id)"
                      class="w-full text-left p-3 rounded-[6px] border transition-colors text-xs flex items-center justify-between"
                      [class]="
                        selectedStudentId() === stu.id
                          ? 'border-[#14532d] bg-[#e7f3ec]/60 dark:border-[#4ade80] dark:bg-[#132a1c]/60'
                          : 'border-[#dcdcd5] dark:border-[#2c322e] hover:bg-[#efefeb]/60'
                      "
                    >
                      <div>
                        <div class="font-semibold text-[#161917] dark:text-[#eceee9]">
                          {{ stu.name }} ({{ stu.studentNumber }})
                        </div>
                        <div class="text-[#656d68] dark:text-[#88928c] font-mono mt-0.5">
                          {{ stu.rfidUid }} · {{ stu.eligibilityTier }}
                        </div>
                      </div>
                      <div class="text-right font-mono tabular-nums">
                        <div
                          class="font-semibold flex items-center justify-end gap-1"
                          [class.text-[#14532d]]="stu.clearanceStatus === 'Cleared' && !crms.darkMode()"
                          [class.dark:text-[#4ade80]]="stu.clearanceStatus === 'Cleared' && crms.darkMode()"
                          [class.text-red-700]="stu.clearanceStatus !== 'Cleared'"
                        >
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                            {{ stu.clearanceStatus === 'Cleared' ? 'check_circle' : 'error_outline' }}
                          </mat-icon>
                          <span>{{ stu.clearanceStatus }}</span>
                        </div>
                        <div class="text-[#656d68] dark:text-[#88928c]">
                          Balance: ₱{{ stu.outstandingBalancePhp }}
                        </div>
                      </div>
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Right 7 Cols: Cashier Payment Settlement & Service Requests -->
            <div class="lg:col-span-7 space-y-5">
              <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] p-4 space-y-4">
                <div class="pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                  <h3 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                    Cashier payment gateway (GCash, Maya, Campus Card)
                  </h3>
                  <p class="text-xs text-[#656d68] dark:text-[#88928c] mt-0.5">
                    Settling an overdue fine clears the student hold immediately and restores equipment borrowing privileges.
                  </p>
                </div>

                <form [formGroup]="paymentForm" (ngSubmit)="submitPayment()" class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label for="pay-stu" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Student account <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <select
                      id="pay-stu"
                      formControlName="studentId"
                      class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                    >
                      @for (s of crms.students(); track s.id) {
                        <option [value]="s.id">
                          {{ s.name }} (Due: ₱{{ s.outstandingBalancePhp }})
                        </option>
                      }
                    </select>
                  </div>

                  <div>
                    <label for="pay-method" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Payment channel <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <select
                      id="pay-method"
                      formControlName="method"
                      class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                    >
                      <option value="GCash">GCash QR Ph</option>
                      <option value="Maya">Maya Business</option>
                      <option value="Campus Card">Biñan RFID Wallet</option>
                      <option value="Cashier">University Cashier Window</option>
                    </select>
                  </div>

                  <div>
                    <label for="pay-cat" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Fee category <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <select
                      id="pay-cat"
                      formControlName="category"
                      class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                    >
                      <option value="Overdue Fine">Overdue Fine Settlement</option>
                      <option value="Equipment Deposit">Equipment Security Deposit</option>
                      <option value="Facility Rental">Student Org Facility Rental</option>
                      <option value="ID Replacement Fee">RFID ID Badge Replacement</option>
                    </select>
                  </div>

                  <div>
                    <label for="pay-amt" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Amount (PHP ₱) <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="pay-amt"
                      type="number"
                      formControlName="amountPhp"
                      class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono tabular-nums text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>

                  <div class="sm:col-span-2">
                    <label for="pay-desc" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Particulars <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="pay-desc"
                      type="text"
                      formControlName="description"
                      class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>

                  <div class="sm:col-span-2">
                    <button
                      type="submit"
                      class="w-full min-h-[38px] py-2 px-4 text-xs font-semibold bg-[#14532d] hover:bg-[#166534] text-[#fbfbfa] rounded-[6px] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <mat-icon class="!w-4 !h-4 !text-[16px]">payments</mat-icon>
                      <span>Record payment and clear hold</span>
                    </button>
                  </div>
                </form>

                <!-- Payment Ledger -->
                <div class="pt-3 border-t border-[#dcdcd5] dark:border-[#2c322e] space-y-2">
                  <h4 class="text-xs font-bold text-[#161917] dark:text-[#eceee9]">
                    Recent cashier receipts
                  </h4>
                  <div class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
                    @for (tx of crms.payments().slice(0, 4); track tx.id) {
                      <div class="flex items-center justify-between text-xs py-2">
                        <div>
                          <span class="font-mono font-semibold text-[#161917] dark:text-[#eceee9]">{{ tx.referenceNo }}</span>
                          <span class="text-[#656d68] dark:text-[#88928c]"> · {{ tx.payerName }} · {{ tx.description }}</span>
                        </div>
                        <span class="font-mono font-bold text-[#14532d] dark:text-[#4ade80] tabular-nums shrink-0">
                          ₱{{ tx.amountPhp | number }} ({{ tx.method }})
                        </span>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Student Service Requests -->
              <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] p-4 space-y-3">
                <div>
                  <h3 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                    Student access and service requests
                  </h3>
                  <p class="text-xs text-[#656d68] dark:text-[#88928c]">
                    Approving a lab access request upgrades the student's RFID badge to Lab Certified.
                  </p>
                </div>

                <div class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413]">
                  @for (req of crms.serviceRequests(); track req.id) {
                    <div class="p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div class="font-semibold text-[#161917] dark:text-[#eceee9]">
                          {{ req.requestType }} · {{ req.studentName }} ({{ req.studentId }})
                        </div>
                        <p class="text-[#4a504c] dark:text-[#b5bdb8] mt-0.5">
                          {{ req.details }}
                        </p>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span
                          class="font-mono font-semibold flex items-center gap-1"
                          [class.text-[#14532d]]="req.status === 'Approved' && !crms.darkMode()"
                          [class.dark:text-[#4ade80]]="req.status === 'Approved' && crms.darkMode()"
                          [class.text-amber-800]="req.status === 'Pending'"
                        >
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                            {{ req.status === 'Approved' ? 'check_circle' : 'schedule' }}
                          </mat-icon>
                          <span>{{ req.status }}</span>
                        </span>
                        @if (req.status === 'Pending' && crms.activeRole() !== 'Student') {
                          <button
                            type="button"
                            (click)="crms.approveServiceRequest(req.id)"
                            class="min-h-[32px] px-2.5 py-1 text-xs font-semibold bg-[#14532d] text-[#fbfbfa] rounded-[6px] hover:bg-[#166534] flex items-center gap-1"
                          >
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">check</mat-icon>
                            <span>Approve request</span>
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      }

      @case ('events') {
        <div class="space-y-5">
          <div class="pb-4 border-b border-[#dcdcd5] dark:border-[#2c322e]">
            <p class="text-xs font-mono text-[#656d68] dark:text-[#88928c]">
              AUDITORIUMS · SPORTS ARENAS · COLLOQUIUMS &amp; STUDENT ACTIVITIES
            </p>
            <h1 class="text-xl lg:text-2xl font-bold text-[#161917] dark:text-[#eceee9] mt-1">
              Campus event and venue reservations
            </h1>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div class="lg:col-span-8 bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
              @for (ev of eventBookings(); track ev.id) {
                <div class="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div class="space-y-1 text-xs">
                    <div class="font-mono text-[#656d68] dark:text-[#88928c]">
                      {{ ev.date }} · {{ ev.startTime }}-{{ ev.endTime }} · {{ ev.category }} · {{ ev.targetName }}
                    </div>
                    <h3 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                      {{ ev.title }}
                    </h3>
                    <p class="text-[#4a504c] dark:text-[#b5bdb8]">
                      Organizer: {{ ev.requesterName }} ({{ ev.department }}) · <span class="font-mono tabular-nums">{{ ev.attendees }}</span> attendees · Fee: <span class="font-mono tabular-nums">₱{{ ev.costPhp | number }}</span>
                    </p>
                  </div>

                  <div class="flex items-center gap-2 shrink-0 text-xs">
                    <span
                      class="font-mono font-semibold flex items-center gap-1"
                      [class.text-[#14532d]]="ev.status === 'Approved' && !crms.darkMode()"
                      [class.dark:text-[#4ade80]]="ev.status === 'Approved' && crms.darkMode()"
                      [class.text-amber-800]="ev.status === 'Pending Approval'"
                      [class.text-red-700]="ev.status === 'Rejected'"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                        {{ ev.status === 'Approved' ? 'check_circle' : ev.status === 'Rejected' ? 'cancel' : 'schedule' }}
                      </mat-icon>
                      <span>{{ ev.status }}</span>
                    </span>
                    @if (ev.status === 'Pending Approval' && (crms.activeRole() === 'Admin' || crms.activeRole() === 'Staff')) {
                      <button
                        type="button"
                        (click)="crms.updateBookingStatus(ev.id, 'Approved')"
                        class="min-h-[32px] px-3 py-1 text-xs font-semibold bg-[#14532d] text-[#fbfbfa] rounded-[6px] hover:bg-[#166534] flex items-center gap-1"
                      >
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">check</mat-icon>
                        <span>Approve event</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Schedule New Campus Event Form with Pre-Submit Conflict Detection -->
            <div class="lg:col-span-4 bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] p-4 space-y-4">
              <div class="pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                <h3 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                  Reserve venue for campus event
                </h3>
                <p class="text-xs text-[#656d68] dark:text-[#88928c] mt-0.5">
                  Checks venue availability against term courses and existing reservations before submission.
                </p>
              </div>

              @if (liveEventConflict(); as conflictMsg) {
                <div role="status" class="p-3 rounded-[6px] bg-amber-50 dark:bg-amber-950/50 border border-amber-700/40 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2">
                  <mat-icon class="!w-4 !h-4 !text-[16px] shrink-0 mt-0.5">warning_amber</mat-icon>
                  <span>{{ conflictMsg }}</span>
                </div>
              }

              <form [formGroup]="eventForm" (ngSubmit)="submitEvent()" class="space-y-3 text-xs">
                <div>
                  <label for="ev-title" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                    Event title <span class="text-red-700 dark:text-red-400">*</span>
                  </label>
                  <input
                    id="ev-title"
                    type="text"
                    formControlName="title"
                    class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                  />
                </div>

                <div>
                  <label for="ev-target" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                    Target venue <span class="text-red-700 dark:text-red-400">*</span>
                  </label>
                  <select
                    id="ev-target"
                    formControlName="targetId"
                    class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-[#161917] dark:text-[#eceee9]"
                  >
                    @for (rm of crms.rooms(); track rm.id) {
                      <option [value]="rm.id">{{ rm.code }} · {{ rm.name }} ({{ rm.capacity }} cap)</option>
                    }
                  </select>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="ev-cat" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Category <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <select
                      id="ev-cat"
                      formControlName="category"
                      class="w-full px-2.5 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                    >
                      <option value="Seminar & Symposium">Seminar &amp; Symposium</option>
                      <option value="Club Activity">Club Activity</option>
                      <option value="Sports Tournament">Sports Tournament</option>
                    </select>
                  </div>
                  <div>
                    <label for="ev-att" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Attendees <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="ev-att"
                      type="number"
                      formControlName="attendees"
                      class="w-full px-3 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono tabular-nums text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label for="ev-date" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Date <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="ev-date"
                      type="date"
                      formControlName="date"
                      class="w-full px-2 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>
                  <div>
                    <label for="ev-start" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Start <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="ev-start"
                      type="time"
                      formControlName="startTime"
                      class="w-full px-2 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>
                  <div>
                    <label for="ev-end" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      End <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="ev-end"
                      type="time"
                      formControlName="endTime"
                      class="w-full px-2 py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  [disabled]="!!liveEventConflict()"
                  class="w-full min-h-[38px] py-2 px-4 text-xs font-semibold bg-[#14532d] hover:bg-[#166534] disabled:opacity-40 text-[#fbfbfa] rounded-[6px] transition-colors flex items-center justify-center gap-1.5"
                >
                  <mat-icon class="!w-4 !h-4 !text-[16px]">event_available</mat-icon>
                  <span>Reserve event venue</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class StaffStudentEventsView {
  readonly crms = inject(CrmsService);
  private readonly fb = inject(FormBuilder);
  readonly Math = Math;

  readonly staffError = signal<string>('');
  readonly selectedStudentId = signal<string>('STU-2');

  readonly eventDraft = signal({
    targetId: 'RM-104',
    date: '2026-11-09',
    startTime: '13:00',
    endTime: '17:00',
  });

  readonly selectedStudent = computed(() =>
    this.crms.students().find((s) => s.id === this.selectedStudentId()) || this.crms.students()[0]
  );

  readonly eventBookings = computed(() => this.crms.bookings());

  readonly staffForm = this.fb.nonNullable.group({
    staffId: ['STF-101', Validators.required],
    title: ['Undergraduate Thesis Defense Panelist', Validators.required],
    type: ['Event Coordination' as const, Validators.required],
    hours: [3, [Validators.required, Validators.min(1)]],
    schedule: ['Fri 14:00-17:00', Validators.required],
    roomCode: ['Rm 201, Student Union', Validators.required],
  });

  readonly paymentForm = this.fb.nonNullable.group({
    studentId: ['STU-2', Validators.required],
    method: ['GCash' as const, Validators.required],
    category: ['Overdue Fine' as const, Validators.required],
    amountPhp: [475, [Validators.required, Validators.min(50)]],
    description: ['Settlement of overdue lab equipment return fine (STU-2026-0412)', Validators.required],
  });

  readonly eventForm = this.fb.nonNullable.group({
    title: ['Biñan Engineering Capstone Colloquium', Validators.required],
    targetId: ['RM-104', Validators.required],
    category: ['Seminar & Symposium' as const, Validators.required],
    attendees: [180, [Validators.required, Validators.min(5)]],
    date: ['2026-11-09', Validators.required],
    startTime: ['13:00', Validators.required],
    endTime: ['17:00', Validators.required],
  });

  constructor() {
    this.eventForm.valueChanges.subscribe((val) => {
      this.eventDraft.set({
        targetId: val.targetId || 'RM-104',
        date: val.date || '2026-11-09',
        startTime: val.startTime || '13:00',
        endTime: val.endTime || '17:00',
      });
    });
  }

  readonly liveEventConflict = computed(() => {
    const d = this.eventDraft();
    const check = this.crms.checkRoomConflict(d.targetId, d.date, d.startTime, d.endTime);
    return check.hasConflict ? check.details || 'Selected venue has a scheduling conflict.' : null;
  });

  selectStudent(id: string): void {
    this.selectedStudentId.set(id);
    const stu = this.crms.students().find((s) => s.id === id);
    if (stu) {
      this.paymentForm.patchValue({
        studentId: stu.id,
        amountPhp: stu.outstandingBalancePhp > 0 ? stu.outstandingBalancePhp : 500,
        description:
          stu.outstandingBalancePhp > 0
            ? `Settlement of outstanding balance (${stu.studentNumber})`
            : `Refundable Equipment Security Deposit (${stu.studentNumber})`,
      });
    }
  }

  submitStaffAssignment(): void {
    this.staffError.set('');
    const raw = this.staffForm.getRawValue();
    const res = this.crms.assignTaskToStaff(raw.staffId, {
      title: raw.title,
      type: raw.type,
      hours: Number(raw.hours),
      schedule: raw.schedule,
      roomCode: raw.roomCode,
    });
    if (!res.ok) {
      this.staffError.set(res.message);
      this.crms.pushToast('Workload cap reached', res.message, 'error');
    }
  }

  submitPayment(): void {
    const raw = this.paymentForm.getRawValue();
    this.crms.processPayment({
      studentId: raw.studentId,
      method: raw.method,
      category: raw.category,
      amountPhp: Number(raw.amountPhp),
      description: raw.description,
    });
  }

  submitEvent(): void {
    const raw = this.eventForm.getRawValue();
    const res = this.crms.createBooking({
      resourceType: 'Room',
      bookingSubtype: 'Campus Event',
      targetId: raw.targetId,
      title: raw.title,
      category: raw.category,
      department: this.crms.activePersona().department,
      date: raw.date,
      startTime: raw.startTime,
      endTime: raw.endTime,
      attendees: Number(raw.attendees),
      requiredEquipment: ['4K Laser Projector', 'PA Sound System'],
      autoAssigned: false,
    });
    if (!res.ok) {
      this.crms.pushToast('Venue conflict', res.message, 'error');
    }
  }
}
