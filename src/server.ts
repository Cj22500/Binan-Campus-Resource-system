import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

const angularApp = new AngularNodeAppEngine();

const CRMS_KNOWLEDGEBASE_SYSTEM_INSTRUCTION = `You are the official Biñan Campus Resource Management System (CRMS) AI Navigation & Knowledgebase Assistant for Biñan Institute of Technology & Sciences (BITS).

Your role is to:
1. Explain how the CRMS software and its 10 modules work clearly and concisely.
2. Guide students, faculty, staff, and administrators through workflows and help them navigate directly to the right module.
3. Answer questions in English or Filipino (Tagalog) depending on the user's question or preference.

COMPLETE SOFTWARE KNOWLEDGEBASE:
- Module 'overview' (Overview): Displays the interactive 2D Campus Floorplan as the centerpiece, role-tailored operational tasks, asymmetric campus utilization metrics (47.2% utilization), standing term course room status, and an alert banner when any Term Course has an unavailable constant room.
- Module 'rooms-courses' (Term Courses & Rooms):
  * Term Course Constant Rooms (Sub-tab 1): Administration sets a constant standard room for each course or subject for the entire term (e.g., CS-301 in Rm 103, Mabini Wing; CPE-304L in Rm 102, Science Bldg; CS-402 in Rm 101, Science Bldg; CHEM-201L in Rm 204, Science Bldg).
  * Teacher Alternate Room Relocation Override: If a course's constant room becomes unavailable (e.g., marked 'Under Maintenance' via a work order or floorplan action), the system flags the course and unlocks the 'Relocate room' action for the teacher. Clicking it opens the relocation panel pre-filled with the course's student headcount, schedule, and required equipment, allowing 1-click auto-assign or manual selection of a replacement room.
  * Room Scheduler (Sub-tab 2): Ranks all 12 campus rooms by Fit Score (%) based on headcount, required equipment, energy efficiency, and real-time conflict checks against both standing term courses and single-date bookings.
- Module 'digital-twin' (Campus Floorplan): Interactive 2D SVG architectural floorplan across 4 buildings (Rizal Academic Hall, Science & Innovation Bldg, Varsity Sports Complex, Student Union Center) with floor switcher (All, 1F, 2F), zoom controls, and an accessible table view alternative. Users can select any room to inspect its standing term courses, live IoT readings (temperature, power draw, occupancy), toggle RFID locks, or trigger campus emergency drills.
- Module 'equipment' (Equipment & Assets): Tracks laptops, lab tools, AV gear, sports gear, and consumables with a sortable data table, RFID/QR check-out terminal enforcing student clearance rules, straight-line depreciation book value calculation, and warranty tracking.
- Module 'staff' (Faculty & Staff): Allocates personnel (e.g., Dr. Marites Villanueva, Engr. Arnel Panganiban, Prof. Josefa Macaraeg) to lectures, lab supervision, or facility operations while enforcing weekly HR workload hour caps.
- Module 'student-services' (Student ID & Cashier): Digital RFID/QR/NFC badge, Student Service Requests queue, and an integrated Cashier payment gateway (GCash, Maya, BITS Campus Card, Over-the-Counter) in PHP (₱).
- Module 'events' (Campus Events): Schedules campus symposiums, student club activities, and sports tournaments with live pre-submit double-booking conflict warnings.
- Module 'operations' (Approvals & Work Orders):
  * Approval Queue: Data table with a 3-step approval status timeline (Submitted -> Dept Review -> Approved), bulk approve, and confirmation dialog with undo for rejections.
  * Maintenance Work Orders: Dispatch repair or cleaning tickets. Checking 'Take room offline' automatically marks the room Under Maintenance and triggers teacher alternate-room relocation for courses in that room.
  * Budget Ledger: Tracks Allocated, Spent, Encumbered, and Available balances in PHP (₱).
- Module 'analytics' (Usage Analytics): Hourly campus utilization curve (08:00 to 18:00), 7-day predictive resource shortage advisories, and CSV/JSON exports.
- Module 'security-ecosystem' (Access & Audit Logs): Role-Based Access Control (RBAC), immutable Security Audit Logs, Philippines Data Privacy Act (RA 10173 / NPC) compliance center, and connected campus API payload inspector.
- Cloud Auth & Firestore Sync: Users can sign in with Google in the sidebar to sync their profile, term course assignments, relocations, and reservations to Cloud Firestore in real time. Do not use em-dashes in responses; use plain hyphens.

Keep answers helpful, direct, and under 140 words. Always set 'suggestedModule' to the most relevant module ID from ['overview', 'rooms-courses', 'digital-twin', 'equipment', 'staff', 'student-services', 'events', 'operations', 'analytics', 'security-ecosystem', 'none']. If the user explicitly asks to go to, open, or navigate to a module, set 'autoNavigate' to true.`;

interface ChatHistoryMessage {
  role: 'user' | 'model';
  text: string;
}

app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const { message, history = [], fastMode = false, activeModule = 'overview', activeRole = 'Admin' } = req.body as {
      message?: string;
      history?: ChatHistoryMessage[];
      fastMode?: boolean;
      activeModule?: string;
      activeRole?: string;
    };

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'A valid message string is required.' });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const formattedContents = [
      ...history.slice(-10).map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      })),
      {
        role: 'user' as const,
        parts: [
          {
            text: `[Context: User is currently on module "${activeModule}" with active role "${activeRole}"]\nUser question: ${message}`,
          },
        ],
      },
    ];

    // Model cascade: try primary model, fall back to gemini-3.1-flash-lite, then gemini-flash-latest on capacity/rate-limit spikes (503/429)
    const candidateModels = fastMode
      ? ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest']
      : ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    let selectedModel = candidateModels[0];
    let responseText: string | null = null;

    for (const modelCandidate of candidateModels) {
      try {
        selectedModel = modelCandidate;
        const res = await ai.models.generateContent({
          model: modelCandidate,
          contents: formattedContents,
          config: {
            systemInstruction: CRMS_KNOWLEDGEBASE_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: {
                  type: Type.STRING,
                  description: 'Helpful response explaining the CRMS feature or answering the user question.',
                },
                suggestedModule: {
                  type: Type.STRING,
                  description:
                    'Target module ID: overview, rooms-courses, digital-twin, equipment, staff, student-services, events, operations, analytics, security-ecosystem, or none.',
                },
                suggestedModuleLabel: {
                  type: Type.STRING,
                  description: 'Short button label for the suggested module, e.g. "Open Rooms & Term Courses".',
                },
                autoNavigate: {
                  type: Type.BOOLEAN,
                  description: 'True only if the user explicitly asked to open, go to, or navigate to a screen.',
                },
              },
              required: ['reply', 'suggestedModule', 'suggestedModuleLabel', 'autoNavigate'],
            },
          },
        });

        responseText = res.text ?? null;
        if (responseText) {
          break; // successfully generated
        }
      } catch (err: unknown) {
        console.warn(`Model ${modelCandidate} failed, attempting next candidate:`, err instanceof Error ? err.message : String(err));
      }
    }

    if (!responseText) {
      // Deterministic campus offline knowledgebase fallback in case of transient upstream outages
      const lowerMsg = message.toLowerCase();
      let fallbackReply = 'The Biñan CRMS Guide service is temporarily handling high traffic. You can still navigate between all modules using the top bar and sidebar.';
      let fallbackMod = 'overview';
      let fallbackLabel = 'Open Overview';

      if (lowerMsg.includes('floorplan') || lowerMsg.includes('map') || lowerMsg.includes('twin') || lowerMsg.includes('room 204') || lowerMsg.includes('iot') || lowerMsg.includes('lock')) {
        fallbackReply = 'The 2D Campus Floorplan displays Rizal Hall, Science Bldg, Sports Complex, and Student Union. You can click any room to inspect occupancy, HVAC temperatures, and toggle RFID smart locks.';
        fallbackMod = 'digital-twin';
        fallbackLabel = 'Open Campus Floorplan';
      } else if (lowerMsg.includes('relocat') || lowerMsg.includes('course') || lowerMsg.includes('subject') || lowerMsg.includes('maintenance')) {
        fallbackReply = 'Administration sets constant term rooms for each subject. If a room is under maintenance (e.g. Rm 204), teachers can reserve an alternate room immediately using the relocation tool.';
        fallbackMod = 'rooms-courses';
        fallbackLabel = 'Open Term Courses';
      } else if (lowerMsg.includes('equipment') || lowerMsg.includes('laptop') || lowerMsg.includes('rfid') || lowerMsg.includes('borrow')) {
        fallbackReply = 'The Equipment Inventory tracks laptops, oscilloscopes, and tools with straight-line depreciation and RFID checkout clearance checks.';
        fallbackMod = 'equipment';
        fallbackLabel = 'Open Equipment';
      } else if (lowerMsg.includes('approval') || lowerMsg.includes('work order') || lowerMsg.includes('budget')) {
        fallbackReply = 'The Operations center provides a 3-step workflow approval queue, maintenance work order dispatch, and campus budget tracking in PHP (₱).';
        fallbackMod = 'operations';
        fallbackLabel = 'Open Approvals & Upkeep';
      }

      res.json({
        reply: fallbackReply,
        suggestedModule: fallbackMod,
        suggestedModuleLabel: fallbackLabel,
        autoNavigate: lowerMsg.includes('open') || lowerMsg.includes('go to'),
        modelUsed: 'offline-crms-fallback',
      });
      return;
    }

    const parsed = JSON.parse(responseText.trim());
    res.json({
      reply: parsed.reply || 'I can help you navigate any module of the Biñan CRMS.',
      suggestedModule: parsed.suggestedModule || 'none',
      suggestedModuleLabel: parsed.suggestedModuleLabel || 'Open Module',
      autoNavigate: Boolean(parsed.autoNavigate),
      modelUsed: selectedModel,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Gemini API /api/chat error:', errMsg);
    res.status(500).json({
      error: errMsg || 'Failed to generate response from Gemini.',
    });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
