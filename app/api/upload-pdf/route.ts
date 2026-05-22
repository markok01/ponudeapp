import { NextRequest } from "next/server";
import type { UploadProgressEvent } from "@/types/upload-progress";
import { runPdfAiUploadPipeline } from "@/utils/pdf-upload-pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

function sseLine(event: UploadProgressEvent | Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: UploadProgressEvent | Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseLine(event)));
      };

      try {
        send({ progress: 2, stage: "upload", message: "Primam PDF fajl…" });

        const formData = await request.formData();
        const file = formData.get("file");
        const listName = String(formData.get("name") || "Cenovnik");

        if (!file || !(file instanceof File)) {
          send({ progress: 0, stage: "error", message: "PDF fajl nije prosleđen" });
          controller.close();
          return;
        }

        if (!file.name.toLowerCase().endsWith(".pdf")) {
          send({ progress: 0, stage: "error", message: "Dozvoljen je samo .pdf format" });
          controller.close();
          return;
        }

        send({ progress: 5, stage: "upload", message: "Učitavam PDF na server…" });

        const buffer = Buffer.from(await file.arrayBuffer());

        const stats = await runPdfAiUploadPipeline(buffer, listName, (event) => {
          send(event);
        });

        send({
          progress: 100,
          stage: "done",
          message: "Uvoz završen",
          done: true,
          ...stats,
        });
      } catch (error) {
        console.error("POST /api/upload-pdf", error);
        send({
          progress: 0,
          stage: "error",
          message: error instanceof Error ? error.message : "Uvoz PDF-a nije uspeo",
          done: true,
          error: true,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
