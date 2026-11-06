import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmsService } from '../services/crms';
import { TermCourseAssignment } from '../models/crms.models';

@Component({
  selector: 'app-rooms-courses-view',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <!-- Page Header: Task-First Screen with Clear Primary Goal -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#dcdcd5] dark:border-[#2c322e]">
        <div>
          <h1 class="text-xl lg:text-2xl font-bold text-[#161917] dark:text-[#eceee9]">
            Course rooms &amp; schedules
          </h1>
          <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-1">
            Standard rooms assigned for courses in {{ crms.currentTerm() }}. Teachers can reserve an alternate room if their fixed room is offline.
          </p>
        </div>

        <!-- Secondary Actions (Outlined / Neutral) -->
        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            (click)="filtersOpen.set(!filtersOpen())"
            class="px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] dark:hover:bg-[#222624] inline-flex items-center gap-1.5 transition-colors"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">filter_list</mat-icon>
            <span>Filters</span>
            @if (daysFilter() !== 'ALL' || courseSearch()) {
              <span class="w-2 h-2 rounded-full bg-amber-600"></span>
            }
          </button>

          @if (crms.activeRole() === 'Admin') {
            <button
              type="button"
              (click)="assignDrawerOpen.set(true)"
              class="px-3 py-1.5 text-xs font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] dark:hover:bg-[#222624] inline-flex items-center gap-1.5 transition-colors"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">add</mat-icon>
              <span>Assign room</span>
            </button>
          }
        </div>
      </div>

      <!-- Disrupted Fixed Course Rooms Banner (One line with View rooms link) -->
      @if (crms.disruptedTermCourses().length > 0) {
        <div class="px-4 py-3 rounded-[8px] bg-amber-50/90 dark:bg-amber-950/40 border border-amber-700/40 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2 text-amber-950 dark:text-amber-200">
            <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-700 dark:text-amber-400 shrink-0">warning_amber</mat-icon>
            <span class="font-medium">
              {{ crms.disruptedTermCourses().length }} course rooms are offline for maintenance
            </span>
          </div>
          <button
            type="button"
            (click)="crms.activeModule.set('digital-twin')"
            class="text-xs font-semibold text-amber-900 dark:text-amber-300 hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <span>View rooms</span>
            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">arrow_forward</mat-icon>
          </button>
        </div>
      }

      <!-- Collapsible Advanced Filters Drawer / Bar -->
      @if (filtersOpen()) {
        <div class="p-3.5 rounded-[10px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex flex-wrap items-center gap-3 flex-1">
            <div class="relative w-full sm:w-64">
              <label for="course-table-search" class="sr-only">Search courses</label>
              <input
                id="course-table-search"
                type="search"
                placeholder="Search course, teacher, or room..."
                [value]="courseSearch()"
                (input)="onCourseSearch($event)"
                class="w-full px-3 py-1.5 text-xs rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
              />
            </div>

            <div class="flex items-center gap-2">
              <label for="course-days-filter" class="text-[#565b56] dark:text-[#9ca39e]">Schedule:</label>
              <select
                id="course-days-filter"
                [value]="daysFilter()"
                (change)="onDaysFilterChange($event)"
                class="px-2.5 py-1.5 text-xs rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
              >
                <option value="ALL">All days</option>
                <option value="MWF">MWF</option>
                <option value="TTh">TTh</option>
                <option value="Sat">Sat</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-2">
            @if (daysFilter() !== 'ALL' || courseSearch()) {
              <button
                type="button"
                (click)="resetCourseFilters()"
                class="px-2.5 py-1 text-xs text-[#565b56] dark:text-[#9ca39e] hover:text-[#161917] dark:hover:text-white underline"
              >
                Clear filters
              </button>
            }
            <button
              type="button"
              (click)="filtersOpen.set(false)"
              class="px-2.5 py-1 rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] text-xs hover:bg-[#efefeb]"
            >
              Done
            </button>
          </div>
        </div>
      }

      <!-- TEACHER ALTERNATE ROOM RELOCATION WORKFLOW PANEL -->
      @if (activeRelocationCourse(); as relCourse) {
        <section
          aria-label="Teacher alternate room reservation"
          class="bg-[#e7f3ec]/70 dark:bg-[#132a1c]/60 border border-[#14532d]/40 dark:border-[#4ade80]/40 rounded-[10px] p-4 space-y-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#14532d]/20 dark:border-[#4ade80]/20">
            <div>
              <p class="text-xs font-mono font-semibold text-[#14532d] dark:text-[#4ade80]">
                RESERVE ALTERNATE ROOM · {{ relCourse.courseCode }} ({{ relCourse.courseTitle }})
              </p>
              <h2 class="text-base font-bold text-[#161917] dark:text-[#eceee9] mt-0.5">
                Fixed room {{ getRoomCode(relCourse.constantRoomId) }} is unavailable: select replacement room
              </h2>
              <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                Instructor: {{ relCourse.instructorName }} · {{ relCourse.enrolledStudents }} students · <span class="font-mono">{{ relCourse.scheduleDays }} {{ relCourse.startTime }}-{{ relCourse.endTime }}</span>
              </p>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                (click)="autoAssignRelocation(relCourse)"
                class="px-3 py-1.5 text-xs font-semibold border border-[#14532d] text-[#14532d] dark:text-[#4ade80] dark:border-[#4ade80] hover:bg-[#e7f3ec] rounded-[6px] transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">bolt</mat-icon>
                <span>Auto-pick best room</span>
              </button>
              <button
                type="button"
                (click)="crms.relocationCourseId.set(null)"
                class="px-2.5 py-1.5 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9]"
              >
                Close
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label for="rel-date" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                Class session date <span class="text-red-700 dark:text-red-400">*</span>
              </label>
              <input
                id="rel-date"
                type="date"
                [value]="relocationDate()"
                (change)="onRelocationDateChange($event)"
                class="w-full px-3 py-2 rounded-[6px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9] font-mono text-xs"
              />
            </div>
            <div>
              <label for="rel-reason" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                Note for enrolled students
              </label>
              <input
                id="rel-reason"
                type="text"
                [value]="relocationReason()"
                (input)="onRelocationReasonChange($event)"
                class="w-full px-3 py-2 rounded-[6px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9] text-xs"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            @for (rec of relocationRecommendations().slice(0, 3); track rec.room.id) {
              <div
                class="p-3 rounded-[6px] bg-[#fbfbfa] dark:bg-[#181b19] border flex flex-col justify-between gap-3"
                [class.border-[#dcdcd5]]="!rec.hasConflict"
                [class.dark:border-[#2c322e]]="!rec.hasConflict"
                [class.border-red-700/40]="rec.hasConflict"
                [class.opacity-60]="rec.hasConflict"
              >
                <div class="space-y-1 text-xs">
                  <div class="flex items-center justify-between font-mono">
                    <span class="font-bold text-[#161917] dark:text-[#eceee9]">
                      {{ rec.room.code }}
                    </span>
                    <span
                      class="font-semibold flex items-center gap-1"
                      [class.text-[#14532d]]="!rec.hasConflict && !crms.darkMode()"
                      [class.dark:text-[#4ade80]]="!rec.hasConflict && crms.darkMode()"
                      [class.text-red-700]="rec.hasConflict"
                    >
                      {{ rec.hasConflict ? 'Conflict' : rec.fitScore + '% fit' }}
                    </span>
                  </div>
                  <p class="font-medium text-[#161917] dark:text-[#eceee9]">
                    {{ rec.room.name }} ({{ rec.room.capacity }} seats)
                  </p>
                  <p class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                    {{ rec.hasConflict ? rec.conflictDetails : rec.reasons.join(' · ') }}
                  </p>
                </div>

                <button
                  type="button"
                  [disabled]="rec.hasConflict"
                  (click)="confirmRelocationToRoom(relCourse, rec.room.id, false)"
                  class="w-full py-1.5 px-3 text-xs font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] disabled:opacity-40"
                >
                  {{ rec.hasConflict ? 'Unavailable' : 'Select ' + rec.room.code }}
                </button>
              </div>
            }
          </div>
        </section>
      }

      <!-- Master Course Schedule: Clean 4-Column Table (No Horizontal Scrollbar) -->
      <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] overflow-hidden">
        @if (sortedAndFilteredCourses().length === 0) {
          <!-- Friendly Empty State -->
          <div class="p-10 text-center space-y-2">
            <p class="text-sm font-semibold text-[#161917] dark:text-[#eceee9]">
              No courses match your active filter
            </p>
            <p class="text-xs text-[#565b56] dark:text-[#9ca39e]">
              Try searching with a different keyword or resetting your schedule filter.
            </p>
            <button
              type="button"
              (click)="resetCourseFilters()"
              class="mt-2 px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9]"
            >
              Reset filters
            </button>
          </div>
        } @else {
          <!-- Desktop 4-Column Table -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="bg-[#f6f6f3] dark:bg-[#121413] border-b border-[#dcdcd5] dark:border-[#2c322e] text-[#565b56] dark:text-[#9ca39e]">
                <tr>
                  <!-- Column 1: Course (Item) -->
                  <th class="py-3 px-4 font-semibold">Course &amp; class</th>
                  <!-- Column 2: Fixed Room -->
                  <th class="py-3 px-4 font-semibold">Fixed room</th>
                  <!-- Column 3: Room Status -->
                  <th class="py-3 px-4 font-semibold">Room status</th>
                  <!-- Column 4: Action -->
                  <th class="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
                @for (course of pagedCourses(); track course.id) {
                  @let constRoom = crms.getRoomById(course.constantRoomId);
                  @let relRoom = crms.getRoomById(course.relocatedRoomId);
                  @let isRoomDown = constRoom && constRoom.availabilityState !== 'Operational';
                  <tr
                    (click)="selectedCourseDetails.set(course)"
                    class="h-14 hover:bg-[#efefeb]/60 dark:hover:bg-[#202422]/60 transition-colors cursor-pointer"
                  >
                    <!-- Col 1: Course info with monospace code and schedule -->
                    <td class="py-2.5 px-4 align-middle">
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold text-[#161917] dark:text-[#eceee9] shrink-0">{{ course.courseCode }}</span>
                        <span class="font-medium text-[#161917] dark:text-[#eceee9] line-clamp-2 max-w-[240px]" [title]="course.courseTitle">{{ course.courseTitle }}</span>
                      </div>
                      <div class="text-[11px] text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                        {{ course.instructorName }} · <span>{{ crms.formatCourseSchedule12Hour(course.scheduleDays, course.startTime, course.endTime) }}</span> · <span class="font-mono tabular-nums">{{ course.enrolledStudents }}</span> students
                      </div>
                    </td>

                    <!-- Col 2: Fixed Room (Monospace code, sans room name) -->
                    <td class="py-2.5 px-4 align-middle">
                      <div class="font-mono font-bold text-[#161917] dark:text-[#eceee9]">
                        {{ constRoom?.code }}
                      </div>
                      <div class="font-sans text-[11px] text-[#565b56] dark:text-[#9ca39e] line-clamp-2 max-w-[200px]" [title]="constRoom?.name">
                        {{ constRoom?.name }}
                      </div>
                    </td>

                    <!-- Col 3: Room Status with Icon + Neutral Text (Color on icon only) -->
                    <td class="py-2.5 px-4 align-middle whitespace-nowrap">
                      @if (course.relocatedRoomId && relRoom) {
                        <span class="inline-flex items-center gap-1.5 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                          <mat-icon class="!w-4 !h-4 !text-[16px] text-[#B45309]">swap_horiz</mat-icon>
                          <span>Relocated to <span class="font-mono font-medium">{{ relRoom.code }}</span></span>
                        </span>
                      } @else if (isRoomDown) {
                        <span class="inline-flex items-center gap-1.5 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                          <mat-icon class="!w-4 !h-4 !text-[16px] text-[#B91C1C]">build_circle</mat-icon>
                          <span>Room offline</span>
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1.5 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                          <mat-icon class="!w-4 !h-4 !text-[16px] text-[#1B7F4B]">check_circle</mat-icon>
                          <span>Room ready</span>
                        </span>
                      }
                    </td>

                    <!-- Col 4: Action (Compact Neutral Button, no duplicate details button) -->
                    <td class="py-2.5 px-4 align-middle text-right whitespace-nowrap" (click)="$event.stopPropagation()">
                      <div class="inline-flex items-center justify-end gap-1.5">
                        @if (isRoomDown && !course.relocatedRoomId) {
                          <button
                            type="button"
                            (click)="openRelocationModal(course)"
                            class="h-[30px] px-2.5 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] dark:hover:bg-[#222624] inline-flex items-center gap-1"
                          >
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">swap_horiz</mat-icon>
                            <span>Find alternate room</span>
                          </button>
                        } @else if (course.relocatedRoomId) {
                          <button
                            type="button"
                            (click)="openRelocationModal(course)"
                            class="h-[30px] px-2.5 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center gap-1"
                          >
                            <span>Change</span>
                          </button>
                          <button
                            type="button"
                            (click)="crms.clearCourseRelocation(course.id)"
                            class="h-[30px] px-2 text-xs font-medium text-[#565b56] dark:text-[#9ca39e] hover:underline"
                          >
                            Restore
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
            @for (course of pagedCourses(); track course.id) {
              @let constRoom = crms.getRoomById(course.constantRoomId);
              @let relRoom = crms.getRoomById(course.relocatedRoomId);
              @let isRoomDown = constRoom && constRoom.availabilityState !== 'Operational';
              <div
                role="button"
                tabindex="0"
                (click)="selectedCourseDetails.set(course)"
                (keydown.enter)="selectedCourseDetails.set(course)"
                (keydown.space)="selectedCourseDetails.set(course)"
                class="p-3.5 space-y-3 cursor-pointer hover:bg-[#efefeb]/40 dark:hover:bg-[#202422]/40 transition-colors"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <span class="font-mono font-bold text-xs text-[#14532d] dark:text-[#4ade80]">{{ course.courseCode }}</span>
                    <h3 class="text-sm font-semibold text-[#161917] dark:text-[#eceee9] leading-snug line-clamp-2" [title]="course.courseTitle">{{ course.courseTitle }}</h3>
                    <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                      {{ course.instructorName }} · <span class="font-mono tabular-nums">{{ course.enrolledStudents }}</span> students
                    </p>
                  </div>
                  <!-- Room badge -->
                  <div class="shrink-0 text-right">
                    <span class="inline-block px-2 py-0.5 rounded-[4px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono font-semibold text-xs text-[#161917] dark:text-[#eceee9]">
                      {{ constRoom?.code }}
                    </span>
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-[#dcdcd5]/60 dark:border-[#2c322e]/60">
                  <div class="text-[#565b56] dark:text-[#9ca39e]">
                    {{ crms.formatCourseSchedule12Hour(course.scheduleDays, course.startTime, course.endTime) }}
                  </div>

                  <!-- Status with icon + neutral text -->
                  <div>
                    @if (course.relocatedRoomId && relRoom) {
                      <span class="inline-flex items-center gap-1.5 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-[#B45309]">swap_horiz</mat-icon>
                        <span>Relocated to <span class="font-mono font-medium">{{ relRoom.code }}</span></span>
                      </span>
                    } @else if (isRoomDown) {
                      <span class="inline-flex items-center gap-1.5 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-[#B91C1C]">build_circle</mat-icon>
                        <span>Room offline</span>
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-[#1B7F4B]">check_circle</mat-icon>
                        <span>Room ready</span>
                      </span>
                    }
                  </div>
                </div>

                <!-- Action Button: At least 44px min height for touch -->
                @if (isRoomDown || course.relocatedRoomId) {
                  <div class="pt-1">
                    @if (isRoomDown && !course.relocatedRoomId) {
                      <button
                        type="button"
                        (click)="openRelocationModal(course); $event.stopPropagation()"
                        class="w-full min-h-[44px] px-3 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] dark:hover:bg-[#222624] inline-flex items-center justify-center gap-1.5"
                      >
                        <mat-icon class="!w-4 !h-4 !text-[16px]">swap_horiz</mat-icon>
                        <span>Find alternate room</span>
                      </button>
                    } @else if (course.relocatedRoomId) {
                      <div class="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          (click)="openRelocationModal(course); $event.stopPropagation()"
                          class="min-h-[44px] px-3 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center justify-center gap-1"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          (click)="crms.clearCourseRelocation(course.id); $event.stopPropagation()"
                          class="min-h-[44px] px-3 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb] text-[#565b56] dark:text-[#9ca39e] inline-flex items-center justify-center"
                        >
                          Restore
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Compact Clean Pagination Footer (Only when > 10 rows) -->
          @if (sortedAndFilteredCourses().length > 10) {
            <div class="p-3 border-t border-[#dcdcd5] dark:border-[#2c322e] flex items-center justify-end text-xs">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  [disabled]="currentPage() <= 1"
                  (click)="currentPage.set(currentPage() - 1)"
                  class="px-2.5 py-1 rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] disabled:opacity-40"
                >
                  Previous
                </button>
                <span class="font-mono tabular-nums text-[#565b56] dark:text-[#9ca39e]">
                  Page {{ currentPage() }} / {{ totalPages() }}
                </span>
                <button
                  type="button"
                  [disabled]="currentPage() >= totalPages()"
                  (click)="currentPage.set(currentPage() + 1)"
                  class="px-2.5 py-1 rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          }
        }
      </div>

      <!-- ============================================================== -->
      <!-- SLIDE-OVER RIGHT DRAWER: ASSIGN FIXED ROOM (Task-First Layout) -->
      <!-- ============================================================== -->
      @if (assignDrawerOpen()) {
        <div class="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="assign-drawer-title">
          <!-- Backdrop -->
          <button
            type="button"
            aria-label="Close drawer"
            (click)="assignDrawerOpen.set(false)"
            class="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity w-full h-full cursor-default"
          ></button>

          <div class="fixed inset-y-0 right-0 pl-0 sm:pl-10 max-w-full flex w-full sm:w-auto">
            <div class="w-full sm:w-screen sm:max-w-md bg-[#fbfbfa] dark:bg-[#181b19] border-l border-[#dcdcd5] dark:border-[#2c322e] shadow-xl p-4 sm:p-5 flex flex-col justify-between overflow-y-auto min-h-full">
              <div class="space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                  <div>
                    <h2 id="assign-drawer-title" class="text-base font-bold text-[#161917] dark:text-[#eceee9]">
                      Assign fixed room for course
                    </h2>
                    <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                      Lock a standard campus room for a course in {{ crms.currentTerm() }}.
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="assignDrawerOpen.set(false)"
                    aria-label="Close drawer"
                    class="p-2 sm:p-1 rounded-[6px] hover:bg-[#efefeb] dark:hover:bg-[#222624] text-[#565b56] hover:text-[#161917]"
                  >
                    <mat-icon class="!w-5 !h-5 !text-[20px]">close</mat-icon>
                  </button>
                </div>

                @if (courseFormError()) {
                  <div role="alert" class="p-3 rounded-[6px] bg-red-50 dark:bg-red-950/50 border border-red-700/40 text-xs text-red-900 dark:text-red-200 flex items-start gap-2">
                    <mat-icon class="!w-4 !h-4 !text-[16px] shrink-0 mt-0.5">error_outline</mat-icon>
                    <span>{{ courseFormError() }}</span>
                  </div>
                }

                <!-- Live Conflict Warning -->
                @if (liveTermCourseConflict(); as conflictMsg) {
                  <div role="status" class="p-3 rounded-[6px] bg-amber-50 dark:bg-amber-950/50 border border-amber-700/40 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2">
                    <mat-icon class="!w-4 !h-4 !text-[16px] shrink-0 mt-0.5">warning_amber</mat-icon>
                    <span>{{ conflictMsg }}</span>
                  </div>
                }

                <form [formGroup]="termCourseForm" (ngSubmit)="submitNewTermCourse()" class="space-y-3.5 text-xs">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label for="tc-code" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                        Course code <span class="text-red-700 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="tc-code"
                        type="text"
                        formControlName="courseCode"
                        class="w-full px-3 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                      />
                    </div>
                    <div>
                      <label for="tc-size" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                        Students <span class="text-red-700 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="tc-size"
                        type="number"
                        formControlName="enrolledStudents"
                        class="w-full px-3 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono tabular-nums text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="tc-title" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Course title <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="tc-title"
                      type="text"
                      formControlName="courseTitle"
                      class="w-full px-3 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>

                  <div>
                    <label for="tc-inst" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Instructor <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="tc-inst"
                      type="text"
                      formControlName="instructorName"
                      class="w-full px-3 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label for="tc-days" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                        Days <span class="text-red-700 dark:text-red-400">*</span>
                      </label>
                      <select
                        id="tc-days"
                        formControlName="scheduleDays"
                        class="w-full px-2.5 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                      >
                        <option value="MWF">MWF</option>
                        <option value="TTh">TTh</option>
                        <option value="Sat">Sat</option>
                      </select>
                    </div>
                    <div>
                      <label for="tc-start" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                        Start <span class="text-red-700 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="tc-start"
                        type="time"
                        formControlName="startTime"
                        class="w-full min-w-[120px] px-2 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                      />
                    </div>
                    <div>
                      <label for="tc-end" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                        End <span class="text-red-700 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="tc-end"
                        type="time"
                        formControlName="endTime"
                        class="w-full min-w-[120px] px-2 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="tc-room" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Fixed room <span class="text-red-700 dark:text-red-400">*</span>
                    </label>
                    <select
                      id="tc-room"
                      formControlName="constantRoomId"
                      class="w-full px-3 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                    >
                      @for (rm of crms.rooms(); track rm.id) {
                        <option [value]="rm.id">
                          {{ rm.code }} · {{ rm.name }} ({{ rm.capacity }} seats)
                        </option>
                      }
                    </select>
                  </div>

                  <div class="pt-3 border-t border-[#dcdcd5] dark:border-[#2c322e] flex items-center justify-end gap-2 sticky bottom-0 bg-[#fbfbfa] dark:bg-[#181b19] py-2">
                    <button
                      type="button"
                      (click)="assignDrawerOpen.set(false)"
                      class="min-h-[44px] px-3.5 py-2 rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      [disabled]="!!liveTermCourseConflict()"
                      class="min-h-[44px] px-4 py-2 font-semibold rounded-[6px] bg-[#14532d] hover:bg-[#166534] disabled:opacity-40 text-white transition-colors"
                    >
                      Save fixed room
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Course Details Modal / Drawer when a row is clicked -->
      @if (selectedCourseDetails(); as course) {
        @let r = crms.getRoomById(course.constantRoomId);
        @let rel = crms.getRoomById(course.relocatedRoomId);
        <div class="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="details-drawer-title">
          <button
            type="button"
            aria-label="Close details"
            (click)="selectedCourseDetails.set(null)"
            class="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity w-full h-full cursor-default"
          ></button>

          <div class="fixed inset-y-0 right-0 pl-0 sm:pl-10 max-w-full flex w-full sm:w-auto">
            <div class="w-full sm:w-screen sm:max-w-md bg-[#fbfbfa] dark:bg-[#181b19] border-l border-[#dcdcd5] dark:border-[#2c322e] shadow-xl p-4 sm:p-5 flex flex-col justify-between overflow-y-auto min-h-full">
              <div class="space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                  <div>
                    <span class="font-mono text-xs font-bold text-[#14532d] dark:text-[#4ade80]">
                      {{ course.courseCode }}
                    </span>
                    <h2 id="details-drawer-title" class="text-base font-bold text-[#161917] dark:text-[#eceee9]">
                      {{ course.courseTitle }}
                    </h2>
                  </div>
                  <button
                    type="button"
                    (click)="selectedCourseDetails.set(null)"
                    aria-label="Close details"
                    class="p-1 rounded-[6px] hover:bg-[#efefeb] dark:hover:bg-[#222624]"
                  >
                    <mat-icon class="!w-5 !h-5 !text-[20px]">close</mat-icon>
                  </button>
                </div>

                <div class="space-y-3 text-xs">
                  <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] space-y-1">
                    <span class="text-[#565b56] dark:text-[#9ca39e]">Assigned instructor</span>
                    <div class="font-semibold text-[#161917] dark:text-[#eceee9]">{{ course.instructorName }}</div>
                    <div class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">{{ course.department }}</div>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] space-y-1">
                      <span class="text-[#565b56] dark:text-[#9ca39e]">Weekly schedule</span>
                      <div class="font-mono font-bold text-[#161917] dark:text-[#eceee9]">
                        {{ course.scheduleDays }}
                      </div>
                      <div class="font-mono text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                        {{ course.startTime }} - {{ course.endTime }}
                      </div>
                    </div>

                    <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] space-y-1">
                      <span class="text-[#565b56] dark:text-[#9ca39e]">Class size</span>
                      <div class="font-mono font-bold text-[#161917] dark:text-[#eceee9]">
                        {{ course.enrolledStudents }}
                      </div>
                      <div class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">Enrolled students</div>
                    </div>
                  </div>

                  <div class="p-3 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] space-y-1.5">
                    <span class="text-[#565b56] dark:text-[#9ca39e]">Fixed room status</span>
                    <div class="flex items-center justify-between font-mono">
                      <span class="font-bold text-[#161917] dark:text-[#eceee9]">{{ r?.code }}</span>
                      <span class="text-[11px] text-[#565b56] dark:text-[#9ca39e]">{{ r?.capacity }} seats</span>
                    </div>
                    <div class="text-[#565b56] dark:text-[#9ca39e]">{{ r?.name }}</div>

                    @if (r?.availabilityState !== 'Operational') {
                      <div class="mt-2 p-2 rounded-[4px] bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 flex items-center justify-between">
                        <span class="font-medium">Room under maintenance</span>
                        <button
                          type="button"
                          (click)="selectedCourseDetails.set(null); openRelocationModal(course)"
                          class="px-2 py-1 text-xs font-semibold bg-red-700 text-white rounded-[4px]"
                        >
                          Reserve alternate
                        </button>
                      </div>
                    } @else if (course.relocatedRoomId && rel) {
                      <div class="mt-2 p-2 rounded-[4px] bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
                        <span>Relocated to <span class="font-mono font-bold">{{ rel.code }}</span></span>
                      </div>
                    }
                  </div>
                </div>

                <div class="pt-3 border-t border-[#dcdcd5] dark:border-[#2c322e]">
                  <button
                    type="button"
                    (click)="selectedCourseDetails.set(null)"
                    class="w-full py-2 rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] hover:bg-[#efefeb] text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class RoomsCoursesView {
  readonly crms = inject(CrmsService);
  private readonly fb = inject(FormBuilder);

  readonly filtersOpen = signal<boolean>(false);
  readonly assignDrawerOpen = signal<boolean>(false);
  readonly selectedCourseDetails = signal<TermCourseAssignment | null>(null);

  readonly courseSearch = signal<string>('');
  readonly daysFilter = signal<string>('ALL');
  readonly sortField = signal<'courseCode' | 'enrolledStudents'>('courseCode');
  readonly sortAsc = signal<boolean>(true);
  readonly currentPage = signal<number>(1);
  readonly pageSize = 6;

  readonly courseFormError = signal<string>('');

  readonly relocationDate = signal<string>('2026-11-04');
  readonly relocationReason = signal<string>(
    'Fixed room is under maintenance; class moved to alternate room'
  );

  readonly termCourseDraft = signal({
    scheduleDays: 'TTh' as 'MWF' | 'TTh' | 'Sat',
    startTime: '10:30',
    endTime: '12:00',
    constantRoomId: 'RM-102',
  });

  readonly termCourseForm = this.fb.nonNullable.group({
    courseCode: ['IT-208', Validators.required],
    courseTitle: ['Enterprise Network Administration', Validators.required],
    department: ['College of Computing & Engineering', Validators.required],
    instructorName: ['Engr. Arnel Panganiban', Validators.required],
    enrolledStudents: [35, [Validators.required, Validators.min(5)]],
    scheduleDays: ['TTh' as 'MWF' | 'TTh' | 'Sat', Validators.required],
    startTime: ['10:30', Validators.required],
    endTime: ['12:00', Validators.required],
    constantRoomId: ['RM-102', Validators.required],
  });

  constructor() {
    this.termCourseForm.valueChanges.subscribe((val) => {
      this.termCourseDraft.set({
        scheduleDays: (val.scheduleDays as 'MWF' | 'TTh' | 'Sat') || 'TTh',
        startTime: val.startTime || '10:30',
        endTime: val.endTime || '12:00',
        constantRoomId: val.constantRoomId || 'RM-102',
      });
    });
  }

  readonly liveTermCourseConflict = computed(() => {
    const draft = this.termCourseDraft();
    if (draft.startTime >= draft.endTime) {
      return 'End time must be later than start time.';
    }
    const conflict = this.crms.termCourses().find(
      (other) =>
        other.constantRoomId === draft.constantRoomId &&
        other.scheduleDays === draft.scheduleDays &&
        this.crms.timesOverlap(draft.startTime, draft.endTime, other.startTime, other.endTime)
    );
    if (conflict) {
      const rm = this.crms.getRoomById(draft.constantRoomId);
      return `Double-booking conflict: ${rm?.code || draft.constantRoomId} is already assigned to ${conflict.courseCode} on ${conflict.scheduleDays} ${conflict.startTime}-${conflict.endTime}.`;
    }
    return null;
  });

  readonly sortedAndFilteredCourses = computed(() => {
    const q = this.courseSearch().trim().toLowerCase();
    const dFilter = this.daysFilter();
    const field = this.sortField();
    const asc = this.sortAsc();

    const filtered = this.crms.termCourses().filter((c) => {
      if (dFilter !== 'ALL' && c.scheduleDays !== dFilter) return false;
      if (!q) return true;
      const rm = this.crms.getRoomById(c.constantRoomId);
      return (
        c.courseCode.toLowerCase().includes(q) ||
        c.courseTitle.toLowerCase().includes(q) ||
        c.instructorName.toLowerCase().includes(q) ||
        (rm && rm.code.toLowerCase().includes(q))
      );
    });

    return [...filtered].sort((a, b) => {
      if (field === 'enrolledStudents') {
        return asc ? a.enrolledStudents - b.enrolledStudents : b.enrolledStudents - a.enrolledStudents;
      }
      return asc
        ? a.courseCode.localeCompare(b.courseCode)
        : b.courseCode.localeCompare(a.courseCode);
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.sortedAndFilteredCourses().length / this.pageSize))
  );

  readonly pagedCourses = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.sortedAndFilteredCourses().slice(start, start + this.pageSize);
  });

  readonly activeRelocationCourse = computed(() => {
    const id = this.crms.relocationCourseId();
    if (!id) return null;
    return this.crms.termCourses().find((c) => c.id === id) || null;
  });

  readonly relocationRecommendations = computed(() => {
    const course = this.activeRelocationCourse();
    if (!course) return [];
    return this.crms.getSmartRecommendations({
      attendees: course.enrolledStudents,
      date: this.relocationDate(),
      startTime: course.startTime,
      endTime: course.endTime,
      requiredEquipment: course.requiredEquipment,
      ignoreCourseId: course.id,
      excludeRoomId: course.constantRoomId,
    });
  });

  getRoomCode(roomId: string): string {
    return this.crms.getRoomById(roomId)?.code || roomId;
  }

  onCourseSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.courseSearch.set(input.value);
    this.currentPage.set(1);
  }

  onDaysFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.daysFilter.set(select.value);
    this.currentPage.set(1);
  }

  resetCourseFilters(): void {
    this.courseSearch.set('');
    this.daysFilter.set('ALL');
    this.currentPage.set(1);
  }

  openRelocationModal(course: TermCourseAssignment): void {
    this.crms.relocationCourseId.set(course.id);
  }

  openEditRoomDrawer(course: TermCourseAssignment): void {
    this.termCourseForm.patchValue({
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      instructorName: course.instructorName,
      department: course.department,
      enrolledStudents: course.enrolledStudents,
      scheduleDays: course.scheduleDays,
      startTime: course.startTime,
      endTime: course.endTime,
      constantRoomId: course.constantRoomId,
    });
    this.assignDrawerOpen.set(true);
  }

  onRelocationDateChange(event: Event): void {
    this.relocationDate.set((event.target as HTMLInputElement).value);
  }

  onRelocationReasonChange(event: Event): void {
    this.relocationReason.set((event.target as HTMLInputElement).value);
  }

  confirmRelocationToRoom(
    course: TermCourseAssignment,
    targetRoomId: string,
    autoAssigned: boolean
  ): void {
    const res = this.crms.relocateCourseSession(
      course.id,
      targetRoomId,
      this.relocationDate(),
      this.relocationReason(),
      autoAssigned
    );
    if (!res.ok) {
      this.crms.pushToast('Relocation conflict', res.message, 'error');
    }
  }

  autoAssignRelocation(course: TermCourseAssignment): void {
    const best = this.relocationRecommendations().find((r) => !r.hasConflict);
    if (!best) {
      this.crms.pushToast(
        'No conflict-free room available',
        'Select a different session date to find an open room.',
        'error'
      );
      return;
    }
    this.confirmRelocationToRoom(course, best.room.id, true);
  }

  submitNewTermCourse(): void {
    this.courseFormError.set('');
    this.termCourseForm.markAllAsTouched();
    if (this.termCourseForm.invalid) {
      this.courseFormError.set('Complete all required course fields before submitting.');
      return;
    }
    const raw = this.termCourseForm.getRawValue();
    const res = this.crms.addTermCourseAssignment({
      ...raw,
      requiredEquipment: ['4K Laser Projector', 'Interactive Smartboard'],
    });
    if (!res.ok) {
      this.courseFormError.set(res.message);
      this.crms.pushToast('Fixed room conflict', res.message, 'error');
    } else {
      this.assignDrawerOpen.set(false);
      this.termCourseForm.patchValue({
        courseCode: 'CS-' + Math.floor(200 + Math.random() * 299),
        courseTitle: '',
      });
      this.crms.pushToast('Room assigned', `Fixed room locked for ${raw.courseCode}.`, 'success');
    }
  }
}
