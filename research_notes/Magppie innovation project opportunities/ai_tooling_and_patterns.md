# AI tooling (models, agents, retrieval, forecasting, optimisation) and cross-department opportunity patterns — for a solo developer at a mid-size Indian retail/manufacturing company

All prices were checked on 2026-10-21 from the official pages cited, unless marked otherwise. USD is primary. INR figures use an **assumed** rate of about ₹88 per USD. I did not check that rate this session, so treat INR as indicative only. Several vendors announced price changes for Dec 2026 or Jan 2027, and those are flagged.

## 1. Model options and API pricing (text, vision, audio); free tiers; batch and caching; VLM reliability

### Takeaway
In Oct 2026 the cheap tier costs about $0.05–0.30 per million input tokens: Claude Haiku 5.5, OpenAI gpt-6-luna / gpt-5-nano, and Gemini Flash-Lite. Batch APIs cut prices by about 50% at all three vendors, and prompt caching cuts repeated-prefix reads to 5–10% of the input price. Only Google offers a real free API tier, and free-tier data is used to improve Google's products, so do not send customer data through it. Vision models are good at document extraction but still invent plausible values on poor images, so production designs prefer "null + human review" over guessing.

### Cited Findings
**Anthropic (Claude API), per million tokens (MTok)** — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Claude Opus 5.5: input $4, output $20. 5-min cache write $5, 1-h cache write $8, cache hit $0.20 (0.05x input). Batch: $2 in / $10 out.
- Claude Sonnet 5.5: input $2, output $10. Cache hit $0.10 (0.05x). Batch: $1 / $5.
- Claude Sonnet 5: $2 / $10. The launch "introductory" price is now permanent, and the planned Sept 2026 rise to $3/$15 "will not occur".
- Claude Haiku 5.5 (prompts up to 100k tokens): input $0.10, output $0.50, cache hit $0.01. Batch: $0.05 / $0.25. Prompts over 100k tokens cost $0.50 / $2.50.
- Claude Haiku 4.5: $1 / $5. Opus 5 and Opus 4.5–4.8: $5 / $25.
- Top tier: Claude Fable 5.1 and Mythos 5.1 (Mythos has limited availability) cost $10 / $50.
- Batch API discount is 50% on input and output. Caching and batch discounts stack.
- Claude 4.6 and later models include the full 1M-token context at standard pricing (Haiku 5.5 excepted).
- Claude 4.7 and later models use a new tokenizer that produces about 30% more tokens for the same text. Compare cost per task, not just the per-token price.
- Data residency: `inference_geo: "us"` adds a 1.1x multiplier. Global routing is the default. **No India region is listed** for the first-party API.
- Fast mode on Opus 5.5 costs $8 / $40.

**OpenAI, Standard tier per 1M tokens** — [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- Flagship: gpt-6-astra $10 / $50; gpt-6.1-sol $2 input / $0.10 cached input / $10 output; gpt-6-sol $2 / $10; gpt-5.5 $5 / $30; gpt-5.4 $2.50 / $15.
- Mini and nano: gpt-6-luna $0.10 / $0.50 (cached input $0.01); gpt-5-nano $0.05 / $0.40; gpt-4o-mini $0.15 / $0.60.
- Batch and Flex are about half the Standard price. For example, gpt-6-sol drops to $1 / $5.
- Transcription per minute: gpt-transcribe $0.0045, gpt-4o-mini-transcribe $0.003, gpt-4o-transcribe-diarize $0.006, Whisper $0.006.
- Embeddings: text-embedding-3-small $0.02/1M, text-embedding-3-large $0.13/1M.
- Data-residency endpoints carry a 10% uplift for models released on or after 5 Mar 2026.

**Google Gemini API** — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini 2.5 Flash-Lite: $0.10 in / $0.40 out (audio input $0.30). Batch $0.05 / $0.20. Free tier available.
- Gemini 3.1 Flash-Lite: $0.25 / $1.50 (audio input $0.50). Free tier available.
- Gemini 3.5 Flash-Lite: $0.30 / $2.50.
- Gemini 3.6 and 3.8 Flash: $0.75 / $3.75 now, **doubling to $1.50 / $7.50 from 1 Dec 2026**.
- Gemini 4 Argon is paid only: $2 / $10, rising to $4 / $20 after 30 Nov 2026.
- Gemini 3.1 Pro Preview: $2 / $12 for prompts up to 200k tokens.
- Batch discount is about 50% across models.
- Audio: Gemini 3.5 Transcribe costs about $0.003/min of audio input plus about $0.002/min of text output.
- Embeddings: Gemini Embedding 2 is free on the free tier. Paid text is $0.20/1M, batch $0.10/1M. It also embeds images at $0.00012/image.
- **Free-tier content "is used to improve Google's products"; paid-tier content is not.** The pricing page gives no free-tier RPM/RPD numbers; it points to a separate rate-limits page.

**Vision-language reliability for documents and photos**
- A May 2026 receipt-understanding benchmark explicitly penalises hallucinated fields (false positives) as well as missed ones. This shows hallucinated fields are a recognised failure mode. — [alphaXiv 2605.22413](https://www.alphaxiv.org/abs/2605.22413)
- Needl.ai (June 2026) benchmarked 42 extraction libraries and VLMs on text fidelity, omissions, hallucination and table-structure accuracy. The excerpt gave no headline numbers. — [Needl.ai technical note](https://needl.ai/technical-notes/benchmarking-pdf-extraction-tools)
- An informal test (110 runs on a synthetic invoice) found that low-resolution modes often produced plausible but wrong values. This is anecdotal. — [DEV Community](https://dev.to/hidekimori/when-ai-cant-read-it-invents-but-it-still-sees-the-shape-18ac)
- BILL's production invoice extraction prefers a null over a wrong value and sends nulls to manual review. — [BILL engineering](https://www.bill.com/engineering/hyper-accurate-invoice-extraction-for-supplier-payments-plus)
- Qwen3-VL reportedly scores 96.5% on DocVQA. This is a general benchmark, dated Dec 2025, from a secondary source. — [Codesota guide](https://www.codesota.com/guides/invoice-processing-vllm)

### Inferences
- **Indicative cost of a high-volume job:** classify 10,000 WhatsApp or CRM notes a month at about 1,000 input + 200 output tokens each (10M in + 2M out). On Haiku 5.5 batch, that is 10 × $0.05 + 2 × $0.25 = **about $1/month (about ₹88)**. On Sonnet 5.5 standard, it is 10 × $2 + 2 × $10 = **about $40/month (about ₹3,500)**. At this company's scale, model cost is rarely the constraint; data access and adoption are.
- Use cheap models (Haiku 5.5, gpt-5-nano, Flash-Lite) for bulk tagging and extraction. Use Sonnet or Opus for narratives and reasoning over messy records.
- Do not put customer personal data through Gemini's free tier, because free-tier content is used to improve Google's products.
- For document AI, build a field-level eval set of 50–100 real Magppie quotes and invoices. Require a confidence or null output and a human check before figures flow downstream.

### Gaps
- Open-weight models (Llama, Qwen, Gemma): I did not verify current 2026 versions, licences or hosting costs (e.g., Groq, Together, OpenRouter, Ollama on local hardware).
- OpenAI vision and image input pricing details, and OpenAI free tiers, were not captured.
- No authoritative, recent, invoice-specific accuracy figure per model was found.
- Anthropic offers no free API tier per the pricing page. I did not check whether there are startup credits.

## 2. Agent orchestration, workflow engines, human-in-the-loop, observability, and free-tier limits

### Takeaway
For a solo developer already on Supabase and Vercel, the lowest-overhead stack is: Supabase (Postgres + pg_cron + Edge Functions) for scheduled and triggered jobs, Vercel Workflows or Cron for durable multi-step flows, and Claude or OpenAI tool-use loops written in code, with a Postgres "approval queue" table for human-in-the-loop steps. Self-hosted n8n is legally fine for internal use and suits integrations that operations staff can see. Langfuse is free to self-host (MIT) or free at 50k units/month in its cloud.

### Cited Findings
- **Supabase Free:** 500 MB database per project, 5 GB egress, 50,000 MAU, 500,000 Edge Function invocations, 1 GB file storage, 2 active projects. **Projects pause after 1 week of inactivity.** — [Supabase pricing](https://supabase.com/pricing)
- **Supabase Pro:** from $25/month. 8 GB disk, then $0.125/GB. 250 GB egress. 100k MAU. 2M Edge invocations, then $2 per million. Includes $10 compute credit (covers one Micro instance). No pausing. Compute add-ons: Small $15/month (2 GB RAM), Medium $60 (4 GB), Large $110 (2 dedicated vCPU, 8 GB). — [Supabase pricing](https://supabase.com/pricing)
- **Supabase regions:** the official regions page lists South Asia (Mumbai), ap-south-1. — [Supabase regions](https://supabase.com/docs/guides/platform/regions)
- **Vercel Hobby (free):** 1M function invocations, 4 h Fluid Active CPU, 100 GB data transfer per month. The FAQ says Hobby is "for personal, non-commercial use", so internal company systems should be on **Pro: $20/month, which includes a $20 usage credit**. — [Vercel pricing](https://vercel.com/pricing)
- **Vercel Workflows:** Hobby includes 50k events/month; Pro costs $20 per 1M events. Queues (beta): Pro from $0.60 per 1M operations. — [Vercel pricing](https://vercel.com/pricing)
- **n8n Sustainable Use License:** use and modification are allowed "only for internal business purposes" or non-commercial use. Running it on an internal company server is explicitly fine. Reselling it as SaaS, or collecting end users' own credentials to sync their data, is not. Enterprise features (SSO, advanced user management) fall under a separate Enterprise licence. — [n8n license docs](https://docs.n8n.io/n8n-community-license/sustainable-use-license); [n8n license FAQ](https://docs.n8n.io/n8n-community-license/community-license/license-faq.md)
- **Langfuse:**
  - Cloud Hobby is free: 50k units/month, 30-day data access, 2 users.
  - Self-hosting is MIT-licensed, with no usage fee on any tier.
  - ClickHouse acquired Langfuse in January 2026.
  - Third-party summaries list Core at $29/month and Pro at $199/month; some older pages list conflicting $59 figures.
  - Self-hosting needs Postgres, ClickHouse, Redis and S3-compatible storage.
  - Sources: [Langfuse clarifications](https://langfuse.com/resources/engineering/clarifications); [ZenML on Langfuse pricing](https://www.zenml.io/blog/langfuse-pricing); [Metavert comparison](https://metavert.io/compare/langsmith-vs-langfuse)

### Inferences
- Supabase Free's one-week pause and 500 MB limit rule it out for anything staff depend on daily. Budget **Supabase Pro ($25, about ₹2,200/month) plus Vercel Pro ($20, about ₹1,760/month)** as the production baseline, about $45 (about ₹4,000) a month before LLM usage.
- Human-in-the-loop pattern that fits this stack:
  - The agent writes a proposed action (draft message, schedule, record update) to an `approvals` table.
  - A manager approves it in the existing internal web app.
  - A database trigger or Edge Function then executes it. This keeps a full audit trail in Postgres.
- Self-hosting Langfuse needs ClickHouse, Redis and S3, which is heavy for one person. The free cloud Hobby tier (or tracing into a Postgres table) is likely enough at first. Check DPDP implications before sending traces that contain personal data to an external cloud.

### Gaps
- I did not fetch the current docs or pricing for the Claude Agent SDK, LangGraph (and LangGraph Platform pricing), Temporal Cloud, Inngest free-tier limits, or Supabase pg_cron / Edge Function wall-clock limits. The report should check them before recommending any of these.
- Vercel Hobby cron count and frequency limits were not on the pricing page.
- I did not confirm whether Supabase guarantees backups and replicas stay in Mumbai.

## 3. Retrieval and knowledge (pgvector, embeddings, document AI)

### Takeaway
Embeddings are effectively free at this scale. OpenAI text-embedding-3-small costs $0.02 per million tokens, and Gemini Embedding 2 has a free tier and can also embed images. pgvector on Supabase Pro (Mumbai region available) avoids adding another vendor. Document AI for quotes, drawings and invoices is best built as VLM extraction with schema validation and human review of uncertain fields.

### Cited Findings
- Embedding prices: OpenAI text-embedding-3-small $0.02/1M, 3-large $0.13/1M. — [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- Gemini Embedding 2: free tier; paid text $0.20/1M (batch $0.10); images $0.00012 each; audio and video also supported. — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Supabase Mumbai region exists (ap-south-1). — [Supabase regions](https://supabase.com/docs/guides/platform/regions)
- Production invoice extraction prefers precision, routing nulls to manual review. — [BILL engineering](https://www.bill.com/engineering/hyper-accurate-invoice-extraction-for-supplier-payments-plus)

### Inferences
- Indicative cost: embedding 5,000 documents of about 2,000 tokens each (10M tokens) costs about $0.20 once with text-embedding-3-small.
- Multimodal embeddings (Gemini Embedding 2) could support "find similar kitchen designs or store photos" search across catalogue and site images. This is untested for Magppie's content.

### Gaps
- pgvector version and HNSW support on Supabase in 2026, and recommended index sizes for the Pro tier, were not verified this session.
- No evaluated benchmark was found for VLMs reading technical drawings (CAD/elevation PDFs). Treat it as experimental.

## 4. Forecasting and optimisation with small data

### Takeaway
Classical statistical forecasting (StatsForecast's ETS/ARIMA family) is fast and, in its vendor's own benchmarks, more accurate than Prophet. It is a sensible default for SKU, store or lead-volume forecasts on a few years of data. OR-Tools CP-SAT is competitive on job-shop and project scheduling. I found few published small-manufacturer case studies with measured results, so ROI claims must come from Magppie's own pilots.

### Cited Findings
- **StatsForecast vs Prophet on M5 (30,490 series):**
  - Weighted RMSSE: 0.68 for StatsForecast (ETS) vs 0.77 for Prophet. Lower is better.
  - Runtime: 5.48–7.5 min vs 18.23 min for Prophet.
  - These are vendor-run benchmarks, and the two Nixtla pages report different runtimes.
  - Sources: [Nixtla M5 ETS](https://nixtlaverse.nixtla.io/statsforecast/docs/experiments/ETS_ray_m5); [Nixtla Prophet-Spark M5](https://nixtlaverse.nixtla.io/statsforecast/docs/experiments/prophet_spark_m5.html)
- Older Nixtla M4-Daily claims: "500x faster than Prophet"; Prophet MASE 14.26. Vendor results. — [PyPI statsforecast 0.5.x](https://pypi.org/project/statsforecast/0.5.4/)
- An independent job-shop benchmark (PyJobShop) found OR-Tools "highly competitive on job shop scheduling and project scheduling", while CP Optimizer did better on permutation and large-scale problems. — [arXiv 2502.13483](https://web3.arxiv.org/pdf/2502.13483)
- A 2026 journal study found CP-SAT "much faster than MILP for wide problems" (many parallel sequences) in flexible manufacturing models, and evaluated it on an industrial-sized system. — [Chalmers research](https://research.chalmers.se/en/publication/553365)
- Elder Research used OR-Tools to schedule each production line at an underperforming consumer-goods plant. No before/after metrics were published. — [Elder Research](https://www.elderresearch.com/?p=5428)

### Inferences
- Candidate uses:
  - Forecasting: lead volume or showroom footfall by city, and component demand for production planning.
  - CP-SAT: installation-crew and site-visit scheduling (a vehicle-routing problem with time windows) and factory job sequencing.
- With small or irregular data, start with simple baselines (seasonal naive, ETS) and measure the error before trying ML.
- Survival and propensity models for the sales pipeline (time-to-close, probability of conversion) are standard techniques that fit CRM data. I found no SMB evidence for them this session.

### Gaps
- No documented SMB (or Indian SMB) case study with measured forecasting or scheduling savings was found.
- I did not research survival/propensity models (lifelines, scikit-survival) or OR-Tools VRP case results.

## 5. Cross-department patterns and why AI pilots fail

### Takeaway
The strongest evidence says value comes from **redesigning workflows**, not from bolting on generic tools. McKinsey's roughly 6% of "high performers" are about 3x more likely to fundamentally redesign workflows. MIT NANDA attributes the reported "95% no measurable return" mainly to brittle workflows, poor fit with daily operations and a "learning gap", not to model quality. Process mining of order-to-cash logs is well established. Most public PM4Py studies are academic or student projects rather than quantified SMB deployments.

### Cited Findings
- **MIT NANDA, "The GenAI Divide: State of AI in Business 2025" (July/Aug 2025):**
  - About 95% of organisations studied saw no measurable P&L return from GenAI. About 5% of pilots achieved rapid revenue acceleration.
  - Causes cited are implementation problems (brittle workflows, poor fit with operations, a "learning gap") rather than model quality.
  - Sample-size reports conflict. Fortune cites 150 interviews, 350 employees surveyed and 300 deployments analysed; another summary of the report cites 52 organisations and 153 leaders.
  - The figure is from a preliminary research programme, not a universal failure rate.
  - Sources: [Fortune](https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/); [Computing](https://computing.co.uk/news/2025/ai/mit-report-95pc-corporate-generative-ai-pilots-fail); [Let's Data Science](https://letsdatascience.com/news/mit-report-documents-genai-pilot-roi-gap-e0924d7d)
- **McKinsey State of AI 2025:**
  - High performers (at least 5% of EBIT attributed to AI, about 6% of respondents) are nearly 3x as likely to fundamentally redesign workflows.
  - Workflow redesign is "one of the strongest contributions to achieving meaningful business impact" of all factors tested.
  - Coverage reports 88% of organisations use AI in at least one function, but most are stuck in pilots.
  - The findings are correlational.
  - Sources: [McKinsey](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2025); [Silicon Canals summary](https://siliconcanals.com/m-mckinseys-2025-global-ai-survey-88-of-organizations-now-use-ai-in-at-least-one-function-up-from-78-but-most-are-still-stuck-in-pilot-mode-and-only-a-minority-can-point-to-any-real-impact/)
- **Process mining with PM4Py (FairPrice Online order-to-cash, student capstone):**
  - 95.44% of cases followed the standard flow; 4.52% of records lacked "Payment Received".
  - Average completion time was 71 hours.
  - FairPrice is a large retailer, and this is not a production deployment.
  - Source: [SMU capstone](https://accountancy.smu.edu.sg/sites/accountancy.smu.edu.sg/files/student-projects/2024-09/G2%20FairPrice%20Group%20I.pdf)
- PM4Py methodology case study. — [arXiv 2409.11294](https://arxiv.org/pdf/2409.11294)
- **Paulig order-to-cash (Chalmers thesis, 2026, using Infor's process mining tool rather than PM4Py):** bottlenecks traced to master-data issues that caused manual interventions and longer cycle times. — [Chalmers ODR](https://odr.chalmers.se/items/02475560-cd4a-4cf7-9393-b25ea6fbc8da)

### Inferences
- **"Capture once, reuse downstream":** this is the pattern most aligned with McKinsey's workflow-redesign finding. Example: a structured site-visit capture (photos, measurements, voice note) that the AI turns into design brief fields, a quote draft and production inputs. It removes re-keying, which matches Paulig's lesson that master-data issues drive manual intervention. This is an inference; I found no specific measured case.
- **Process mining on Zoho CRM:** CRM stage-change and activity timestamps form a natural event log (case = lead/deal, activity = stage, timestamp). PM4Py (open source) can find rework loops and stage-to-stage delays at no licence cost. It suits the existing presales turnaround work in this repo.
- **Automated management-review narratives:** a low-risk first agent use case. The figures come from SQL, and the LLM writes only the commentary, with links back to the records behind each figure. Cost is negligible (see section 1).
- **Pilot-failure lessons to apply:**
  - Embed outputs inside existing daily tools, not in a separate chatbot.
  - Pick one workflow with an owner and a baseline metric.
  - Design for feedback and learning (the MIT "learning gap").

### Gaps
- I found no credible, measured case studies this session for:
  - voice-of-customer mining from WhatsApp or reviews;
  - AI-assisted SOP or tacit-knowledge capture from senior staff;
  - a store digital twin;
  - BCG's 2025 AI value study.
  The report should present these as plausible patterns, not proven ones.
- No PM4Py SMB deployment with before/after business metrics was found.

## 6. India: DPDP Act 2023 and DPDP Rules 2025 when using foreign LLM APIs; data residency

### Takeaway
The DPDP Rules were notified on 13 Nov 2025, and most operational obligations apply from **13 May 2027**. That leaves about 7 months from today to be compliant. Cross-border transfers are **permitted by default unless the Central Government restricts specific countries** (Rule 15), so using US-hosted LLM APIs is not prohibited per se. Magppie remains the data fiduciary and needs a valid purpose or consent, reasonable security safeguards, processor contracts, and breach notification.

### Cited Findings
- **Notification and timing:**
  - Notified 13 Nov 2025 (one source says 14 Nov).
  - Rules 3, 5–16, 22 and 23 apply after an 18-month runway, on 13 May 2027.
  - Consent-manager provisions apply from Nov 2026.
  - Sources: [Bar & Bench](https://www.barandbench.com/view-point/meity-notifies-final-digital-personal-data-protection-rules-2025); [Hogan Lovells](https://www.hoganlovells.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force-); [SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/)
- **Conflict on cross-border timing:** Mondaq says the cross-border provisions apply immediately from 13 Nov 2025; Hogan Lovells lists them under 13 May 2027. — [Mondaq](https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified) vs [Hogan Lovells](https://www.hoganlovells.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force-)
- **Rule 15:**
  - The government may restrict transfers to specified countries by notification; transfers are otherwise allowed.
  - Significant Data Fiduciaries may face limits on sending certain data abroad.
  - Sources: [Mondaq](https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified); [Truyo](https://truyo.com/?p=8832)
- **Breach notification:** includes a 72-hour report to the Data Protection Board. Sources disagree on whether individuals must also be told within 72 hours or "without delay". — [Thales brief](https://cpl.thalesgroup.com/sites/default/files/content/compliance_brief/india-dpdp-rules-2025-compliance-guide-cb.pdf); [Nishith Desai (on the draft)](https://www.nishithdesai.com/fileadmin/user_upload/Html/Hotline/Technology_Law_Analysis_Jan0625-M.html)
- **Penalties:** up to ₹250 crore for failing to maintain reasonable security safeguards, and up to ₹200 crore for failing to report a breach. These figures come from a vendor brief and should be verified against the Act. — [Thales brief](https://cpl.thalesgroup.com/sites/default/files/content/compliance_brief/india-dpdp-rules-2025-compliance-guide-cb.pdf)
- **Data residency options:**
  - Anthropic's first-party API offers only global or US routing (US costs 1.1x). — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
  - OpenAI's regional-processing endpoints cost +10%. — [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
  - Supabase offers Mumbai for data at rest. — [Supabase regions](https://supabase.com/docs/guides/platform/regions)

### Inferences
- **Practical posture:**
  - Keep the system of record in Supabase Mumbai.
  - Send minimised or pseudonymised text to LLM APIs: strip phone numbers and addresses, and use record IDs.
  - Use paid tiers only, since free-tier data may be used for training.
  - Keep a processor list and the vendors' data processing agreements (DPAs).
  - Log which personal data goes to which model.
  - Update the privacy notice to cover AI processing purposes before May 2027.
- An India-region deployment of Claude, OpenAI or Gemini through a cloud provider (e.g., Bedrock, Vertex AI or Azure in Mumbai) may give in-country inference. This was not verified this session.

### Gaps
- I did not read the official MeitY gazette text. Exact processor obligations, the security-safeguard wording and the cross-border effective date need checking against the primary source.
- I did not verify whether Bedrock, Vertex AI or Azure offer Claude, Gemini or GPT inference in Indian regions in 2026.
