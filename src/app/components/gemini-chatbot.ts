import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmsService } from '../services/crms';
import { ModuleId } from '../models/crms.models';

export interface ChatTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  suggestedModule?: ModuleId | 'none';
  suggestedModuleLabel?: string;
  modelUsed?: string;
}

@Component({
  selector: 'app-gemini-chatbot',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Floating Panel anchored to bottom right, driven by crms.guideOpen -->
    @if (crms.guideOpen()) {
      <div class="fixed bottom-4 right-4 z-50">
        <!-- Multi-Turn Chat Panel -->
        <div
          role="dialog"
          aria-label="CRMS navigation and feature guide"
          class="w-[360px] sm:w-[420px] h-[520px] rounded-[10px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] shadow-lg flex flex-col overflow-hidden"
        >
          <!-- Panel Header -->
          <div class="px-3.5 py-2.5 bg-[#161917] text-[#eceee9] flex items-center justify-between gap-2 border-b border-[#2c322e]">
            <div class="flex items-center gap-2 min-w-0">
              <mat-icon class="!w-4 !h-4 !text-[16px] text-[#4ade80] shrink-0">menu_book</mat-icon>
              <div class="truncate">
                <div class="text-xs font-bold truncate">Biñan CRMS guide and navigation</div>
                <div class="text-[10px] text-[#88928c] font-mono truncate">
                  {{ fastMode() ? 'Fast · gemini-3.1-flash-lite' : 'Standard · gemini-3.8-flash' }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                (click)="fastMode.set(!fastMode())"
                class="px-2 py-1 text-[10px] font-mono font-semibold rounded-[6px] bg-[#202422] hover:bg-[#2c322e] text-[#eceee9] border border-[#2c322e]"
                title="Switch between gemini-3.8-flash and fast gemini-3.1-flash-lite"
              >
                {{ fastMode() ? 'FAST' : 'STD' }}
              </button>
              <button
                type="button"
                (click)="crms.guideOpen.set(false)"
                class="p-1 text-[#b5bdb8] hover:text-[#eceee9] rounded-[6px]"
                aria-label="Close CRMS guide"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">close</mat-icon>
              </button>
            </div>
          </div>

          <!-- Quick Starter Prompts -->
          <div class="px-3 py-2 bg-[#f6f6f3] dark:bg-[#121413] border-b border-[#dcdcd5] dark:border-[#2c322e] flex items-center gap-1.5 overflow-x-auto">
            @for (q of starterPrompts; track q.label) {
              <button
                type="button"
                (click)="sendPromptText(q.prompt)"
                [disabled]="isLoading()"
                class="px-2.5 py-1 text-[11px] font-medium bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] rounded-[6px] hover:border-[#14532d] text-[#161917] dark:text-[#eceee9] whitespace-nowrap shrink-0 transition-colors"
              >
                {{ q.label }}
              </button>
            }
          </div>

          <!-- Scrollable Conversation Thread -->
          <div
            #scrollThread
            class="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-[#f6f6f3] dark:bg-[#121413]"
          >
            @for (msg of messages(); track msg.id) {
              <div
                class="flex flex-col"
                [class.items-end]="msg.role === 'user'"
                [class.items-start]="msg.role === 'model'"
              >
                <div
                  class="max-w-[88%] rounded-[6px] px-3 py-2.5 space-y-2 leading-relaxed"
                  [class]="
                    msg.role === 'user'
                      ? 'bg-[#14532d] text-[#fbfbfa]'
                      : 'bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]'
                  "
                >
                  <p class="whitespace-pre-line">{{ msg.text }}</p>

                  @if (msg.role === 'model' && msg.suggestedModule && msg.suggestedModule !== 'none') {
                    <div class="pt-1.5 border-t border-[#dcdcd5] dark:border-[#2c322e] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        (click)="navigateToSuggested(msg.suggestedModule)"
                        class="px-2.5 py-1 text-[11px] font-semibold bg-[#14532d] hover:bg-[#166534] text-[#fbfbfa] rounded-[6px] transition-colors flex items-center gap-1"
                      >
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">arrow_forward</mat-icon>
                        <span>{{ msg.suggestedModuleLabel || 'Open view' }}</span>
                      </button>
                      @if (msg.modelUsed) {
                        <span class="text-[10px] font-mono text-[#656d68]">{{ msg.modelUsed }}</span>
                      }
                    </div>
                  }
                </div>
                <span class="text-[10px] text-[#656d68] dark:text-[#88928c] font-mono mt-1 px-1">
                  {{ msg.role === 'user' ? 'You' : 'CRMS Guide' }} · {{ msg.timestamp }}
                </span>
              </div>
            }

            <!-- Skeleton Loading State (No Spinners) -->
            @if (isLoading()) {
              <div class="flex items-start" role="status" aria-label="Loading response">
                <div class="w-4/5 p-3 rounded-[6px] bg-[#fbfbfa] dark:bg-[#181b19] border border-[#dcdcd5] dark:border-[#2c322e] space-y-2">
                  <div class="h-3 w-3/4 bg-[#efefeb] dark:bg-[#202422] rounded-[4px] animate-pulse"></div>
                  <div class="h-3 w-1/2 bg-[#efefeb] dark:bg-[#202422] rounded-[4px] animate-pulse"></div>
                </div>
              </div>
            }
          </div>

          <!-- Input Form -->
          <form
            [formGroup]="chatForm"
            (ngSubmit)="submitMessage()"
            class="p-3 bg-[#fbfbfa] dark:bg-[#181b19] border-t border-[#dcdcd5] dark:border-[#2c322e] flex items-center gap-2"
          >
            <label for="crms-chat-input" class="sr-only">Ask about CRMS features or navigation</label>
            <input
              id="crms-chat-input"
              type="text"
              formControlName="message"
              placeholder="Ask how a feature works or say 'Open floorplan'..."
              class="flex-1 px-3 py-2 text-xs rounded-[6px] bg-[#f6f6f3] dark:bg-[#121413] border border-[#dcdcd5] dark:border-[#2c322e] text-[#161917] dark:text-[#eceee9]"
            />
            <button
              type="submit"
              [disabled]="isLoading() || chatForm.invalid"
              class="min-h-[34px] px-3 py-1.5 rounded-[6px] bg-[#14532d] hover:bg-[#166534] disabled:opacity-40 text-[#fbfbfa] text-xs font-semibold flex items-center gap-1 shrink-0"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">send</mat-icon>
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    }
  `,
})
export class GeminiChatbot {
  readonly crms = inject(CrmsService);
  private readonly fb = inject(FormBuilder);

  readonly isOpen = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly fastMode = signal<boolean>(false);

  readonly scrollThread = viewChild<ElementRef<HTMLDivElement>>('scrollThread');

  readonly starterPrompts = [
    {
      label: 'Course room relocation',
      prompt: 'How do constant course rooms and teacher alternate room relocations work?',
    },
    {
      label: 'Open 2D floorplan',
      prompt: 'Open the 2D campus floorplan and explain the room IoT controls.',
    },
    {
      label: 'Equipment & cashier',
      prompt: 'How do RFID equipment checkouts, depreciation, and student fine payments work?',
    },
    {
      label: 'Emergency drills',
      prompt: 'How do I start an earthquake safe-zone drill on the campus floorplan?',
    },
  ];

  readonly messages = signal<ChatTurn[]>([
    {
      id: 'MSG-INIT',
      role: 'model',
      text: 'Hello. I can explain any Biñan CRMS workflow, such as setting constant term rooms for courses, reserving an alternate room when a classroom is under maintenance, or inspecting the 2D campus floorplan. Ask a question or tell me which screen to open.',
      timestamp: 'Ready',
      suggestedModule: 'rooms-courses',
      suggestedModuleLabel: 'Open term course rooms',
    },
  ]);

  readonly chatForm = this.fb.nonNullable.group({
    message: ['', Validators.required],
  });

  sendPromptText(promptText: string): void {
    this.chatForm.patchValue({ message: promptText });
    void this.submitMessage();
  }

  navigateToSuggested(modId: ModuleId | 'none'): void {
    if (modId && modId !== 'none') {
      this.crms.activeModule.set(modId);
    }
  }

  async submitMessage(): Promise<void> {
    if (this.chatForm.invalid || this.isLoading()) return;
    const userText = this.chatForm.getRawValue().message.trim();
    if (!userText) return;

    this.chatForm.reset({ message: '' });

    const historyPayload = this.messages().map((m) => ({
      role: m.role,
      text: m.text,
    }));

    const userTurn: ChatTurn = {
      id: 'USR-' + Date.now(),
      role: 'user',
      text: userText,
      timestamp: 'Just now',
    };

    this.messages.update((list) => [...list, userTurn]);
    this.isLoading.set(true);
    this.scrollToBottom();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: historyPayload,
          fastMode: this.fastMode(),
          activeModule: this.crms.activeModule(),
          activeRole: this.crms.activeRole(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reach CRMS guide service.');
      }

      const validModules: ModuleId[] = [
        'overview',
        'digital-twin',
        'rooms-courses',
        'equipment',
        'staff',
        'student-services',
        'events',
        'operations',
        'analytics',
        'security-ecosystem',
      ];
      const suggestedMod: ModuleId | 'none' = validModules.includes(data.suggestedModule)
        ? (data.suggestedModule as ModuleId)
        : 'none';

      const botTurn: ChatTurn = {
        id: 'BOT-' + Date.now(),
        role: 'model',
        text: (data.reply || '').replace(/[—–]/g, '-'),
        timestamp: 'Just now',
        suggestedModule: suggestedMod,
        suggestedModuleLabel: data.suggestedModuleLabel,
        modelUsed: data.modelUsed,
      };

      this.messages.update((list) => [...list, botTurn]);

      if (data.autoNavigate && suggestedMod !== 'none') {
        this.crms.activeModule.set(suggestedMod);
        this.crms.pushToast(
          'Opened requested view',
          `Switched to ${data.suggestedModuleLabel || suggestedMod}.`,
          'info'
        );
      }
    } catch (error: unknown) {
      let friendlyError = 'The AI guide service is temporarily experiencing high traffic. Please try again in a moment, or click one of the quick guide buttons above.';
      if (error instanceof Error) {
        if (error.message.includes('503') || error.message.includes('UNAVAILABLE') || error.message.includes('high demand')) {
          friendlyError = 'The model is temporarily experiencing high upstream demand. Retrying with high-throughput Lite mode...';
          // Auto-enable fastMode on 503 to use flash-lite on subsequent attempts
          this.fastMode.set(true);
        }
      }
      this.messages.update((list) => [
        ...list,
        {
          id: 'ERR-' + Date.now(),
          role: 'model',
          text: friendlyError,
          timestamp: 'Notice',
          suggestedModule: 'digital-twin',
          suggestedModuleLabel: 'Open 2D floorplan',
        },
      ]);
    } finally {
      this.isLoading.set(false);
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scrollThread()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }
}
