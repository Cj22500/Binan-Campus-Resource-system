import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmsService } from '../services/crms';
import { EquipmentAsset } from '../models/crms.models';

@Component({
  selector: 'app-equipment-lifecycle-view',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <!-- Page Header: Task-First Screen with Clear Primary Purpose -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#dcdcd5] dark:border-[#2c322e]">
        <div>
          <h1 class="text-xl lg:text-2xl font-bold text-[#161917] dark:text-[#eceee9]">
            Equipment inventory &amp; loans
          </h1>
          <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-1">
            Manage device loans, lab tool availability, and RFID check-in/out workflows.
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
            @if (selectedCategory() !== 'ALL' || searchQuery()) {
              <span class="w-2 h-2 rounded-full bg-amber-600"></span>
            }
          </button>

          <button
            type="button"
            (click)="checkoutDrawerOpen.set(true)"
            class="px-3 py-1.5 text-xs font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb] dark:hover:bg-[#222624] inline-flex items-center gap-1.5 transition-colors"
          >
            <mat-icon class="!w-4 !h-4 !text-[16px]">qr_code_scanner</mat-icon>
            <span>Issue equipment</span>
          </button>
        </div>
      </div>

      <!-- Collapsible Advanced Filters Bar -->
      @if (filtersOpen()) {
        <div class="p-3.5 rounded-[10px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex flex-wrap items-center gap-3 flex-1">
            <div class="w-full sm:w-64">
              <label for="eq-search" class="sr-only">Search equipment</label>
              <input
                id="eq-search"
                type="search"
                placeholder="Search tag, serial, or name..."
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
                class="w-full px-3 py-1.5 text-xs rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
              />
            </div>

            <div class="flex items-center gap-1.5">
              @for (cat of categories; track cat) {
                <button
                  type="button"
                  (click)="selectCategory(cat)"
                  class="px-2.5 py-1 text-xs rounded-[5px] border"
                  [class.bg-[#e7f3ec]]="selectedCategory() === cat && !crms.darkMode()"
                  [class.text-[#14532d]]="selectedCategory() === cat && !crms.darkMode()"
                  [class.dark:bg-[#132a1c]]="selectedCategory() === cat && crms.darkMode()"
                  [class.dark:text-[#4ade80]]="selectedCategory() === cat && crms.darkMode()"
                  [class.border-[#14532d]]="selectedCategory() === cat"
                  [class.border-[#dcdcd5]]="selectedCategory() !== cat"
                >
                  {{ cat }}
                </button>
              }
            </div>
          </div>

          <button
            type="button"
            (click)="filtersOpen.set(false)"
            class="px-2.5 py-1 rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] text-xs hover:bg-[#efefeb]"
          >
            Done
          </button>
        </div>
      }

      <!-- Clean 4-Column Table (Item, Status, When, Action) -->
      <div class="bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[10px] overflow-hidden">
        @if (sortedEquipment().length === 0) {
          <!-- Friendly Empty State -->
          <div class="p-10 text-center space-y-2">
            <p class="text-sm font-semibold text-[#161917] dark:text-[#eceee9]">
              No equipment found
            </p>
            <p class="text-xs text-[#565b56] dark:text-[#9ca39e]">
              Try searching with another keyword or selecting a different category.
            </p>
            <button
              type="button"
              (click)="resetFilters()"
              class="mt-2 px-3 py-1.5 text-xs font-medium rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] hover:bg-[#efefeb]"
            >
              Reset filters
            </button>
          </div>
        } @else {
          <!-- Desktop Table -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="bg-[#f6f6f3] dark:bg-[#121413] border-b border-[#dcdcd5] dark:border-[#2c322e] text-[#565b56] dark:text-[#9ca39e]">
                <tr>
                  <!-- Col 1: Item -->
                  <th class="py-3 px-4 font-semibold">Equipment item</th>
                  <!-- Col 2: Status -->
                  <th class="py-3 px-4 font-semibold">Stock status</th>
                  <!-- Col 3: When -->
                  <th class="py-3 px-4 font-semibold">Warranty &amp; replacement</th>
                  <!-- Col 4: Action -->
                  <th class="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#dcdcd5] dark:divide-[#2c322e]">
                @for (item of sortedEquipment(); track item.id) {
                  <tr
                    class="h-14 hover:bg-[#efefeb]/60 dark:hover:bg-[#202422]/60 transition-colors"
                  >
                    <!-- Col 1: Item -->
                    <td class="py-2.5 px-4 align-middle">
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-bold text-[#161917] dark:text-[#eceee9]">{{ item.assetTag }}</span>
                        <span class="font-medium text-[#161917] dark:text-[#eceee9] truncate max-w-[240px]">{{ item.name }}</span>
                      </div>
                      <div class="text-[11px] text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                        {{ item.category }} · Rule: {{ item.eligibilityRule }}
                        @if (item.currentHolderName) {
                          <span> · Loaned to {{ item.currentHolderName }}</span>
                        }
                      </div>
                    </td>

                    <!-- Col 2: Status (Neutral text with colored icon only) -->
                    <td class="py-2.5 px-4 align-middle whitespace-nowrap">
                      @if (item.availableQty > 0) {
                        <span class="inline-flex items-center gap-1.5 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                          <mat-icon class="!w-4 !h-4 !text-[16px] text-[#1B7F4B]">check_circle</mat-icon>
                          <span><span class="font-mono tabular-nums">{{ item.availableQty }}</span> of <span class="font-mono tabular-nums">{{ item.totalQty }}</span> available</span>
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1.5 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                          <mat-icon class="!w-4 !h-4 !text-[16px] text-[#B91C1C]">block</mat-icon>
                          <span>All units on loan</span>
                        </span>
                      }
                    </td>

                    <!-- Col 3: When -->
                    <td class="py-2.5 px-4 align-middle font-mono text-[11px] text-[#565b56] dark:text-[#9ca39e]">
                      <div>Exp: {{ item.warrantyExpiry }}</div>
                      <div>Replace: {{ item.replacementScheduleDate }}</div>
                    </td>

                    <!-- Col 4: Action -->
                    <td class="py-2.5 px-4 align-middle text-right whitespace-nowrap" (click)="$event.stopPropagation()">
                      <div class="inline-flex items-center justify-end gap-1.5">
                        @if (item.availableQty > 0) {
                          <button
                            type="button"
                            (click)="selectForCheckout(item)"
                            class="h-[30px] px-2.5 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center gap-1"
                          >
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">qr_code_scanner</mat-icon>
                            <span>Issue</span>
                          </button>
                        }
                        @if (item.availableQty < item.totalQty) {
                          <button
                            type="button"
                            (click)="crms.checkinEquipment(item.id)"
                            class="h-[30px] px-2.5 text-xs font-medium border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center gap-1"
                          >
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">assignment_returned</mat-icon>
                            <span>Return</span>
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
            @for (item of sortedEquipment(); track item.id) {
              <div class="p-3.5 space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <span class="font-mono font-bold text-xs text-[#14532d] dark:text-[#4ade80]">{{ item.assetTag }}</span>
                    <h3 class="text-sm font-semibold text-[#161917] dark:text-[#eceee9] leading-snug">{{ item.name }}</h3>
                    <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                      {{ item.category }} · Rule: {{ item.eligibilityRule }}
                    </p>
                  </div>
                  <!-- Status Indicator -->
                  <div class="shrink-0 text-right">
                    @if (item.availableQty > 0) {
                      <span class="inline-flex items-center gap-1 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-[#1B7F4B]">check_circle</mat-icon>
                        <span class="font-mono font-semibold">{{ item.availableQty }}/{{ item.totalQty }}</span>
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 text-xs text-[#14201A] dark:text-[#EDF3EE]">
                        <mat-icon class="!w-4 !h-4 !text-[16px] text-[#B91C1C]">block</mat-icon>
                        <span class="font-medium">On loan</span>
                      </span>
                    }
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-[#dcdcd5]/60 dark:border-[#2c322e]/60 font-mono text-[#565b56] dark:text-[#9ca39e]">
                  <div>Warranty: {{ item.warrantyExpiry }}</div>
                  <div>Replace: {{ item.replacementScheduleDate }}</div>
                </div>

                @if (item.currentHolderName) {
                  <div class="text-xs text-[#565b56] dark:text-[#9ca39e]">
                    Holder: <span class="font-medium text-[#161917] dark:text-[#eceee9]">{{ item.currentHolderName }}</span>
                  </div>
                }

                <!-- Touch Actions (min 44px height) -->
                <div class="pt-1 flex gap-2">
                  @if (item.availableQty > 0) {
                    <button
                      type="button"
                      (click)="selectForCheckout(item)"
                      class="flex-1 min-h-[44px] px-3 text-xs font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center justify-center gap-1.5"
                    >
                      <mat-icon class="!w-4 !h-4 !text-[16px]">qr_code_scanner</mat-icon>
                      <span>Issue unit</span>
                    </button>
                  }
                  @if (item.availableQty < item.totalQty) {
                    <button
                      type="button"
                      (click)="crms.checkinEquipment(item.id)"
                      class="flex-1 min-h-[44px] px-3 text-xs font-semibold rounded-[6px] border border-[#dcdcd5] dark:border-[#2c322e] bg-[#fbfbfa] dark:bg-[#181b19] hover:bg-[#efefeb] text-[#161917] dark:text-[#eceee9] inline-flex items-center justify-center gap-1.5"
                    >
                      <mat-icon class="!w-4 !h-4 !text-[16px]">assignment_returned</mat-icon>
                      <span>Return unit</span>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Slide-Over Drawer: Issue Equipment / Check-out Terminal -->
      @if (checkoutDrawerOpen()) {
        <div class="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="eq-drawer-title">
          <button
            type="button"
            aria-label="Close drawer"
            (click)="checkoutDrawerOpen.set(false)"
            class="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity w-full h-full cursor-default"
          ></button>

          <div class="fixed inset-y-0 right-0 pl-0 sm:pl-10 max-w-full flex w-full sm:w-auto">
            <div class="w-full sm:w-screen sm:max-w-md bg-[#fbfbfa] dark:bg-[#181b19] border-l border-[#dcdcd5] dark:border-[#2c322e] shadow-xl p-4 sm:p-5 flex flex-col justify-between overflow-y-auto min-h-full">
              <div class="space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-[#dcdcd5] dark:border-[#2c322e]">
                  <div>
                    <h2 id="eq-drawer-title" class="text-base font-bold text-[#161917] dark:text-[#eceee9]">
                      Issue campus equipment
                    </h2>
                    <p class="text-xs text-[#565b56] dark:text-[#9ca39e] mt-0.5">
                      Verify student clearance and issue hardware.
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="checkoutDrawerOpen.set(false)"
                    aria-label="Close drawer"
                    class="p-2 sm:p-1 rounded-[6px] hover:bg-[#efefeb] text-[#565b56]"
                  >
                    <mat-icon class="!w-5 !h-5 !text-[20px]">close</mat-icon>
                  </button>
                </div>

                @if (checkoutError()) {
                  <div role="alert" class="p-3 rounded-[6px] bg-red-50 dark:bg-red-950/50 border border-red-700/40 text-xs text-red-900 dark:text-red-200">
                    {{ checkoutError() }}
                  </div>
                }

                <form [formGroup]="checkoutForm" (ngSubmit)="submitCheckout()" class="space-y-3.5 text-xs">
                  <div>
                    <label for="eq-asset-sel" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Asset to issue <span class="text-red-700">*</span>
                    </label>
                    <select
                      id="eq-asset-sel"
                      formControlName="assetId"
                      class="w-full px-3 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                    >
                      @for (eq of crms.equipment(); track eq.id) {
                        <option [value]="eq.id">
                          {{ eq.assetTag }} · {{ eq.name }} ({{ eq.availableQty }} available)
                        </option>
                      }
                    </select>
                  </div>

                  <div>
                    <span class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Tap student badge sample
                    </span>
                    <div class="flex flex-wrap gap-2">
                      @for (stu of crms.students(); track stu.id) {
                        <button
                          type="button"
                          (click)="prefillBorrower(stu.rfidUid, stu.name)"
                          class="min-h-[36px] px-2.5 py-1 text-xs font-mono rounded-[4px] border border-[#dcdcd5] hover:bg-[#efefeb] inline-flex items-center"
                        >
                          {{ stu.name.split(' ')[0] }} ({{ stu.rfidUid }})
                        </button>
                      }
                    </div>
                  </div>

                  <div>
                    <label for="eq-badge-input" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Badge ID <span class="text-red-700">*</span>
                    </label>
                    <input
                      id="eq-badge-input"
                      type="text"
                      formControlName="borrowerBadgeId"
                      class="w-full px-3 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>

                  <div>
                    <label for="eq-borrower-name" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Borrower name <span class="text-red-700">*</span>
                    </label>
                    <input
                      id="eq-borrower-name"
                      type="text"
                      formControlName="borrowerName"
                      class="w-full px-3 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>

                  <div>
                    <label for="eq-due-date" class="block font-semibold text-[#161917] dark:text-[#eceee9] mb-1">
                      Return due date <span class="text-red-700">*</span>
                    </label>
                    <input
                      id="eq-due-date"
                      type="date"
                      formControlName="expectedReturnDate"
                      class="w-full px-3 py-2.5 sm:py-2 rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] font-mono text-base sm:text-xs text-[#161917] dark:text-[#eceee9]"
                    />
                  </div>

                  <div class="pt-3 border-t border-[#dcdcd5] dark:border-[#2c322e] flex items-center justify-end gap-2 sticky bottom-0 bg-[#fbfbfa] dark:bg-[#181b19] py-2">
                    <button
                      type="button"
                      (click)="checkoutDrawerOpen.set(false)"
                      class="min-h-[44px] px-3.5 py-2 rounded-[6px] border border-[#dcdcd5] text-[#161917] dark:text-[#eceee9] hover:bg-[#efefeb]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="min-h-[44px] px-4 py-2 font-semibold rounded-[6px] bg-[#14532d] hover:bg-[#166534] text-white transition-colors"
                    >
                      Issue unit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class EquipmentLifecycleView {
  readonly crms = inject(CrmsService);
  private readonly fb = inject(FormBuilder);

  readonly filtersOpen = signal<boolean>(false);
  readonly checkoutDrawerOpen = signal<boolean>(false);
  readonly selectedAssetDetails = signal<EquipmentAsset | null>(null);

  readonly categories = ['ALL', 'Laptops & Computing', 'Science & Lab Tools', 'AV & Presentation'];
  readonly selectedCategory = signal<string>('ALL');
  readonly searchQuery = signal<string>('');
  readonly checkoutError = signal<string>('');

  readonly checkoutForm = this.fb.nonNullable.group({
    assetId: ['AST-CMP-101', Validators.required],
    borrowerBadgeId: ['RFID-9921-STU', Validators.required],
    borrowerName: ['Ma. Theresa Macaraeg', Validators.required],
    purpose: ['Coursework & Capstone Project', Validators.required],
    expectedReturnDate: ['2026-11-08', Validators.required],
  });

  readonly sortedEquipment = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();
    return this.crms.equipment().filter((e) => {
      if (cat !== 'ALL' && e.category !== cat) return false;
      if (!q) return true;
      return (
        e.assetTag.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  });

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('ALL');
  }

  selectForCheckout(asset: EquipmentAsset): void {
    this.checkoutForm.patchValue({ assetId: asset.id });
    this.checkoutDrawerOpen.set(true);
  }

  prefillBorrower(rfid: string, name: string): void {
    this.checkoutForm.patchValue({
      borrowerBadgeId: rfid,
      borrowerName: name,
    });
  }

  submitCheckout(): void {
    this.checkoutError.set('');
    const raw = this.checkoutForm.getRawValue();
    const res = this.crms.checkoutEquipment(
      raw.assetId,
      raw.borrowerBadgeId,
      raw.borrowerName,
      raw.expectedReturnDate
    );
    if (!res.ok) {
      this.checkoutError.set(res.message);
    } else {
      this.checkoutDrawerOpen.set(false);
      this.crms.pushToast('Equipment issued', `Issued unit to ${raw.borrowerName}.`, 'success');
    }
  }
}
