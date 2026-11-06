import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmsService } from '../services/crms';
import { BookingRecord, EcosystemIntegration } from '../models/crms.models';

@Component({
  selector: 'app-operations-analytics-security-view',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (crms.activeModule()) {
      <!-- ============================================== -->
      <!-- 1. BOOKINGS (Operations & Approvals)           -->
      <!-- ============================================== -->
      @case ('operations') {
        <div class="space-y-5">
          <!-- Page Header -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#dcdcd5] dark:border-[#2c322e]">
            <div>
              <h1 class="text-xl lg:text-2xl font-bold text-[#161917] dark:text-[#eceee9]">
                Bookings &amp; approvals
              </h1>
              <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-1">
                Review room reservations, manage facility work orders, and track department usage costs.
              </p>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                (click)="filtersOpen.set(!filtersOpen())"
                class="px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] dark:hover:bg-[#222624] inline-flex items-center gap-1.5 transition-colors"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">filter_list</mat-icon>
                <span>Filters</span>
                @if (statusFilter() !== 'ALL') {
                  <span class="w-2 h-2 rounded-full bg-amber-600"></span>
                }
              </button>

              @if (crms.activeRole() !== 'Student') {
                <button
                  type="button"
                  (click)="crms.batchAutoApproveEligible()"
                  class="px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] inline-flex items-center gap-1.5 transition-colors"
                >
                  <mat-icon class="!w-4 !h-4 !text-[16px]">done_all</mat-icon>
                  <span>Approve all ({{ crms.pendingApprovalsCount() }})</span>
                </button>
              }
            </div>
          </div>

          <!-- Collapsible Filters -->
          @if (filtersOpen()) {
            <div class="p-3.5 rounded-[10px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] flex items-center justify-between gap-3 text-xs">
              <div class="flex items-center gap-2">
                <label for="approval-filter" class="text-[#565b56] dark:text-[#9ca39e]">Filter by status:</label>
                <select
                  id="approval-filter"
                  [value]="statusFilter()"
                  (change)="onStatusFilterChange($event)"
                  class="px-2.5 py-1.5 text-xs rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
                >
                  <option value="ALL">All statuses ({{ crms.bookings().length }})</option>
                  <option value="Pending Approval">Pending approval ({{ crms.pendingApprovalsCount() }})</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <button
                type="button"
                (click)="filtersOpen.set(false)"
                class="px-2.5 py-1 rounded-[6px] border border-[#dcdcd5] hover:bg-[#efefeb] text-xs"
              >
                Done
              </button>
            </div>
          }

          <!-- Clean 4-Column Table (Request, Status, When, Action) -->
          <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] overflow-hidden">
            @if (filteredBookings().length === 0) {
              <div class="p-10 text-center space-y-2">
                <p class="text-sm font-semibold text-[#161917] dark:text-[#eceee9]">No reservations match this filter</p>
                <p class="text-xs text-[#565b56] dark:text-[#9ca39e]">Clear the status filter to see all bookings.</p>
                <button
                  type="button"
                  (click)="statusFilter.set('ALL')"
                  class="mt-2 px-3 py-1.5 rounded-[6px] border border-[#dcdcd5] hover:bg-[#efefeb] text-xs font-medium"
                >
                  Show all
                </button>
              </div>
            } @else {
              <!-- Desktop 4-Column Table -->
              <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="bg-[#f6f6f3] dark:bg-[#121413] border-b border-[#dcdcd5] dark:border-[#2c322e] text-[#565b56] dark:text-[#9ca39e]">
                    <tr>
                      <th class="py-3 px-4 font-semibold">Reservation &amp; purpose</th>
                      <th class="py-3 px-4 font-semibold">Status</th>
                      <th class="py-3 px-4 font-semibold">Date &amp; room</th>
                      <th class="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
                    @for (b of filteredBookings(); track b.id) {
                      <tr
                        (click)="selectedBookingDetails.set(b)"
                        class="h-14 hover:bg-[#efefeb]/60 dark:hover:bg-[#202422]/60 transition-colors cursor-pointer"
                      >
                        <!-- Col 1: Request -->
                        <td class="py-2.5 px-4 align-middle">
                          <div class="font-semibold text-[#161917] dark:text-[#eceee9] truncate max-w-[260px]">
                            {{ b.title }}
                          </div>
                          <div class="text-[11px] text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                            {{ b.requesterName }} ({{ b.requesterRole }}) · {{ b.department }}
                          </div>
                        </td>

                        <!-- Col 2: Status (Neutral text with colored icon only) -->
                        <td class="py-2.5 px-4 align-middle whitespace-nowrap">
                          <span class="inline-flex items-center gap-1.5 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                            <mat-icon
                              class="!w-4 !h-4 !text-[16px]"
                              [class.text-[#1B7F4B]]="b.status === 'Approved'"
                              [class.text-[#B45309]]="b.status === 'Pending Approval'"
                              [class.text-[#B91C1C]]="b.status === 'Rejected'"
                            >
                              {{ b.status === 'Approved' ? 'check_circle' : b.status === 'Rejected' ? 'cancel' : 'schedule' }}
                            </mat-icon>
                            <span>{{ b.status }}</span>
                          </span>
                        </td>

                        <!-- Col 3: When -->
                        <td class="py-2.5 px-4 align-middle">
                          <div class="font-mono text-[#161917] dark:text-[#eceee9]">
                            {{ b.date }} · {{ b.startTime }}-{{ b.endTime }}
                          </div>
                          <div class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                            {{ b.targetName }}
                          </div>
                        </td>

                        <!-- Col 4: Action -->
                        <td class="py-2.5 px-4 align-middle text-right whitespace-nowrap" (click)="$event.stopPropagation()">
                          <div class="inline-flex items-center justify-end gap-1.5">
                            @if (b.status === 'Pending Approval' && crms.activeRole() !== 'Student') {
                              <button
                                type="button"
                                (click)="crms.updateBookingStatus(b.id, 'Approved')"
                                class="h-[30px] px-2.5 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center gap-1"
                              >
                                <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">check</mat-icon>
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                (click)="confirmRejectBooking(b)"
                                class="h-[30px] px-2 text-xs font-medium text-red-700 dark:text-red-400 hover:underline inline-flex items-center gap-0.5"
                              >
                                <span>Reject</span>
                              </button>
                            } @else {
                              <button
                                type="button"
                                (click)="selectedBookingDetails.set(b)"
                                class="h-[30px] px-2.5 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9]"
                              >
                                Details
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Mobile Stacked Card List (Zero Horizontal Scroll on Phones & Small Tablets) -->
              <div class="block md:hidden divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
                @for (b of filteredBookings(); track b.id) {
                  <div class="p-3.5 space-y-3">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <h3 class="text-sm font-semibold text-[#161917] dark:text-[#eceee9] leading-snug">{{ b.title }}</h3>
                        <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                          {{ b.requesterName }} ({{ b.requesterRole }}) · {{ b.department }}
                        </p>
                      </div>
                      <span class="inline-flex items-center gap-1 text-xs shrink-0 text-[#14201A] dark:text-[#EDF3EE]">
                        <mat-icon
                          class="!w-4 !h-4 !text-[16px]"
                          [class.text-[#1B7F4B]]="b.status === 'Approved'"
                          [class.text-[#B45309]]="b.status === 'Pending Approval'"
                          [class.text-[#B91C1C]]="b.status === 'Rejected'"
                        >
                          {{ b.status === 'Approved' ? 'check_circle' : b.status === 'Rejected' ? 'cancel' : 'schedule' }}
                        </mat-icon>
                        <span class="font-medium">{{ b.status }}</span>
                      </span>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-[#dcdcd5]/60 dark:border-[#2c322e]/60">
                      <div class="font-mono text-[#565b56] dark:text-[#9ca39e]">
                        {{ b.date }} · {{ b.startTime }}-{{ b.endTime }}
                      </div>
                      <div class="font-medium text-[#161917] dark:text-[#eceee9]">
                        {{ b.targetName }}
                      </div>
                    </div>

                    <!-- Actions (44px min height) -->
                    <div class="pt-1 flex gap-2">
                      @if (b.status === 'Pending Approval' && crms.activeRole() !== 'Student') {
                        <button
                          type="button"
                          (click)="crms.updateBookingStatus(b.id, 'Approved')"
                          class="flex-1 min-h-[44px] px-3 text-xs font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center justify-center gap-1.5"
                        >
                          <mat-icon class="!w-4 !h-4 !text-[16px] text-[#1B7F4B]">check</mat-icon>
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          (click)="confirmRejectBooking(b)"
                          class="min-h-[44px] px-4 text-xs font-medium rounded-[6px] border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center justify-center"
                        >
                          <span>Reject</span>
                        </button>
                      } @else {
                        <button
                          type="button"
                          (click)="selectedBookingDetails.set(b)"
                          class="w-full min-h-[44px] px-3 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center justify-center"
                        >
                          View reservation details
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Facility Maintenance Work Orders Section -->
          <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] p-5 space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
              <div>
                <h2 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                  Facility maintenance &amp; repair orders
                </h2>
                <p class="text-xs text-[#565b56] dark:text-[#9ca39e]">
                  Active repair tickets. Resolving a ticket automatically restores the room to service.
                </p>
              </div>
            </div>

            <div class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px]">
              @for (wo of crms.workOrders(); track wo.id) {
                <div class="p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div class="font-mono text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                      {{ wo.ticketNo }} · Priority: {{ wo.priority }}
                    </div>
                    <p class="font-semibold text-[#161917] dark:text-[#eceee9] mt-0.5">
                      {{ wo.issueType }} · {{ wo.targetName }}
                    </p>
                    <p class="text-[#565b56] dark:text-[#9ca39e]">
                      Lead: {{ wo.assignedStaffName }} · Est: <span class="font-mono tabular-nums">₱{{ wo.estimatedCostPhp | number }}</span>
                    </p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span
                      class="font-mono font-medium flex items-center gap-1"
                      [class.text-emerald-700]="wo.status === 'Resolved'"
                      [class.text-amber-800]="wo.status !== 'Resolved'"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                        {{ wo.status === 'Resolved' ? 'check_circle' : 'build' }}
                      </mat-icon>
                      <span>{{ wo.status }}</span>
                    </span>
                    @if (wo.status !== 'Resolved') {
                      <button
                        type="button"
                        (click)="crms.updateWorkOrderStatus(wo.id, 'Resolved')"
                        class="px-2.5 py-1 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb]"
                      >
                        Resolve
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
          <!-- Responsive Slide-Over / Bottom Sheet for Booking Details -->
          @if (selectedBookingDetails(); as b) {
            <div class="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="booking-details-title">
              <button
                type="button"
                aria-label="Close reservation details"
                (click)="selectedBookingDetails.set(null)"
                class="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity w-full h-full cursor-default"
              ></button>

              <div class="fixed inset-y-0 right-0 pl-0 sm:pl-10 max-w-full flex w-full sm:w-auto">
                <div class="w-full sm:w-screen sm:max-w-md bg-[#fbfbfa] dark:bg-[#181b19] border-l border-[#dcdcd5] dark:border-[#2c322e] shadow-xl p-4 sm:p-5 flex flex-col justify-between overflow-y-auto min-h-full">
                  <div class="space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                      <div>
                        <span class="font-mono text-xs font-bold text-[#14532d] dark:text-[#4ade80]">
                          {{ b.id }}
                        </span>
                        <h2 id="booking-details-title" class="text-base font-bold text-[#161917] dark:text-[#eceee9]">
                          {{ b.title }}
                        </h2>
                      </div>
                      <button
                        type="button"
                        (click)="selectedBookingDetails.set(null)"
                        aria-label="Close details"
                        class="p-2 sm:p-1 rounded-[6px] hover:bg-[#efefeb] dark:hover:bg-[#222624]"
                      >
                        <mat-icon class="!w-5 !h-5 !text-[20px]">close</mat-icon>
                      </button>
                    </div>

                    <div class="space-y-3 text-xs">
                      <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] space-y-1">
                        <span class="text-[#565b56] dark:text-[#9ca39e]">Requester &amp; department</span>
                        <div class="font-semibold text-[#161917] dark:text-[#eceee9]">
                          {{ b.requesterName }} ({{ b.requesterRole }})
                        </div>
                        <div class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">{{ b.department }}</div>
                      </div>

                      <div class="grid grid-cols-2 gap-3">
                        <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] space-y-1">
                          <span class="text-[#565b56] dark:text-[#9ca39e]">Schedule</span>
                          <div class="font-mono font-bold text-[#161917] dark:text-[#eceee9]">{{ b.date }}</div>
                          <div class="font-mono text-[11px] text-[#565b56] dark:text-[#9ca39e]">{{ b.startTime }} - {{ b.endTime }}</div>
                        </div>
                        <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] space-y-1">
                          <span class="text-[#565b56] dark:text-[#9ca39e]">Target venue</span>
                          <div class="font-semibold text-[#161917] dark:text-[#eceee9]">{{ b.targetName }}</div>
                          <div class="font-mono text-[11px] text-[#565b56] dark:text-[#9ca39e]">{{ b.attendees }} attendees</div>
                        </div>
                      </div>

                      <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] flex items-center justify-between">
                        <span class="text-[#565b56] dark:text-[#9ca39e]">Current status</span>
                        <span class="inline-flex items-center gap-1.5 font-semibold text-[#161917] dark:text-[#eceee9]">
                          <mat-icon
                            class="!w-4 !h-4 !text-[16px]"
                            [class.text-[#1B7F4B]]="b.status === 'Approved'"
                            [class.text-[#B45309]]="b.status === 'Pending Approval'"
                            [class.text-[#B91C1C]]="b.status === 'Rejected'"
                          >
                            {{ b.status === 'Approved' ? 'check_circle' : b.status === 'Rejected' ? 'cancel' : 'schedule' }}
                          </mat-icon>
                          <span>{{ b.status }}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="pt-3 border-t border-[#dcdcd5] dark:border-[#2c322e] flex items-center justify-end gap-2 sticky bottom-0 bg-[#fbfbfa] dark:bg-[#181b19] py-2">
                    @if (b.status === 'Pending Approval' && crms.activeRole() !== 'Student') {
                      <button
                        type="button"
                        (click)="confirmRejectBooking(b); selectedBookingDetails.set(null)"
                        class="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-[6px] border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        (click)="crms.updateBookingStatus(b.id, 'Approved'); selectedBookingDetails.set(null)"
                        class="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-[6px] bg-[#14532d] hover:bg-[#166534] text-white"
                      >
                        Approve reservation
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="selectedBookingDetails.set(null)"
                        class="w-full sm:w-auto min-h-[44px] px-4 py-2 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] hover:bg-[#efefeb]"
                      >
                        Close
                      </button>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- ============================================== -->
      <!-- 2. REPORTS (Analytics & Space Utilization)    -->
      <!-- ============================================== -->
      @case ('analytics') {
        <div class="space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#dcdcd5] dark:border-[#2c322e]">
            <div>
              <h1 class="text-xl lg:text-2xl font-bold text-[#161917] dark:text-[#eceee9]">
                Reports &amp; analytics
              </h1>
              <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-1">
                Space utilization, campus power consumption, and department budget expenditures.
              </p>
            </div>

            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <button
                type="button"
                (click)="exportOccupancyAndMaintenanceCsv()"
                class="min-h-[44px] sm:min-h-[34px] px-3.5 py-2 sm:py-1.5 text-xs font-semibold rounded-[6px] bg-[#1B7F4B] hover:bg-[#16683D] text-white inline-flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                title="Export current occupancy analytics and maintenance logs to CSV for department financial reporting"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">file_download</mat-icon>
                <span>Export occupancy &amp; maintenance CSV</span>
              </button>
              <button
                type="button"
                (click)="exportReportJson()"
                class="min-h-[44px] sm:min-h-[34px] px-3 py-2 sm:py-1.5 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center justify-center gap-1.5 transition-colors"
                title="Export campus state JSON snapshot"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">data_object</mat-icon>
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          <!-- Metrics Strip -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs">
            <div class="p-3.5 sm:p-4 rounded-[10px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e]">
              <span class="text-[#565b56] dark:text-[#9ca39e]">Campus Utilization</span>
              <div class="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#161917] dark:text-[#eceee9] mt-1">
                {{ crms.campusUtilizationPct() }}%
              </div>
              <p class="text-[11px] text-[#565b56] dark:text-[#9ca39e] mt-0.5">Average weekly occupancy</p>
            </div>

            <div class="p-3.5 sm:p-4 rounded-[10px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e]">
              <span class="text-[#565b56] dark:text-[#9ca39e]">Operational Rooms</span>
              <div class="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#161917] dark:text-[#eceee9] mt-1">
                {{ crms.rooms().length }}
              </div>
              <p class="text-[11px] text-[#565b56] dark:text-[#9ca39e] mt-0.5">Across 4 campus buildings</p>
            </div>

            <div class="p-3.5 sm:p-4 rounded-[10px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e]">
              <span class="text-[#565b56] dark:text-[#9ca39e]">Total Energy Load</span>
              <div class="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#161917] dark:text-[#eceee9] mt-1">
                {{ crms.totalEnergyKw() }} kW
              </div>
              <p class="text-[11px] text-[#565b56] dark:text-[#9ca39e] mt-0.5">Real-time IoT sensors</p>
            </div>

            <div class="p-3.5 sm:p-4 rounded-[10px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e]">
              <span class="text-[#565b56] dark:text-[#9ca39e]">Term Budget Disbursed</span>
              <div class="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#161917] dark:text-[#eceee9] mt-1">
                ₱{{ crms.totalBudgetSpent() | number }}
              </div>
              <p class="text-[11px] text-[#565b56] dark:text-[#9ca39e] mt-0.5">Of ₱{{ crms.totalBudgetAllocated() | number }} total</p>
            </div>
          </div>

          <!-- Departmental Budget Table / Mobile Cards -->
          <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] overflow-hidden">
            <div class="p-3.5 border-b border-[#dcdcd5] dark:border-[#2c322e]">
              <h2 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                Department budget ledger
              </h2>
            </div>
            <!-- Desktop Table -->
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead class="bg-[#f6f6f3] dark:bg-[#121413] border-b border-[#dcdcd5] dark:border-[#2c322e] text-[#565b56] dark:text-[#9ca39e]">
                  <tr>
                    <th class="py-2.5 px-4 font-semibold">Department</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Allocated</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Spent</th>
                    <th class="py-2.5 px-4 font-semibold text-right">Available</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e] font-mono tabular-nums">
                  @for (b of crms.budgets(); track b.id) {
                    @let avail = b.allocatedPhp - b.spentPhp - b.encumberedPhp;
                    <tr class="hover:bg-[#efefeb]/60">
                      <td class="py-3 px-4 font-sans font-semibold text-[#161917] dark:text-[#eceee9]">
                        {{ b.department }}
                      </td>
                      <td class="py-3 px-3 text-right">₱{{ b.allocatedPhp | number }}</td>
                      <td class="py-3 px-3 text-right">₱{{ b.spentPhp | number }}</td>
                      <td class="py-3 px-4 text-right font-bold text-[#14532d] dark:text-[#4ade80]">₱{{ avail | number }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <!-- Mobile Stacked Cards -->
            <div class="block md:hidden divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
              @for (b of crms.budgets(); track b.id) {
                @let avail = b.allocatedPhp - b.spentPhp - b.encumberedPhp;
                <div class="p-3.5 space-y-2 text-xs">
                  <div class="font-semibold text-[#161917] dark:text-[#eceee9]">{{ b.department }}</div>
                  <div class="grid grid-cols-3 gap-2 font-mono tabular-nums pt-1">
                    <div>
                      <span class="block font-sans text-[11px] text-[#565b56] dark:text-[#9ca39e]">Allocated</span>
                      <span>₱{{ b.allocatedPhp | number }}</span>
                    </div>
                    <div>
                      <span class="block font-sans text-[11px] text-[#565b56] dark:text-[#9ca39e]">Spent</span>
                      <span>₱{{ b.spentPhp | number }}</span>
                    </div>
                    <div class="text-right">
                      <span class="block font-sans text-[11px] text-[#565b56] dark:text-[#9ca39e]">Available</span>
                      <span class="font-bold text-[#14532d] dark:text-[#4ade80]">₱{{ avail | number }}</span>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Occupancy Analytics & Maintenance Ledger Tables -->
          <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-1 p-0.5 rounded-[6px] bg-[#f0f0eb] dark:bg-[#222624] border border-[#dcdcd5] dark:border-[#2c322e] text-xs">
                <button
                  type="button"
                  (click)="reportDetailTab.set('occupancy')"
                  class="min-h-[36px] px-2.5 py-1 rounded-[5px] font-medium transition-colors"
                  [class.bg-white]="reportDetailTab() === 'occupancy' && !crms.darkMode()"
                  [class.text-[#14532d]]="reportDetailTab() === 'occupancy' && !crms.darkMode()"
                  [class.dark:bg-[#181b19]]="reportDetailTab() === 'occupancy' && crms.darkMode()"
                  [class.dark:text-[#4ade80]]="reportDetailTab() === 'occupancy' && crms.darkMode()"
                  [class.font-semibold]="reportDetailTab() === 'occupancy'"
                  [class.text-[#4a504c]]="reportDetailTab() !== 'occupancy' && !crms.darkMode()"
                  [class.text-[#b5bdb8]]="reportDetailTab() !== 'occupancy' && crms.darkMode()"
                >
                  Room occupancy &amp; costs
                </button>
                <button
                  type="button"
                  (click)="reportDetailTab.set('maintenance')"
                  class="min-h-[36px] px-2.5 py-1 rounded-[5px] font-medium transition-colors"
                  [class.bg-white]="reportDetailTab() === 'maintenance' && !crms.darkMode()"
                  [class.text-[#14532d]]="reportDetailTab() === 'maintenance' && !crms.darkMode()"
                  [class.dark:bg-[#181b19]]="reportDetailTab() === 'maintenance' && crms.darkMode()"
                  [class.dark:text-[#4ade80]]="reportDetailTab() === 'maintenance' && crms.darkMode()"
                  [class.font-semibold]="reportDetailTab() === 'maintenance'"
                  [class.text-[#4a504c]]="reportDetailTab() !== 'maintenance' && !crms.darkMode()"
                  [class.text-[#b5bdb8]]="reportDetailTab() !== 'maintenance' && crms.darkMode()"
                >
                  Maintenance logs ({{ crms.workOrders().length }})
                </button>
              </div>

              <span class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                Exported into department financial CSV
              </span>
            </div>

            @if (reportDetailTab() === 'occupancy') {
              <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] overflow-hidden">
                <div class="p-3.5 border-b border-[#dcdcd5] dark:border-[#2c322e] flex items-center justify-between">
                  <div>
                    <h2 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                      Facility occupancy &amp; operating costs
                    </h2>
                    <p class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                      Current seat utilization and hourly operating expense estimates by room.
                    </p>
                  </div>
                  <span class="font-mono text-xs text-[#565b56] dark:text-[#9ca39e] shrink-0">
                    {{ crms.rooms().length }} rooms
                  </span>
                </div>
                <!-- Desktop Table -->
                <div class="hidden md:block overflow-x-auto">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead class="bg-[#f6f6f3] dark:bg-[#121413] border-b border-[#dcdcd5] dark:border-[#2c322e] text-[#565b56] dark:text-[#9ca39e]">
                      <tr>
                        <th class="py-2.5 px-4 font-semibold">Room &amp; building</th>
                        <th class="py-2.5 px-3 font-semibold text-right">Occupancy / Seats</th>
                        <th class="py-2.5 px-3 font-semibold">Status</th>
                        <th class="py-2.5 px-4 font-semibold text-right">Hourly rate</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e] font-mono tabular-nums">
                      @for (r of crms.rooms(); track r.id) {
                        @let pct = r.capacity > 0 ? (r.occupancyCount / r.capacity) * 100 : 0;
                        <tr class="hover:bg-[#efefeb]/60">
                          <td class="py-3 px-4 font-sans">
                            <div class="font-mono font-semibold text-[#161917] dark:text-[#eceee9]">{{ r.code }}</div>
                            <div class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">{{ r.name }} · {{ r.building }}</div>
                          </td>
                          <td class="py-3 px-3 text-right">
                            <span class="font-bold text-[#161917] dark:text-[#eceee9]">{{ r.occupancyCount }}</span> / {{ r.capacity }}
                            <div class="text-[10px] text-[#565b56] dark:text-[#9ca39e]">{{ pct | number: '1.0-1' }}% full</div>
                          </td>
                          <td class="py-3 px-3 font-sans">
                            @if (r.availabilityState === 'Operational') {
                              <span class="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-400 font-medium">
                                <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">check_circle</mat-icon>
                                <span>Operational</span>
                              </span>
                            } @else {
                              <span class="inline-flex items-center gap-1 text-red-800 dark:text-red-400 font-semibold">
                                <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">build_circle</mat-icon>
                                <span>Maintenance</span>
                              </span>
                            }
                          </td>
                          <td class="py-3 px-4 text-right font-medium text-[#161917] dark:text-[#eceee9]">
                            ₱{{ r.hourlyCostPhp | number }}/hr
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <!-- Mobile Stacked Cards -->
                <div class="block md:hidden divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
                  @for (r of crms.rooms(); track r.id) {
                    @let pct = r.capacity > 0 ? (r.occupancyCount / r.capacity) * 100 : 0;
                    <div class="p-3.5 space-y-2 text-xs">
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <span class="font-mono font-bold text-[#161917] dark:text-[#eceee9]">{{ r.code }}</span>
                          <div class="text-[#565b56] dark:text-[#9ca39e]">{{ r.name }} · {{ r.building }}</div>
                        </div>
                        <span class="font-mono font-semibold text-[#161917] dark:text-[#eceee9]">₱{{ r.hourlyCostPhp | number }}/hr</span>
                      </div>
                      <div class="flex items-center justify-between pt-1">
                        <span class="font-mono tabular-nums text-[#565b56] dark:text-[#9ca39e]">
                          <strong class="text-[#161917] dark:text-[#eceee9]">{{ r.occupancyCount }}</strong> / {{ r.capacity }} seats ({{ pct | number: '1.0-1' }}%)
                        </span>
                        @if (r.availabilityState === 'Operational') {
                          <span class="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-400 font-medium">
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">check_circle</mat-icon>
                            <span>Operational</span>
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1 text-red-800 dark:text-red-400 font-semibold">
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">build_circle</mat-icon>
                            <span>Maintenance</span>
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] overflow-hidden">
                <div class="p-3.5 border-b border-[#dcdcd5] dark:border-[#2c322e] flex items-center justify-between">
                  <div>
                    <h2 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                      Facility maintenance work order ledger
                    </h2>
                    <p class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                      Logged repairs, priority levels, and committed repair costs.
                    </p>
                  </div>
                  <span class="font-mono text-xs text-[#565b56] dark:text-[#9ca39e] shrink-0">
                    {{ crms.workOrders().length }} orders
                  </span>
                </div>
                <!-- Desktop Table -->
                <div class="hidden md:block overflow-x-auto">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead class="bg-[#f6f6f3] dark:bg-[#121413] border-b border-[#dcdcd5] dark:border-[#2c322e] text-[#565b56] dark:text-[#9ca39e]">
                      <tr>
                        <th class="py-2.5 px-4 font-semibold">Ticket &amp; target</th>
                        <th class="py-2.5 px-3 font-semibold">Issue &amp; priority</th>
                        <th class="py-2.5 px-3 font-semibold">Status</th>
                        <th class="py-2.5 px-4 font-semibold text-right">Est. repair cost</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e] font-mono tabular-nums">
                      @for (wo of crms.workOrders(); track wo.id) {
                        <tr class="hover:bg-[#efefeb]/60">
                          <td class="py-3 px-4 font-sans">
                            <div class="font-mono font-semibold text-[#161917] dark:text-[#eceee9]">{{ wo.ticketNo }}</div>
                            <div class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">{{ wo.targetName }}</div>
                          </td>
                          <td class="py-3 px-3 font-sans">
                            <div class="font-medium text-[#161917] dark:text-[#eceee9]">{{ wo.issueType }}</div>
                            <div class="text-[10px]" [class.text-red-700]="wo.priority === 'Critical'" [class.text-amber-700]="wo.priority === 'High'" [class.text-[#565b56]]="wo.priority === 'Routine'">
                              Priority: {{ wo.priority }}
                            </div>
                          </td>
                          <td class="py-3 px-3 font-sans">
                            <span class="px-2 py-0.5 rounded-[4px] text-[11px] font-medium"
                              [class.bg-emerald-100]="wo.status === 'Resolved'"
                              [class.text-emerald-800]="wo.status === 'Resolved'"
                              [class.bg-amber-100]="wo.status === 'In Progress'"
                              [class.text-amber-800]="wo.status === 'In Progress'"
                              [class.bg-red-100]="wo.status === 'Open'"
                              [class.text-red-800]="wo.status === 'Open'"
                            >
                              {{ wo.status }}
                            </span>
                          </td>
                          <td class="py-3 px-4 text-right font-bold text-[#14532d] dark:text-[#4ade80]">
                            ₱{{ wo.estimatedCostPhp | number }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <!-- Mobile Stacked Cards -->
                <div class="block md:hidden divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
                  @for (wo of crms.workOrders(); track wo.id) {
                    <div class="p-3.5 space-y-2 text-xs">
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <span class="font-mono font-semibold text-[#161917] dark:text-[#eceee9]">{{ wo.ticketNo }}</span>
                          <div class="font-medium text-[#161917] dark:text-[#eceee9]">{{ wo.issueType }} · {{ wo.targetName }}</div>
                        </div>
                        <span class="font-mono font-bold text-[#14532d] dark:text-[#4ade80]">₱{{ wo.estimatedCostPhp | number }}</span>
                      </div>
                      <div class="flex items-center justify-between pt-1">
                        <span class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">Priority: {{ wo.priority }}</span>
                        <span class="font-medium text-[#161917] dark:text-[#eceee9]">{{ wo.status }}</span>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- ============================================================== -->
      <!-- 3. ADMIN (Audit Log, Staff Load, Cashier & Integrations)       -->
      <!-- ============================================================== -->
      @case ('security-ecosystem') {
        <div class="space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#dcdcd5] dark:border-[#2c322e]">
            <div>
              <h1 class="text-xl lg:text-2xl font-bold text-[#161917] dark:text-[#eceee9]">
                Administrator governance
              </h1>
              <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-1">
                Audit logs, personnel allocation, cashier payment ledgers, and connected systems.
              </p>
            </div>

            <!-- Admin Sub-Section Selector -->
            <div class="flex items-center p-0.5 rounded-[6px] bg-[#f0f0eb] dark:bg-[#222624] border border-[#dcdcd5] dark:border-[#2c322e] text-xs self-start sm:self-auto">
              <button
                type="button"
                (click)="adminSection.set('audit')"
                class="min-h-[36px] px-3 py-1 font-medium rounded-[5px]"
                [class.bg-white]="adminSection() === 'audit'"
                [class.dark:bg-[#181b19]]="adminSection() === 'audit'"
                [class.font-semibold]="adminSection() === 'audit'"
              >
                Audit log
              </button>
              <button
                type="button"
                (click)="adminSection.set('staff')"
                class="min-h-[36px] px-3 py-1 font-medium rounded-[5px]"
                [class.bg-white]="adminSection() === 'staff'"
                [class.dark:bg-[#181b19]]="adminSection() === 'staff'"
                [class.font-semibold]="adminSection() === 'staff'"
              >
                Staff load
              </button>
              <button
                type="button"
                (click)="adminSection.set('cashier')"
                class="min-h-[36px] px-3 py-1 font-medium rounded-[5px]"
                [class.bg-white]="adminSection() === 'cashier'"
                [class.dark:bg-[#181b19]]="adminSection() === 'cashier'"
                [class.font-semibold]="adminSection() === 'cashier'"
              >
                Cashier
              </button>
            </div>
          </div>

          <!-- Admin Sub-Section 1: Audit Log & Security -->
          @if (adminSection() === 'audit') {
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div class="lg:col-span-7 bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] p-4 space-y-4">
                <div class="pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                  <h2 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                    Connected campus systems
                  </h2>
                  <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                    Connectors for Canvas LMS, SIS, Koha Library, and RFID turnstiles.
                  </p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  @for (intg of crms.integrations(); track intg.id) {
                    <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] space-y-2">
                      <div class="flex items-center justify-between font-mono text-[11px]">
                        <span class="font-bold">{{ intg.category }}</span>
                        <span class="text-emerald-700 dark:text-emerald-400 font-medium">{{ intg.status }}</span>
                      </div>
                      <div class="font-bold text-[#161917] dark:text-[#eceee9]">{{ intg.systemName }}</div>
                      <div class="text-[11px] font-mono text-[#565b56] dark:text-[#9ca39e]">
                        {{ intg.recordsSynced | number }} records synced
                      </div>
                      <button
                        type="button"
                        (click)="crms.syncEcosystemIntegration(intg.id)"
                        class="w-full min-h-[38px] py-1.5 text-xs font-medium rounded-[4px] border border-[#dcdcd5] hover:bg-[#efefeb]"
                      >
                        Sync now
                      </button>
                    </div>
                  }
                </div>
              </div>

              <!-- Immutable Audit Trail -->
              <div class="lg:col-span-5 bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] p-4 space-y-3">
                <div class="pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                  <h2 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                    Security audit log ({{ crms.auditLogs().length }} events)
                  </h2>
                </div>

                <div class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e] max-h-[480px] overflow-y-auto border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413]">
                  @for (log of crms.auditLogs(); track log.id) {
                    <div class="p-3 text-xs space-y-1">
                      <div class="flex items-center justify-between font-mono text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                        <span>{{ log.timestamp }}</span>
                        <span class="font-semibold">{{ log.severity }}</span>
                      </div>
                      <p class="font-medium text-[#161917] dark:text-[#eceee9]">{{ log.action }}</p>
                      <p class="font-mono text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                        {{ log.actorName }} · {{ log.module }}
                      </p>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Admin Sub-Section 2: Staff Load & Personnel Roster -->
          @if (adminSection() === 'staff') {
            <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
              @for (member of crms.staff(); track member.id) {
                <div class="p-4 space-y-2 text-xs">
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <span class="font-mono text-[11px] text-[#565b56] dark:text-[#9ca39e]">{{ member.employeeId }} · {{ member.role }}</span>
                      <h3 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">{{ member.name }}</h3>
                      <p class="text-[#565b56] dark:text-[#9ca39e]">{{ member.department }} · {{ member.specialization }}</p>
                    </div>
                    <div class="font-mono tabular-nums text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                      {{ member.assignedHours }} / {{ member.maxWeeklyHours }} hrs/wk
                    </div>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Admin Sub-Section 3: Cashier & Student Transactions -->
          @if (adminSection() === 'cashier') {
            <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] overflow-hidden">
              <div class="p-3.5 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                <h2 class="text-sm font-bold text-[#161917] dark:text-[#eceee9]">
                  Cashier &amp; student service transactions
                </h2>
              </div>
              <!-- Desktop Table -->
              <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="bg-[#f6f6f3] dark:bg-[#121413] border-b border-[#dcdcd5] dark:border-[#2c322e] text-[#565b56] dark:text-[#9ca39e]">
                    <tr>
                      <th class="py-2.5 px-4 font-semibold">Receipt / Reference</th>
                      <th class="py-2.5 px-3 font-semibold">Student</th>
                      <th class="py-2.5 px-3 font-semibold">Particulars</th>
                      <th class="py-2.5 px-4 font-semibold text-right">Amount (₱)</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e] font-mono tabular-nums">
                    @for (p of crms.payments(); track p.id) {
                      <tr class="hover:bg-[#efefeb]/60">
                        <td class="py-3 px-4 font-bold text-[#161917] dark:text-[#eceee9]">{{ p.referenceNo }}</td>
                        <td class="py-3 px-3 font-sans">{{ p.payerName }}</td>
                        <td class="py-3 px-3 font-sans text-[#565b56] dark:text-[#9ca39e]">{{ p.description }}</td>
                        <td class="py-3 px-4 text-right font-bold text-emerald-800 dark:text-emerald-400">₱{{ p.amountPhp | number }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <!-- Mobile Stacked Cards -->
              <div class="block md:hidden divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
                @for (p of crms.payments(); track p.id) {
                  <div class="p-3.5 space-y-1.5 text-xs">
                    <div class="flex items-center justify-between font-mono">
                      <span class="font-bold text-[#161917] dark:text-[#eceee9]">{{ p.referenceNo }}</span>
                      <span class="font-bold text-emerald-800 dark:text-emerald-400">₱{{ p.amountPhp | number }}</span>
                    </div>
                    <div class="font-medium text-[#161917] dark:text-[#eceee9]">{{ p.payerName }}</div>
                    <div class="text-[#565b56] dark:text-[#9ca39e]">{{ p.description }}</div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    }
  `,
})
export class OperationsAnalyticsSecurityView {
  readonly crms = inject(CrmsService);
  private readonly fb = inject(FormBuilder);

  readonly filtersOpen = signal<boolean>(false);
  readonly statusFilter = signal<string>('ALL');
  readonly selectedBookingDetails = signal<BookingRecord | null>(null);
  readonly selectedBookingIds = signal<string[]>([]);
  readonly adminSection = signal<'audit' | 'staff' | 'cashier'>('audit');
  readonly reportDetailTab = signal<'occupancy' | 'maintenance'>('occupancy');

  readonly selectedApiIntegration = signal<EcosystemIntegration | null>(
    this.crms.integrations()[0]
  );

  readonly workOrderForm = this.fb.nonNullable.group({
    targetRoomId: ['RM-101', Validators.required],
    issueType: ['HVAC Repair' as const, Validators.required],
    priority: ['High' as const, Validators.required],
    estimatedCostPhp: [6450, [Validators.required, Validators.min(500)]],
    blocksRoomAvailability: [true],
  });

  readonly filteredBookings = computed(() => {
    const sf = this.statusFilter();
    if (sf === 'ALL') return this.crms.bookings();
    return this.crms.bookings().filter((b) => b.status === sf);
  });

  onStatusFilterChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
  }

  confirmRejectBooking(b: BookingRecord): void {
    this.crms.requestConfirmation({
      title: `Reject reservation?`,
      consequence: `This will cancel "${b.title}" for ${b.targetName} on ${b.date}.`,
      confirmLabel: 'Reject reservation',
      severity: 'danger',
      onConfirm: () => {
        this.crms.updateBookingStatus(b.id, 'Rejected');
      },
    });
  }

  exportOccupancyAndMaintenanceCsv(): void {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const term = this.crms.currentTerm();
    const persona = this.crms.activePersona();

    const escapeCsv = (val: string | number | boolean | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];

    // METADATA HEADER
    lines.push('========================================================================================');
    lines.push('BIÑAN CAMPUS RESOURCE MANAGEMENT SYSTEM (CRMS) - FINANCIAL & OCCUPANCY AUDIT REPORT');
    lines.push('========================================================================================');
    lines.push(`Academic Term,${escapeCsv(term)}`);
    lines.push(`Generated Timestamp,${escapeCsv(timestamp)}`);
    lines.push(`Exported By,${escapeCsv(persona.name + ' (' + persona.title + ')')}`);
    lines.push(`Reporting Department,${escapeCsv(persona.department)}`);
    lines.push('Currency,Philippine Peso (PHP ₱)');
    lines.push('');

    // SECTION 1: OCCUPANCY & FACILITY OPERATING EXPENSES
    lines.push('--- SECTION 1: CURRENT SPACE OCCUPANCY & FACILITY OPERATING EXPENSES ---');
    const occHeaders = [
      'Room Code',
      'Room Name',
      'Building',
      'Floor',
      'Type',
      'Capacity (Seats)',
      'Current Occupancy',
      'Occupancy Rate (%)',
      'Availability State',
      'Assigned Department',
      'Active Course / Event',
      'Schedule',
      'Hourly Rate (PHP)',
      'Energy Load (kW)',
      'Est. Daily Energy Cost (PHP)',
      'Est. Weekly Operating Cost (PHP)',
    ];
    lines.push(occHeaders.map(escapeCsv).join(','));

    const courses = this.crms.termCourses();
    const rooms = this.crms.rooms();

    for (const r of rooms) {
      const assignedCourse = courses.find((c) => c.constantRoomId === r.id || c.relocatedRoomId === r.id);
      const department = assignedCourse?.department || (r.building === 'Science & Innovation Wing' ? 'College of Science & Biotechnology' : 'College of Computing & Engineering');
      const activeEvent = assignedCourse ? `${assignedCourse.courseCode} - ${assignedCourse.courseTitle}` : (r.occupancyCount > 0 ? 'Study / Ad-hoc Reservation' : 'Idle / Available');
      const schedule = assignedCourse ? `${assignedCourse.scheduleDays} ${assignedCourse.startTime}-${assignedCourse.endTime}` : 'N/A';
      const occPct = r.capacity > 0 ? ((r.occupancyCount / r.capacity) * 100).toFixed(1) : '0.0';
      const dailyEnergyPhp = (r.energyKw * 10 * 12.5).toFixed(2);
      const weeklyOperatingPhp = (r.hourlyCostPhp * 40 + Number(dailyEnergyPhp) * 5).toFixed(2);

      const row = [
        r.code,
        r.name,
        r.building,
        `Floor ${r.floor}`,
        r.type,
        r.capacity,
        r.occupancyCount,
        `${occPct}%`,
        r.availabilityState,
        department,
        activeEvent,
        schedule,
        r.hourlyCostPhp.toFixed(2),
        r.energyKw.toFixed(1),
        dailyEnergyPhp,
        weeklyOperatingPhp,
      ];
      lines.push(row.map(escapeCsv).join(','));
    }
    lines.push('');

    // SECTION 2: MAINTENANCE WORK ORDER LOGS & FINANCIAL REPAIR COSTS
    lines.push('--- SECTION 2: MAINTENANCE WORK ORDER LOGS & EXPENSE TRACKING ---');
    const maintHeaders = [
      'Ticket No',
      'Facility Code',
      'Facility Name',
      'Issue Type',
      'Priority',
      'Blocks Availability',
      'Assigned Staff',
      'Status',
      'Estimated Cost (PHP)',
      'SLA Deadline',
      'Date Logged',
      'Charged Cost Center',
    ];
    lines.push(maintHeaders.map(escapeCsv).join(','));

    const workOrders = this.crms.workOrders();
    let totalMaintCost = 0;
    for (const wo of workOrders) {
      totalMaintCost += wo.estimatedCostPhp;
      const targetRoom = rooms.find((r) => r.id === wo.targetRoomId);
      const chargedDept = targetRoom?.building === 'Science & Innovation Wing'
        ? 'College of Science & Biotechnology (CSB-2026)'
        : targetRoom?.building === 'University Sports Complex'
          ? 'Physical Education & Athletics (PEA-2026)'
          : 'Facilities & Asset Management (FAM-2026)';

      const row = [
        wo.ticketNo,
        targetRoom?.code || wo.targetRoomId,
        wo.targetName,
        wo.issueType,
        wo.priority,
        wo.blocksRoomAvailability ? 'Yes (Offline)' : 'No (Operational)',
        wo.assignedStaffName,
        wo.status,
        wo.estimatedCostPhp.toFixed(2),
        wo.slaDeadline,
        wo.createdAt,
        chargedDept,
      ];
      lines.push(row.map(escapeCsv).join(','));
    }
    lines.push('');

    // SECTION 3: DEPARTMENT BUDGET & FINANCIAL ALLOCATIONS
    lines.push('--- SECTION 3: DEPARTMENT-LEVEL BUDGET ALLOCATIONS & BALANCES ---');
    const budgetHeaders = [
      'Department Code',
      'Department Name',
      'Cost Center Lead',
      'Allocated Budget (PHP)',
      'Disbursed Spent (PHP)',
      'Encumbered (PHP)',
      'Remaining Balance (PHP)',
      'Budget Utilization (%)',
      'Monthly Burn Rate (PHP)',
    ];
    lines.push(budgetHeaders.map(escapeCsv).join(','));

    let totalAlloc = 0;
    let totalSpent = 0;
    let totalEncumbered = 0;
    let totalAvail = 0;

    for (const b of this.crms.budgets()) {
      const avail = b.allocatedPhp - b.spentPhp - b.encumberedPhp;
      const utilPct = b.allocatedPhp > 0 ? (((b.spentPhp + b.encumberedPhp) / b.allocatedPhp) * 100).toFixed(1) : '0.0';
      totalAlloc += b.allocatedPhp;
      totalSpent += b.spentPhp;
      totalEncumbered += b.encumberedPhp;
      totalAvail += avail;

      const row = [
        b.code,
        b.department,
        b.costCenterLead,
        b.allocatedPhp.toFixed(2),
        b.spentPhp.toFixed(2),
        b.encumberedPhp.toFixed(2),
        avail.toFixed(2),
        `${utilPct}%`,
        b.monthlyBurnPhp.toFixed(2),
      ];
      lines.push(row.map(escapeCsv).join(','));
    }
    lines.push('');

    // SECTION 4: EXECUTIVE CONSOLIDATED SUMMARY
    lines.push('--- SECTION 4: CONSOLIDATED EXECUTIVE TOTALS ---');
    lines.push(`Total Campus Capacity (Seats),${this.crms.totalCapacity()}`);
    lines.push(`Total Occupancy Headcount,${this.crms.totalOccupancy()}`);
    lines.push(`Overall Campus Utilization Rate,${this.crms.campusUtilizationPct()}%`);
    lines.push(`Total Real-time Energy Load,${this.crms.totalEnergyKw()} kW`);
    lines.push(`Total Department Budget Allocated (PHP),₱${totalAlloc.toFixed(2)}`);
    lines.push(`Total Direct Expenditures Spent (PHP),₱${totalSpent.toFixed(2)}`);
    lines.push(`Total Encumbered Requisitions (PHP),₱${totalEncumbered.toFixed(2)}`);
    lines.push(`Total Net Available Funds (PHP),₱${totalAvail.toFixed(2)}`);
    lines.push(`Total Committed Maintenance Work Orders (PHP),₱${totalMaintCost.toFixed(2)}`);

    const csvContent = lines.join('\r\n');
    const filename = `binan-crms-financial-occupancy-report-${new Date().toISOString().slice(0, 10)}.csv`;
    this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    this.crms.pushToast(
      'Financial CSV exported',
      `Downloaded occupancy analytics and maintenance logs (${filename}).`,
      'success'
    );
  }

  exportReportCsv(): void {
    this.exportOccupancyAndMaintenanceCsv();
  }

  exportReportJson(): void {
    const snapshot = {
      campus: 'Biñan Campus Resource Management System',
      term: this.crms.currentTerm(),
      rooms: this.crms.rooms(),
      termCourses: this.crms.termCourses(),
      budgets: this.crms.budgets(),
    };
    this.downloadFile(
      JSON.stringify(snapshot, null, 2),
      'binan-crms-snapshot.json',
      'application/json'
    );
    this.crms.pushToast('JSON exported', 'Downloaded campus state JSON.', 'success');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    if (typeof window === 'undefined') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
