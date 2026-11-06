import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CrmsService } from '../services/crms';
import { BuildingName, EmergencyState, FacilityRoom } from '../models/crms.models';

@Component({
  selector: 'app-digital-twin-view',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      @if (!embedded()) {
        <!-- Standalone Page Header -->
        <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-4 border-b border-[#dcdcd5] dark:border-[#2c322e]">
          <div>
            <p class="text-xs font-mono text-[#656d68] dark:text-[#88928c]">
              BIÑAN CAMPUS FACILITIES · 2D ARCHITECTURAL TWIN · LIVE IOT TELEMETRY
            </p>
            <h1 class="text-xl lg:text-2xl font-bold text-[#161917] dark:text-[#eceee9] mt-1">
              Campus floorplan and room telemetry
            </h1>
          </div>

          <!-- Emergency Drill & Safe Zone Controls (with confirmation dialog) -->
          <div class="flex flex-wrap items-center gap-2">
            @if (!crms.emergency().active) {
              <button
                type="button"
                (click)="confirmEmergency('Earthquake Drill / Seismic Alert')"
                class="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-[6px] border border-amber-700/40 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-1.5"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">warning_amber</mat-icon>
                <span>Start earthquake drill</span>
              </button>
              <button
                type="button"
                (click)="confirmEmergency('Facility Security Lockdown')"
                class="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-[6px] border border-red-700/40 bg-red-50/80 dark:bg-red-950/40 text-red-900 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1.5"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">lock</mat-icon>
                <span>Trigger security lockdown</span>
              </button>
            } @else {
              <button
                type="button"
                (click)="crms.resolveEmergency()"
                class="min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-[6px] bg-[#14532d] hover:bg-[#166534] text-[#fbfbfa] transition-colors flex items-center gap-1.5"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">check_circle</mat-icon>
                <span>Stand down alert and restore locks</span>
              </button>
            }
          </div>
        </div>
      }

      <!-- Floorplan Control Bar: Building, Floor Switcher, Zoom, and Accessible List Toggle -->
      <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
        <!-- Building Tabs -->
        <div role="tablist" aria-label="Campus buildings" class="flex flex-wrap items-center gap-1.5">
          @for (bldg of buildings; track bldg) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="crms.selectedBuilding() === bldg"
              (click)="selectBuilding(bldg)"
              class="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-[6px] border transition-colors flex items-center gap-1.5 whitespace-nowrap"
              [class]="
                crms.selectedBuilding() === bldg
                  ? 'bg-[#E8F3EC] text-[#1B7F4B] border-[#1B7F4B] dark:bg-[#1C2E24] dark:text-[#34D399] dark:border-[#34D399] font-semibold'
                  : 'bg-white dark:bg-[#19221D] text-[#4B5A52] dark:text-[#A3B3A9] border-[#DDE5E0] dark:border-[#29382F] hover:bg-[#F7F9F8] dark:hover:bg-[#1C2E24]'
              "
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">domain</mat-icon>
              <span>{{ bldg }}</span>
            </button>
          }
        </div>

        <!-- Floor Filter, Zoom & Accessible Text/List Toggle -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <!-- Floor Switcher -->
          <div class="inline-flex items-center rounded-[6px] border border-[#DDE5E0] dark:border-[#29382F] bg-white dark:bg-[#19221D] p-0.5">
            <button
              type="button"
              (click)="crms.selectedFloor.set('all')"
              class="px-2.5 py-1 rounded-[4px] font-mono text-xs transition-colors"
              [class]="
                crms.selectedFloor() === 'all'
                  ? 'bg-[#E8F3EC] text-[#1B7F4B] dark:bg-[#1C2E24] dark:text-[#34D399] font-semibold'
                  : 'text-[#4B5A52] dark:text-[#A3B3A9]'
              "
            >
              All floors
            </button>
            <button
              type="button"
              (click)="crms.selectedFloor.set(1)"
              class="px-2.5 py-1 rounded-[4px] font-mono text-xs transition-colors"
              [class]="
                crms.selectedFloor() === 1
                  ? 'bg-[#E8F3EC] text-[#1B7F4B] dark:bg-[#1C2E24] dark:text-[#34D399] font-semibold'
                  : 'text-[#4B5A52] dark:text-[#A3B3A9]'
              "
            >
              1F
            </button>
            <button
              type="button"
              (click)="crms.selectedFloor.set(2)"
              class="px-2.5 py-1 rounded-[4px] font-mono text-xs transition-colors"
              [class]="
                crms.selectedFloor() === 2
                  ? 'bg-[#E8F3EC] text-[#1B7F4B] dark:bg-[#1C2E24] dark:text-[#34D399] font-semibold'
                  : 'text-[#4B5A52] dark:text-[#A3B3A9]'
              "
            >
              2F
            </button>
          </div>

          <!-- Zoom Controls (when in 2D map mode) -->
          @if (viewMode() === 'map') {
            <div class="inline-flex items-center rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] p-0.5 font-mono">
              <button
                type="button"
                (click)="stepZoom(-25)"
                [disabled]="zoomPercent() <= 100"
                aria-label="Zoom out floorplan"
                class="px-2 py-1 text-xs disabled:opacity-40 hover:bg-[#efefeb] dark:hover:bg-[#202422] rounded-[4px]"
              >
                -
              </button>
              <span class="px-2 text-[11px] tabular-nums text-[#4a504c] dark:text-[#b5bdb8]">
                {{ zoomPercent() }}%
              </span>
              <button
                type="button"
                (click)="stepZoom(25)"
                [disabled]="zoomPercent() >= 150"
                aria-label="Zoom in floorplan"
                class="px-2 py-1 text-xs disabled:opacity-40 hover:bg-[#efefeb] dark:hover:bg-[#202422] rounded-[4px]"
              >
                +
              </button>
            </div>
          }

          <!-- Accessible View Mode Toggle (2D Vector vs Text/Table List) -->
          <button
            type="button"
            (click)="viewMode.set(viewMode() === 'map' ? 'list' : 'map')"
            class="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] dark:hover:bg-[#202422] font-medium flex items-center gap-1.5"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">
              {{ viewMode() === 'map' ? 'table_rows' : 'map' }}
            </mat-icon>
            <span>{{ viewMode() === 'map' ? 'Switch to room list' : 'Switch to 2D floorplan' }}</span>
          </button>
        </div>
      </div>

      <!-- Main Split: Interactive Floorplan / Table (Left 8 cols) + Live Room Inspector (Right 4 cols on lg+, Bottom Sheet on <lg) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <!-- Left 8 Cols: 2D Vector Blueprint or Accessible Text Table -->
        <div class="lg:col-span-8 bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] p-3.5 sm:p-4 space-y-3">
          <!-- Map Header & Collapsible Pattern Legend -->
          <div class="space-y-2 pb-2 border-b border-[#dcdcd5] dark:border-[#2c322e] text-xs">
            <div class="flex items-center justify-between gap-2">
              <div class="font-medium text-[#161917] dark:text-[#eceee9]">
                {{ crms.selectedBuilding() }} ({{ buildingRooms().length }} rooms shown)
              </div>
              <button
                type="button"
                (click)="legendOpen.set(!legendOpen())"
                class="sm:hidden px-2.5 py-1 rounded-[4px] border border-[#dcdcd5] dark:border-[#2c322e] text-[11px] font-medium text-[#4a504c] dark:text-[#b5bdb8] inline-flex items-center gap-1"
              >
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">info_outline</mat-icon>
                <span>{{ legendOpen() ? 'Hide legend' : 'Legend' }}</span>
              </button>
            </div>

            <div
              class="flex-wrap items-center gap-3 sm:gap-4 text-[11px] text-[#4a504c] dark:text-[#b5bdb8]"
              [class.hidden]="!legendOpen()"
              [class.flex]="legendOpen()"
              [class.sm:flex]="true"
            >
              <span class="flex items-center gap-1.5">
                <span class="w-3.5 h-3.5 rounded-[3px] border border-[#14532d] bg-[#e7f3ec] dark:bg-[#132a1c] inline-block"></span>
                <span>Selected room</span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-3.5 h-3.5 rounded-[3px] border border-[#656d68] bg-[#fbfbfa] dark:bg-[#181b19] inline-block"></span>
                <span>Operational</span>
              </span>
              <span class="flex items-center gap-1.5">
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-amber-700 dark:text-amber-400">build</mat-icon>
                <span>Diagonal hatch: Under maintenance</span>
              </span>
              <span class="flex items-center gap-1.5">
                <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-[#14532d] dark:text-[#4ade80]">verified_user</mat-icon>
                <span>Dashed border: Muster safe zone</span>
              </span>
            </div>
          </div>

          @if (buildingRooms().length === 0) {
            <!-- Empty state when a floor filter has no rooms -->
            <div class="p-8 text-center space-y-2 border border-dashed border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px]">
              <p class="text-sm font-semibold text-[#161917] dark:text-[#eceee9]">
                No rooms on Floor {{ crms.selectedFloor() }} in {{ crms.selectedBuilding() }}
              </p>
              <p class="text-xs text-[#656d68] dark:text-[#88928c]">
                Show all floors to inspect every room in this building.
              </p>
              <button
                type="button"
                (click)="crms.selectedFloor.set('all')"
                class="mt-1 min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-[#14532d] text-[#fbfbfa] inline-flex items-center gap-1.5"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">layers</mat-icon>
                <span>Show all floors</span>
              </button>
            </div>
          } @else if (viewMode() === 'map') {
            <!-- Interactive 2D Vector Floorplan with Restrained Tint Scale & Hatch Patterns -->
            <div class="w-full overflow-x-auto bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] p-2 sm:p-3">
              <div [style.width.%]="zoomPercent()" class="min-w-[540px] sm:min-w-[600px] transition-all duration-150">
                <svg
                  viewBox="0 0 800 400"
                  preserveAspectRatio="xMidYMid meet"
                  class="w-full h-auto select-none"
                  role="group"
                  aria-label="Interactive 2D floorplan of Biñan Campus building"
                >
                  <defs>
                    <!-- Architectural Grid -->
                    <pattern id="archGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="0.6"
                        class="text-[#e2e2dc] dark:text-[#222624]"
                      />
                    </pattern>
                    <!-- Non-color-only Diagonal Hatch Pattern for Maintenance Rooms -->
                    <pattern
                      id="maintenanceHatch"
                      width="12"
                      height="12"
                      patternTransform="rotate(45 0 0)"
                      patternUnits="userSpaceOnUse"
                    >
                      <rect width="12" height="12" [attr.fill]="crms.darkMode() ? '#231c16' : '#f9f3eb'" />
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="12"
                        [attr.stroke]="crms.darkMode() ? '#9a5b13' : '#d97706'"
                        stroke-width="2"
                        stroke-opacity="0.35"
                      />
                    </pattern>
                  </defs>

                  <rect x="0" y="0" width="800" height="400" fill="url(#archGrid)" />

                  <!-- Building Perimeter Wall -->
                  <rect
                    x="16"
                    y="16"
                    width="768"
                    height="368"
                    rx="6"
                    fill="none"
                    [attr.stroke]="crms.darkMode() ? '#4a504c' : '#88928c'"
                    stroke-width="2"
                  />

                  <!-- Main Concourse Spine -->
                  <text
                    x="400"
                    y="198"
                    text-anchor="middle"
                    class="fill-[#656d68] dark:fill-[#88928c] text-[10px] font-mono tracking-widest"
                  >
                    CENTRAL CORRIDOR · RFID ACCESS GATES · EVACUATION MUSTER SPINE
                  </text>

                  @for (room of buildingRooms(); track room.id) {
                    @let isSelected = selectedRoom().id === room.id;
                    @let isOffline = room.availabilityState !== 'Operational';
                    <g
                      tabindex="0"
                      role="button"
                      [attr.aria-label]="room.code + ' ' + room.name + ', ' + room.availabilityState + ', occupancy ' + room.occupancyCount + ' of ' + room.capacity"
                      (click)="selectRoom(room.id)"
                      (keydown.enter)="selectRoom(room.id)"
                      (keydown.space)="$event.preventDefault(); selectRoom(room.id)"
                      class="cursor-pointer focus:outline-none"
                    >
                      <!-- Room Polygon -->
                      <rect
                        [attr.x]="room.svgX"
                        [attr.y]="room.svgY"
                        [attr.width]="room.svgW"
                        [attr.height]="room.svgH"
                        rx="6"
                        [attr.fill]="getRoomSvgFill(room, isSelected)"
                        [attr.stroke]="getRoomSvgStroke(room, isSelected)"
                        [attr.stroke-width]="isSelected ? '3' : '1.5'"
                      />

                      <!-- Dashed Inner Frame for Designated Safe Zones -->
                      @if (room.isSafeZone) {
                        <rect
                          [attr.x]="room.svgX + 5"
                          [attr.y]="room.svgY + 5"
                          [attr.width]="room.svgW - 10"
                          [attr.height]="room.svgH - 10"
                          rx="4"
                          fill="none"
                          [attr.stroke]="crms.darkMode() ? '#4ade80' : '#14532d'"
                          stroke-width="1"
                          stroke-dasharray="5,4"
                        />
                      }

                      <!-- Short Room Code & Floor -->
                      <text
                        [attr.x]="room.svgX + 14"
                        [attr.y]="room.svgY + 25"
                        class="font-mono font-bold text-[12px] fill-[#161917] dark:fill-[#eceee9]"
                      >
                        {{ room.code }} ({{ room.floor }}F)
                      </text>

                      <!-- Room Title (Hidden on tiny screens so codes stay clean) -->
                      <text
                        [attr.x]="room.svgX + 14"
                        [attr.y]="room.svgY + 44"
                        class="hidden sm:block text-[12px] font-medium fill-[#4a504c] dark:fill-[#b5bdb8]"
                      >
                        {{ room.name }}
                      </text>

                      <!-- Tabular IoT Telemetry -->
                      <text
                        [attr.x]="room.svgX + 14"
                        [attr.y]="room.svgY + 66"
                        class="font-mono text-[11px] fill-[#4a504c] dark:fill-[#b5bdb8]"
                      >
                        Occ: {{ room.occupancyCount }}/{{ room.capacity }} · {{ room.hvacTempC }}°C · {{ room.energyKw }} kW
                      </text>

                      <!-- Non-Color-Only Status Label -->
                      <text
                        [attr.x]="room.svgX + 14"
                        [attr.y]="room.svgY + 88"
                        class="font-mono text-[11px] font-semibold"
                        [attr.fill]="
                          isOffline
                            ? crms.darkMode()
                              ? '#fbbf24'
                              : '#b45309'
                            : crms.darkMode()
                              ? '#4ade80'
                              : '#14532d'
                        "
                      >
                        {{ isOffline ? '[MAINTENANCE - RELOCATE]' : '[OPERATIONAL]' }} · Door: {{ room.smartLockState }}
                      </text>

                      <!-- Assigned Term Courses -->
                      <text
                        [attr.x]="room.svgX + 14"
                        [attr.y]="room.svgY + 110"
                        class="font-mono text-[11px] fill-[#161917] dark:fill-[#eceee9]"
                      >
                        Courses: {{ getCoursesForRoomText(room.id) }}
                      </text>

                      @if (room.isSafeZone) {
                        <text
                          [attr.x]="room.svgX + 14"
                          [attr.y]="room.svgY + 130"
                          class="font-mono text-[10px] font-bold fill-[#14532d] dark:fill-[#4ade80]"
                        >
                          [SAFE ZONE MUSTER: {{ room.safeZoneCapacity }} CAP]
                        </text>
                      }
                    </g>
                  }
                </svg>
              </div>
            </div>
          } @else {
            <!-- Accessible Text/List Alternative View (Desktop Table + Mobile Stacked Cards) -->
            <div class="hidden md:block overflow-x-auto border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px]">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-[#dcdcd5] dark:border-[#2c322e] bg-[#f6f6f3] dark:bg-[#121413] text-[#4a504c] dark:text-[#b5bdb8]">
                    <th class="py-2.5 px-3 font-semibold">Room &amp; Floor</th>
                    <th class="py-2.5 px-3 font-semibold">Status</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Occupancy</th>
                    <th class="py-2.5 px-3 font-semibold text-right">IoT Reading</th>
                    <th class="py-2.5 px-3 font-semibold">Term Courses</th>
                    <th class="py-2.5 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
                  @for (rm of buildingRooms(); track rm.id) {
                    <tr
                      class="hover:bg-[#efefeb]/60 dark:hover:bg-[#202422]/60"
                      [class.bg-[#e7f3ec]]="selectedRoom().id === rm.id && !crms.darkMode()"
                      [class.dark:bg-[#132a1c]]="selectedRoom().id === rm.id && crms.darkMode()"
                    >
                      <td class="py-2.5 px-3">
                        <div class="font-mono font-semibold text-[#161917] dark:text-[#eceee9]">
                          {{ rm.code }} ({{ rm.floor }}F)
                        </div>
                        <div class="text-[#656d68] dark:text-[#88928c]">{{ rm.name }}</div>
                      </td>
                      <td class="py-2.5 px-3">
                        <span
                          class="inline-flex items-center gap-1 font-mono font-semibold"
                          [class.text-[#14532d]]="rm.availabilityState === 'Operational' && !crms.darkMode()"
                          [class.dark:text-[#4ade80]]="rm.availabilityState === 'Operational' && crms.darkMode()"
                          [class.text-amber-800]="rm.availabilityState !== 'Operational' && !crms.darkMode()"
                          [class.dark:text-amber-300]="rm.availabilityState !== 'Operational' && crms.darkMode()"
                        >
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                            {{ rm.availabilityState === 'Operational' ? 'check_circle' : 'build' }}
                          </mat-icon>
                          <span>{{ rm.availabilityState }}</span>
                        </span>
                      </td>
                      <td class="py-2.5 px-3 text-right font-mono tabular-nums">
                        {{ rm.occupancyCount }} / {{ rm.capacity }}
                      </td>
                      <td class="py-2.5 px-3 text-right font-mono tabular-nums">
                        {{ rm.hvacTempC }}°C · {{ rm.energyKw }} kW
                      </td>
                      <td class="py-2.5 px-3 font-mono">
                        {{ getCoursesForRoomText(rm.id) }}
                      </td>
                      <td class="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          (click)="selectRoom(rm.id)"
                          class="px-2.5 py-1 text-xs font-semibold rounded-[6px] bg-[#14532d] text-[#fbfbfa] hover:bg-[#166534]"
                        >
                          Inspect room
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Mobile Room List Cards (Default on Phones < 768px) -->
            <div class="block md:hidden divide-y divide-[#dcdcd5] dark:divide-[#2c322e] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px]">
              @for (rm of buildingRooms(); track rm.id) {
                <div
                  class="p-3.5 space-y-2.5 text-xs"
                  [class.bg-[#e7f3ec]/50]="selectedRoom().id === rm.id && !crms.darkMode()"
                  [class.dark:bg-[#132a1c]/50]="selectedRoom().id === rm.id && crms.darkMode()"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <span class="font-mono font-bold text-[#161917] dark:text-[#eceee9]">{{ rm.code }} · Floor {{ rm.floor }}</span>
                      <h3 class="text-sm font-semibold text-[#161917] dark:text-[#eceee9] mt-0.5">{{ rm.name }}</h3>
                    </div>
                    <span
                      class="inline-flex items-center gap-1 font-mono font-semibold shrink-0"
                      [class.text-[#14532d]]="rm.availabilityState === 'Operational' && !crms.darkMode()"
                      [class.dark:text-[#4ade80]]="rm.availabilityState === 'Operational' && crms.darkMode()"
                      [class.text-amber-800]="rm.availabilityState !== 'Operational' && !crms.darkMode()"
                      [class.dark:text-amber-300]="rm.availabilityState !== 'Operational' && crms.darkMode()"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                        {{ rm.availabilityState === 'Operational' ? 'check_circle' : 'build' }}
                      </mat-icon>
                      <span>{{ rm.availabilityState }}</span>
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                    <span>Seats: {{ rm.occupancyCount }}/{{ rm.capacity }}</span>
                    <span>{{ rm.hvacTempC }}°C · {{ rm.energyKw }} kW</span>
                    <span>Courses: {{ getCoursesForRoomText(rm.id) }}</span>
                  </div>

                  <button
                    type="button"
                    (click)="selectRoom(rm.id)"
                    class="w-full min-h-[44px] px-3 py-2 text-xs font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-white dark:bg-[#181b19] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] flex items-center justify-center gap-1.5"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px] text-[#14532d] dark:text-[#4ade80]">sensors</mat-icon>
                    <span>Inspect room &amp; controls</span>
                  </button>
                </div>
              }
            </div>
          }

          <!-- Inline Building Telemetry Footer (Unboxed, separated by vertical hairlines) -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-[#dcdcd5] dark:border-[#2c322e] text-xs">
            <div>
              <span class="text-[#656d68] dark:text-[#88928c]">Building spaces</span>
              <p class="text-sm font-bold font-mono tabular-nums text-[#161917] dark:text-[#eceee9] mt-0.5">
                {{ buildingRooms().length }} rooms
              </p>
            </div>
            <div class="sm:border-l sm:border-[#dcdcd5] dark:sm:border-[#2c322e] sm:pl-4">
              <span class="text-[#656d68] dark:text-[#88928c]">Live headcount</span>
              <p class="text-sm font-bold font-mono tabular-nums text-[#161917] dark:text-[#eceee9] mt-0.5">
                {{ buildingOccupancy() }} occupants
              </p>
            </div>
            <div class="sm:border-l sm:border-[#dcdcd5] dark:sm:border-[#2c322e] sm:pl-4">
              <span class="text-[#656d68] dark:text-[#88928c]">Building power load</span>
              <p class="text-sm font-bold font-mono tabular-nums text-[#161917] dark:text-[#eceee9] mt-0.5">
                {{ buildingEnergyKw() }} kW
              </p>
            </div>
            <div class="sm:border-l sm:border-[#dcdcd5] dark:sm:border-[#2c322e] sm:pl-4">
              <span class="text-[#656d68] dark:text-[#88928c]">Maintenance holds</span>
              <p class="text-sm font-bold font-mono tabular-nums text-[#161917] dark:text-[#eceee9] mt-0.5">
                {{ buildingUnavailableCount() }} room(s) offline
              </p>
            </div>
          </div>
        </div>

        <!-- Mobile Backdrop when Bottom Sheet Inspector is open (<lg) -->
        @if (mobileInspectorOpen()) {
          <button
            type="button"
            aria-label="Close room inspector"
            (click)="mobileInspectorOpen.set(false)"
            class="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden w-full h-full cursor-default"
          ></button>
        }

        <!-- Right 4 Cols on Desktop (lg+) / Slide-Up Bottom Sheet on Mobile & Tablet (<lg) -->
        <aside
          aria-label="Selected room inspector"
          class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] p-4 space-y-4 lg:col-span-4 lg:static lg:block lg:rounded-[10px] lg:max-h-none lg:z-auto"
          [class.fixed]="mobileInspectorOpen()"
          [class.inset-x-0]="mobileInspectorOpen()"
          [class.bottom-0]="mobileInspectorOpen()"
          [class.z-50]="mobileInspectorOpen()"
          [class.rounded-t-[16px]]="mobileInspectorOpen()"
          [class.max-h-[82dvh]]="mobileInspectorOpen()"
          [class.overflow-y-auto]="mobileInspectorOpen()"
          [class.shadow-2xl]="mobileInspectorOpen()"
          [class.hidden]="!mobileInspectorOpen()"
        >
          @if (selectedRoom(); as room) {
            <div class="pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
              <div class="flex items-center justify-between gap-2 text-xs font-mono text-[#656d68] dark:text-[#88928c]">
                <span>{{ room.code }} · Floor {{ room.floor }}</span>
                <div class="flex items-center gap-2">
                  <span class="tabular-nums">₱{{ room.hourlyCostPhp | number }}/hr</span>
                  <button
                    type="button"
                    (click)="mobileInspectorOpen.set(false)"
                    aria-label="Close room inspector"
                    class="lg:hidden p-1.5 rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb]"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">close</mat-icon>
                  </button>
                </div>
              </div>
              <h3 class="text-base font-bold text-[#161917] dark:text-[#eceee9] mt-1">
                {{ room.name }}
              </h3>
              <div class="flex items-center gap-2 mt-1.5 text-xs">
                <span
                  class="inline-flex items-center gap-1 font-mono font-semibold"
                  [class.text-[#14532d]]="room.availabilityState === 'Operational' && !crms.darkMode()"
                  [class.dark:text-[#4ade80]]="room.availabilityState === 'Operational' && crms.darkMode()"
                  [class.text-amber-800]="room.availabilityState !== 'Operational' && !crms.darkMode()"
                  [class.dark:text-amber-300]="room.availabilityState !== 'Operational' && crms.darkMode()"
                >
                  <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                    {{ room.availabilityState === 'Operational' ? 'check_circle' : 'build' }}
                  </mat-icon>
                  <span>{{ room.availabilityState }}</span>
                </span>
                <span class="text-[#656d68] dark:text-[#88928c]">·</span>
                <span class="font-mono tabular-nums text-[#4a504c] dark:text-[#b5bdb8]">
                  {{ room.occupancyCount }} / {{ room.capacity }} seats occupied
                </span>
              </div>

              @if (room.unavailabilityReason) {
                <div class="mt-2 p-2.5 rounded-[6px] bg-amber-50/90 dark:bg-amber-950/40 border border-amber-700/30 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2">
                  <mat-icon class="!w-4 !h-4 !text-[16px] shrink-0 mt-0.5">warning_amber</mat-icon>
                  <span>{{ room.unavailabilityReason }}</span>
                </div>
              }
            </div>

            <!-- Live IoT Readings & Controls -->
            <div class="space-y-2.5">
              <div class="text-xs font-semibold text-[#161917] dark:text-[#eceee9]">
                IoT sensors and hardware controls
              </div>
              <div class="grid grid-cols-2 gap-2.5 text-xs">
                <div class="p-2.5 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e]">
                  <span class="text-[#656d68] dark:text-[#88928c]">RFID access lock</span>
                  <p class="font-mono font-bold text-[#161917] dark:text-[#eceee9] mt-0.5 flex items-center gap-1">
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">
                      {{ room.smartLockState === 'Locked' ? 'lock' : 'lock_open' }}
                    </mat-icon>
                    <span>{{ room.smartLockState }}</span>
                  </p>
                  <button
                    type="button"
                    [disabled]="crms.activeRole() === 'Student'"
                    (click)="crms.toggleRoomSmartLock(room.id)"
                    class="mt-2 w-full min-h-[40px] sm:min-h-[32px] px-2.5 py-1 text-xs font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] hover:bg-[#efefeb] dark:hover:bg-[#202422] disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">vpn_key</mat-icon>
                    <span>{{ room.smartLockState === 'Locked' ? 'Unlock door' : 'Lock door' }}</span>
                  </button>
                </div>

                <div class="p-2.5 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e]">
                  <span class="text-[#656d68] dark:text-[#88928c]">Climate · {{ room.energyKw }} kW</span>
                  <p class="font-mono font-bold tabular-nums text-[#161917] dark:text-[#eceee9] mt-0.5">
                    {{ room.hvacTempC }}°C setpoint
                  </p>
                  <div class="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      [disabled]="crms.activeRole() === 'Student'"
                      (click)="crms.adjustRoomHvac(room.id, -0.5)"
                      aria-label="Decrease room temperature by 0.5 degrees"
                      class="min-h-[40px] sm:min-h-[32px] px-2 py-1 text-xs font-mono font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] hover:bg-[#efefeb] disabled:opacity-50"
                    >
                      -0.5°C
                    </button>
                    <button
                      type="button"
                      [disabled]="crms.activeRole() === 'Student'"
                      (click)="crms.adjustRoomHvac(room.id, 0.5)"
                      aria-label="Increase room temperature by 0.5 degrees"
                      class="min-h-[40px] sm:min-h-[32px] px-2 py-1 text-xs font-mono font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] hover:bg-[#efefeb] disabled:opacity-50"
                    >
                      +0.5°C
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Installed Room Equipment -->
            <div class="space-y-1 text-xs">
              <div class="font-semibold text-[#161917] dark:text-[#eceee9]">Installed room hardware</div>
              <p class="text-[#4a504c] dark:text-[#b5bdb8]">
                {{ room.installedEquipment.join(' · ') }}
              </p>
            </div>

            <!-- Standing Term Course Schedule in this Room -->
            <div class="space-y-2 pt-3 border-t border-[#dcdcd5] dark:border-[#2c322e] text-xs">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-[#161917] dark:text-[#eceee9]">
                  Assigned term courses ({{ roomTermCourses().length }})
                </span>
                <button
                  type="button"
                  (click)="crms.activeModule.set('rooms-courses'); mobileInspectorOpen.set(false)"
                  class="font-medium text-[#14532d] dark:text-[#4ade80] hover:underline flex items-center gap-0.5"
                >
                  <span>Full schedule</span>
                  <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">arrow_forward</mat-icon>
                </button>
              </div>

              @if (roomTermCourses().length === 0) {
                <p class="text-[#656d68] dark:text-[#88928c]">
                  No standing term courses locked to this room. Open for ad-hoc reservations or class relocations.
                </p>
              } @else {
                <div class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413]">
                  @for (course of roomTermCourses(); track course.id) {
                    <div class="p-2.5 space-y-1.5">
                      <div class="flex items-center justify-between gap-2 font-mono">
                        <span class="font-bold text-[#161917] dark:text-[#eceee9]">
                          {{ course.courseCode }} · {{ course.scheduleDays }} {{ course.startTime }}-{{ course.endTime }}
                        </span>
                        <span
                          class="font-semibold text-[11px]"
                          [class.text-amber-800]="room.availabilityState !== 'Operational' || !!course.relocatedRoomId"
                          [class.dark:text-amber-300]="room.availabilityState !== 'Operational' || !!course.relocatedRoomId"
                          [class.text-[#14532d]]="room.availabilityState === 'Operational' && !course.relocatedRoomId && !crms.darkMode()"
                          [class.dark:text-[#4ade80]]="room.availabilityState === 'Operational' && !course.relocatedRoomId && crms.darkMode()"
                        >
                          {{
                            course.relocatedRoomId
                              ? 'Relocated'
                              : room.availabilityState === 'Operational'
                                ? 'Active'
                                : 'Needs room'
                          }}
                        </span>
                      </div>
                      <p class="text-[#4a504c] dark:text-[#b5bdb8]">
                        {{ course.courseTitle }} · {{ course.instructorName }}
                      </p>

                      @if (room.availabilityState !== 'Operational' && !course.relocatedRoomId) {
                        <button
                          type="button"
                          (click)="openTeacherRelocation(course.id); mobileInspectorOpen.set(false)"
                          class="w-full min-h-[44px] sm:min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-[6px] border border-red-700 dark:border-red-500 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">swap_horiz</mat-icon>
                          <span>Reserve alternate room for {{ course.courseCode }}</span>
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Quick Actions (Book Room or Place Under Maintenance with Confirmation) -->
            <div class="pt-3 border-t border-[#dcdcd5] dark:border-[#2c322e] space-y-2">
              <button
                type="button"
                [disabled]="room.availabilityState !== 'Operational'"
                (click)="bookSelectedRoom(room); mobileInspectorOpen.set(false)"
                class="w-full min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs font-semibold rounded-[6px] bg-[#14532d] hover:bg-[#166534] disabled:opacity-40 text-[#fbfbfa] transition-colors flex items-center justify-center gap-1.5"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">event_available</mat-icon>
                <span>Reserve {{ room.code }}</span>
              </button>

              @if (crms.activeRole() !== 'Student') {
                @if (room.availabilityState === 'Operational') {
                  <button
                    type="button"
                    (click)="confirmMaintenanceOutage(room); mobileInspectorOpen.set(false)"
                    class="w-full min-h-[44px] sm:min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] text-[#4a504c] dark:text-[#b5bdb8] hover:bg-[#efefeb] dark:hover:bg-[#202422] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">build</mat-icon>
                    <span>Place room under maintenance</span>
                  </button>
                } @else {
                  <button
                    type="button"
                    (click)="crms.toggleRoomAvailability(room.id, 'Operational')"
                    class="w-full min-h-[44px] sm:min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-[6px] border border-[#14532d] text-[#14532d] dark:text-[#4ade80] hover:bg-[#e7f3ec] dark:hover:bg-[#132a1c] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">check_circle</mat-icon>
                    <span>Restore room to operational status</span>
                  </button>
                }
              }
            </div>
          }
        </aside>
      </div>
    </div>
  `,
})
export class DigitalTwinView {
  readonly crms = inject(CrmsService);
  readonly embedded = input<boolean>(false);

  readonly viewMode = signal<'map' | 'list'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'map'
  );
  readonly zoomPercent = signal<number>(100);
  readonly legendOpen = signal<boolean>(false);
  readonly mobileInspectorOpen = signal<boolean>(false);

  readonly buildings: BuildingName[] = [
    'Main Academic Hall',
    'Science & Innovation Wing',
    'University Sports Complex',
    'Student Union Center',
  ];

  readonly buildingRooms = computed(() => {
    const floor = this.crms.selectedFloor();
    return this.crms
      .rooms()
      .filter(
        (r) =>
          r.building === this.crms.selectedBuilding() &&
          (floor === 'all' || r.floor === floor)
      );
  });

  readonly selectedRoom = computed(() => {
    const current = this.crms.getRoomById(this.crms.selectedRoomId());
    if (current && current.building === this.crms.selectedBuilding()) {
      return current;
    }
    return this.buildingRooms()[0] || this.crms.rooms()[0];
  });

  readonly roomTermCourses = computed(() => {
    const room = this.selectedRoom();
    if (!room) return [];
    return this.crms.termCourses().filter((c) => c.constantRoomId === room.id);
  });

  readonly buildingOccupancy = computed(() =>
    this.buildingRooms().reduce((acc, r) => acc + r.occupancyCount, 0)
  );

  readonly buildingEnergyKw = computed(() =>
    Number(this.buildingRooms().reduce((acc, r) => acc + r.energyKw, 0).toFixed(1))
  );

  readonly buildingUnavailableCount = computed(
    () => this.buildingRooms().filter((r) => r.availabilityState !== 'Operational').length
  );

  selectBuilding(bldg: BuildingName): void {
    this.crms.selectedBuilding.set(bldg);
    this.crms.selectedFloor.set('all');
    const firstRoom = this.crms.rooms().find((r) => r.building === bldg);
    if (firstRoom) {
      this.crms.selectedRoomId.set(firstRoom.id);
    }
  }

  selectRoom(roomId: string): void {
    this.crms.selectedRoomId.set(roomId);
    this.mobileInspectorOpen.set(true);
  }

  stepZoom(delta: number): void {
    this.zoomPercent.update((z) => Math.max(100, Math.min(150, z + delta)));
  }

  getRoomSvgFill(room: FacilityRoom, isSelected: boolean): string {
    const isDark = this.crms.darkMode();
    if (room.availabilityState !== 'Operational') {
      return 'url(#maintenanceHatch)';
    }
    if (isSelected) {
      return isDark ? '#132a1c' : '#e7f3ec';
    }
    return isDark ? '#181b19' : '#fbfbfa';
  }

  getRoomSvgStroke(room: FacilityRoom, isSelected: boolean): string {
    const isDark = this.crms.darkMode();
    if (isSelected) {
      return isDark ? '#4ade80' : '#14532d';
    }
    if (room.availabilityState !== 'Operational') {
      return isDark ? '#f59e0b' : '#b45309';
    }
    return isDark ? '#38403b' : '#b8beb9';
  }

  getCoursesForRoomText(roomId: string): string {
    const courses = this.crms
      .termCourses()
      .filter((c) => c.constantRoomId === roomId)
      .map((c) => c.courseCode);
    return courses.length > 0 ? courses.join(', ') : 'Open for booking';
  }

  bookSelectedRoom(room: FacilityRoom): void {
    this.crms.selectedRoomId.set(room.id);
    this.crms.quickBookModalOpen.set(true);
  }

  confirmMaintenanceOutage(room: FacilityRoom): void {
    const affectedCount = this.crms
      .termCourses()
      .filter((c) => c.constantRoomId === room.id).length;
    this.crms.requestConfirmation({
      title: `Place ${room.code} under maintenance?`,
      consequence:
        affectedCount > 0
          ? `This marks ${room.name} unavailable and unlocks alternate-room reservations for ${affectedCount} assigned term course(s). You can undo this immediately from the notification banner.`
          : `This blocks new reservations in ${room.name} until restored to operational status.`,
      confirmLabel: 'Place under maintenance',
      severity: 'warning',
      onConfirm: () => {
        this.crms.toggleRoomAvailability(
          room.id,
          'Under Maintenance',
          'Scheduled HVAC & smartboard calibration'
        );
      },
    });
  }

  confirmEmergency(protocol: EmergencyState['protocol']): void {
    const msg =
      protocol === 'Earthquake Drill / Seismic Alert'
        ? 'Drop, cover, and hold. Proceed to designated muster safe zones (Aud 104, Court A, Rm 201 Student Union). All RFID exit doors are unlocked.'
        : 'Facility security lockdown initiated. All perimeter RFID doors are locked; remain inside your current room until cleared.';
    this.crms.requestConfirmation({
      title: `Activate campus ${protocol}?`,
      consequence:
        'This broadcasts a campus-wide alert banner and overrides all 12 building RFID door locks immediately.',
      confirmLabel: 'Broadcast emergency alert',
      severity: 'danger',
      onConfirm: () => {
        this.crms.triggerEmergencyProtocol(protocol, msg);
      },
    });
  }

  openTeacherRelocation(courseId: string): void {
    this.crms.relocationCourseId.set(courseId);
    this.crms.activeModule.set('rooms-courses');
  }
}
