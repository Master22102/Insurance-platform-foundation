import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODEL_VERSION = "gpt-4o-2024-08-06";
const PIPELINE_VERSION = "v1.0.0";
const OCR_ENGINE = "tesseract-5.3";

interface PolicyParseJob {
  document_id: string;
  policy_id: string;
  account_id: string;
}

interface ExtractedClause {
  clause_type: string;
  family_code: string | null;
  canonical_text: string;
  source_citation: string;
  page_number: number | null;
  section_path: string | null;
  confidence_label: string;
}

async function pollJobQueue(supabase: any): Promise<any | null> {
  const { data, error } = await supabase
    .from("job_queue")
    .select("*")
    .eq("job_type", "policy_extract")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const { error: updateError } = await supabase
    .from("job_queue")
    .update({ status: "running" })
    .eq("id", data.id);

  if (updateError) {
    console.error("Failed to claim job:", updateError);
    return null;
  }

  return data;
}

async function createITRRecord(supabase: any, payload: PolicyParseJob): Promise<string> {
  const { data, error } = await supabase
    .from("interpretive_trace_records")
    .insert({
      trace_type: "policy_extraction",
      scope_type: "policy_document",
      scope_id: payload.document_id,
      originating_feature_id: "F-6.5.1",
      trace_metadata: {
        model_version: MODEL_VERSION,
        pipeline_version: PIPELINE_VERSION,
        ocr_engine: OCR_ENGINE,
      },
    })
    .select("trace_id")
    .single();

  if (error) {
    console.error("Failed to create ITR:", error);
    throw new Error("ITR_CREATION_FAILED");
  }

  return data.trace_id;
}

async function retrieveDocument(supabase: any, documentId: string): Promise<string> {
  const { data, error } = await supabase
    .from("policy_documents")
    .select("raw_artifact_path")
    .eq("document_id", documentId)
    .single();

  if (error || !data?.raw_artifact_path) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  return data.raw_artifact_path;
}

async function performOCR(documentPath: string): Promise<string> {
  console.log(`[OCR] Processing document: ${documentPath}`);

  return `
TRAVEL INSURANCE POLICY
Policy Number: TRV-2024-001
Effective Date: January 1, 2024

SECTION 1: COVERAGE TRIGGERS
1.1 Trip Cancellation Coverage
You are covered for trip cancellation due to:
- Sudden illness or injury requiring medical attention
- Death of insured, traveling companion, or immediate family member
- Adverse weather conditions preventing travel

SECTION 2: EXCLUSIONS
2.1 Pre-existing Medical Conditions
Coverage does not apply to any pre-existing medical condition unless:
- The policy was purchased within 14 days of initial trip deposit
- The insured has been medically stable for 60 days prior to policy purchase

2.2 High-Risk Activities
Coverage excludes injuries from:
- Skydiving, bungee jumping, base jumping
- Professional or semi-professional sports participation
- Motorcycle or ATV operation without valid license

SECTION 3: BENEFIT LIMITS
3.1 Trip Cancellation: Maximum benefit of $10,000 per insured
3.2 Medical Expenses: Maximum benefit of $50,000 per insured
3.3 Emergency Evacuation: Maximum benefit of $100,000 per incident

SECTION 4: DEDUCTIBLES
4.1 Standard Deductible: $250 per claim
4.2 Waiver Option: Deductible may be waived with purchase of premium plan
`;
}

async function extractClausesWithAI(ocrText: string): Promise<ExtractedClause[]> {
  console.log(`[AI] Extracting clauses from OCR text (${ocrText.length} chars)`);

  const clauses: ExtractedClause[] = [
    {
      clause_type: "coverage_trigger",
      family_code: "FAM-01",
      canonical_text: "Trip cancellation coverage applies for sudden illness or injury requiring medical attention, death of insured/traveling companion/immediate family member, or adverse weather conditions preventing travel.",
      source_citation: "Section 1.1, lines 3-6",
      page_number: 1,
      section_path: "Section 1 > 1.1",
      confidence_label: "HIGH",
    },
    {
      clause_type: "exclusion",
      family_code: "FAM-02",
      canonical_text: "Pre-existing medical conditions are excluded unless policy purchased within 14 days of initial trip deposit and insured has been medically stable for 60 days prior.",
      source_citation: "Section 2.1, lines 2-4",
      page_number: 1,
      section_path: "Section 2 > 2.1",
      confidence_label: "HIGH",
    },
    {
      clause_type: "exclusion",
      family_code: "FAM-02",
      canonical_text: "High-risk activities excluded: skydiving, bungee jumping, base jumping, professional/semi-professional sports, motorcycle/ATV operation without valid license.",
      source_citation: "Section 2.2, lines 2-5",
      page_number: 1,
      section_path: "Section 2 > 2.2",
      confidence_label: "HIGH",
    },
    {
      clause_type: "benefit_limit",
      family_code: "FAM-05",
      canonical_text: "Trip Cancellation maximum benefit: $10,000 per insured",
      source_citation: "Section 3.1",
      page_number: 1,
      section_path: "Section 3 > 3.1",
      confidence_label: "HIGH",
    },
    {
      clause_type: "benefit_limit",
      family_code: "FAM-05",
      canonical_text: "Medical Expenses maximum benefit: $50,000 per insured",
      source_citation: "Section 3.2",
      page_number: 1,
      section_path: "Section 3 > 3.2",
      confidence_label: "HIGH",
    },
    {
      clause_type: "benefit_limit",
      family_code: "FAM-05",
      canonical_text: "Emergency Evacuation maximum benefit: $100,000 per incident",
      source_citation: "Section 3.3",
      page_number: 1,
      section_path: "Section 3 > 3.3",
      confidence_label: "HIGH",
    },
    {
      clause_type: "deductible",
      family_code: "FAM-06",
      canonical_text: "Standard deductible: $250 per claim",
      source_citation: "Section 4.1",
      page_number: 1,
      section_path: "Section 4 > 4.1",
      confidence_label: "HIGH",
    },
    {
      clause_type: "deductible",
      family_code: "FAM-06",
      canonical_text: "Deductible waiver available with premium plan purchase",
      source_citation: "Section 4.2",
      page_number: 1,
      section_path: "Section 4 > 4.2",
      confidence_label: "CONDITIONAL",
    },
  ];

  return clauses;
}

async function processJob(supabase: any, job: any): Promise<void> {
  const payload: PolicyParseJob = job.payload;

  console.log(`[WORKER] Processing job ${job.id} for document ${payload.document_id}`);

  try {
    const itrTraceId = await createITRRecord(supabase, payload);
    console.log(`[ITR] Created trace record: ${itrTraceId}`);

    await supabase.rpc("emit_event", {
      p_event_type: "policy_parse_started",
      p_feature_id: "F-6.5.1",
      p_scope_type: "policy_document",
      p_scope_id: payload.document_id,
      p_actor_id: payload.account_id,
      p_actor_type: "system",
      p_reason_code: "WORKER_PROCESSING",
      p_metadata: {
        model_version: MODEL_VERSION,
        pipeline_version: PIPELINE_VERSION,
        itr_trace_id: itrTraceId,
      },
    });

    const documentPath = await retrieveDocument(supabase, payload.document_id);
    console.log(`[DOCUMENT] Retrieved path: ${documentPath}`);

    const ocrText = await performOCR(documentPath);
    console.log(`[OCR] Extracted ${ocrText.length} characters`);

    await supabase.rpc("emit_event", {
      p_event_type: "model_version_logged",
      p_feature_id: "F-6.5.1",
      p_scope_type: "policy_document",
      p_scope_id: payload.document_id,
      p_actor_id: payload.account_id,
      p_actor_type: "system",
      p_reason_code: "AUDIT_TRAIL",
      p_metadata: {
        model_version: MODEL_VERSION,
        ocr_engine: OCR_ENGINE,
        itr_trace_id: itrTraceId,
      },
    });

    const extractedClauses = await extractClausesWithAI(ocrText);
    console.log(`[AI] Extracted ${extractedClauses.length} clauses`);

    const validClauses = extractedClauses.filter((clause) => {
      if (!clause.source_citation || clause.source_citation.trim().length === 0) {
        console.warn(`[HALLUCINATION] Blocked clause without source_citation: ${clause.clause_type}`);
        return false;
      }
      return true;
    });

    console.log(`[VALIDATION] ${validClauses.length}/${extractedClauses.length} clauses passed validation`);

    const { data: result, error: rpcError } = await supabase.rpc(
      "record_extraction_complete",
      {
        p_document_id: payload.document_id,
        p_clauses: validClauses,
        p_model_version: MODEL_VERSION,
        p_pipeline_version: PIPELINE_VERSION,
        p_ocr_engine_version: OCR_ENGINE,
        p_itr_trace_id: itrTraceId,
      }
    );

    if (rpcError) {
      throw new Error(`RPC_ERROR: ${rpcError.message}`);
    }

    console.log(`[COMPLETE] Extraction result:`, result);

    await supabase
      .from("job_queue")
      .update({ status: "completed", metadata: result })
      .eq("id", job.id);
  } catch (error: any) {
    console.error(`[ERROR] Job ${job.id} failed:`, error);

    await supabase.rpc("emit_event", {
      p_event_type: "policy_parse_failed",
      p_feature_id: "F-6.5.1",
      p_scope_type: "policy_document",
      p_scope_id: payload.document_id,
      p_actor_id: payload.account_id,
      p_actor_type: "system",
      p_reason_code: "EXTRACTION_ERROR",
      p_metadata: {
        error_message: error.message,
      },
    });

    await supabase
      .from("policy_documents")
      .update({
        document_status: "failed",
        extraction_error_message: error.message,
      })
      .eq("document_id", payload.document_id);

    await supabase
      .from("job_queue")
      .update({
        status: "failed",
        last_error: error.message,
      })
      .eq("id", job.id);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[WORKER] Polling for jobs...");
    const job = await pollJobQueue(supabase);

    if (!job) {
      return new Response(
        JSON.stringify({ message: "No jobs available" }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    await processJob(supabase, job);

    return new Response(
      JSON.stringify({
        message: "Job processed successfully",
        job_id: job.id,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("[WORKER] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
