# Sales, Showroom and Customer-Experience Technology for a Premium Indian Kitchen Brand (as of Oct 2026)

Scope: lead management, presales, showroom experience, design visualization, quotation and customer communication, for a brand on Zoho CRM with showrooms and presales managers, built by one developer in India. Research date: 21 Oct 2026. About 15 searches and fetches. Many sources are vendor pages, and each finding below says so.

## Conversation intelligence: speech-to-text for Hindi/English/Hinglish, telephony recording, pricing, consent law

### Takeaway
Indian speech-to-text is cheap and available today through official APIs. Sarvam charges ₹30 per audio hour, or ₹45 with speaker diarization. However, no independent public benchmark compares the main vendors on Hinglish (Hindi-English code-mixed) speech, so Magppie would need to test on its own recordings. Exotel includes call recording in its plans. The DPDP Rules were notified on 14 Nov 2025, and most obligations are phased in by about May 2027, so building notice-and-consent into recording now is the safe design.

### Cited Findings
- **Sarvam AI official pricing.** Speech-to-text is ₹30/hr; with diarization ₹45/hr; speech-to-text plus translate ₹30/hr; translate plus diarization ₹45/hr. Billing is per second. Text-to-speech (Bulbul v3) is ₹30 per 10K characters. The Sarvam 105B LLM costs ₹15 per 1M input tokens and ₹60 per 1M output tokens. New users get ₹100 of free credit. Rate limits are on a separate page. — [Sarvam pricing](https://docs.sarvam.ai/api/pricing)
- **Sarvam accuracy (vendor-reported).** Saarika reports a word error rate (WER) of 18.32% averaged across 11 languages, 8.26% for English and 11.81% for Hindi, on the VISTAAR benchmark. The same page marks Saarika v2.5 as legacy. No Hinglish-specific WER is published. — [Sarvam Saarika docs](https://docs.sarvam.ai/api/models/saarika); a third party says the ₹30/hr rate applies to real-time, streaming and batch alike, and that enterprise rates are not public — [smallest.ai blog](https://smallest.ai/blog/sarvam-ai-speech-to-text-pricing) (a competitor's blog)
- **Multi-vendor code-switching test (secondary report, language pairs unclear).** Seven systems were compared: ElevenLabs Scribe V2, Gemini 3 Flash, AssemblyAI Universal-3 Pro, Deepgram Nova-3, Mistral Voxtral, Nvidia Parakeet and Whisper Large V3 Turbo. Scribe V2, Gemini 3 Flash and AssemblyAI ranked as leaders, and Whisper dropped notably on code-switched speech. The report does not confirm that Hinglish was tested. — [hyper.ai report](https://hyper.ai/de/stories/92ac31968c0bdfc8d4d549d882019d34)
- **Telephone-quality Hinglish (vendor research).** On 8 kHz phone audio, Gnani.ai reports a WER at switch points of 48.7% for a cascade system versus 19.3% for its own unified model. It notes Whisper handles code-switching reasonably well on clean benchmarks. — [Gnani.ai research](https://gnani.ai/resources/research/code-switching-at-8khz)
- **Deepgram.** Deepgram promotes Nova-3 multilingual mode for Hindi-English switching. A third party reports a roughly 34% relative cut in batch WER in a March 2026 update. Neither claim is independently verified. — [Deepgram Hinglish guide](https://deepgram.com/learn/hinglish-voice-ai-speech-recognition); [softcery](https://softcery.com/lab/multilingual-code-switching-voice-agents.md)
- **AssemblyAI.** Its documented code-switching for recorded audio covers English plus Spanish, Portuguese, French, German and Italian. Hindi is not in that list. — [convertaudiototext blog citing AssemblyAI](https://convertaudiototext.com/blog/fix-multilingual-code-switching)
- **Whisper output script (anecdotal).** Whisper often writes English loanwords in Devanagari script in Hinglish audio. There are also reports of Nova-3 multi misreading Hindi as Spanish. — [convertaudiototext](https://convertaudiototext.com/de/blog/hindi-transcription-code-switching)
- **Exotel.** Call recordings are included in all plans. Credits work at 1 credit = ₹1, and a listed plan shows 39,000 credits. Voice streaming is sold separately. — [Exotel pricing](https://exotel.com/pricing/business-phone-system/)
- **Exotel's Zoho CRM app.** The Zoho Marketplace extension offers click-to-call, SMS and call history inside Leads and Contacts. Its fair-use policy allows 300 API hits per day, with extra hits at 15 paise each. — [Zoho Marketplace Exotel app](https://marketplace.zoho.com/app/crm/exoteltelephonyapp)
- **Integrator pricing (one third-party quote).** One integrator charges ₹25K for setup with recording plus a webhook to your backend, or ₹75K for a production tier with Zoho integration and retention/compliance. Exotel's own platform fees are extra. — [Edesy](https://edesy.in/services/exotel-integration-india). A user review calls Exotel's Zoho integrations "a bit costly" — [GetApp](https://www.getapp.co.uk/reviews/2049507/exotel)
- **DPDP Rules timeline.** The Rules were notified on 14 Nov 2025. Rules 1, 2 and 17–21 apply immediately. Rule 4 (consent managers) applies after 1 year. Rules 3, 5–16, 22 and 23 apply after 18 months. — [Storyboard18](https://www.storyboard18.com/amp/digital/breaking-govt-notifies-final-dpdp-rules-sets-staggered-rollout-with-key-obligations-for-data-fiduciaries-84201.htm); full compliance is about May 2027 — [Mondaq](https://www.mondaq.com/india/privacy-protection/1708830/dpdp-act-compliance-mandate); the official text is in the [PIB PDF](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)
- **Consent notices.** A notice must be clear, standalone and state the specific purpose. Consent can be withdrawn, including through consent managers. — [PIB](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf); [Outlook Business](https://www.outlookbusiness.com/technology/govt-notifies-dpdp-rules-experts-flag-need-for-data-mapping-consent-systems). Commentary says vague purposes like "business improvement" are unlikely to qualify as specific — [KSK](https://ksandk.com/data-protection-and-data-privacy/dpdp-act-consent-rules/)
- **Measured results for conversation intelligence are thin and vendor-sourced.** Shyena/Inteliconvo reports a 1.5% sales uplift within 12 weeks in a banking/financial-services case — [Intel NetworkBuilders PDF](https://networkbuilders.intel.com/docs/networkbuilders/enhancing-business-performance-with-an-ai-driven-speech-analytics-platform-shyena-1719913654.pdf). DashVoice claims +25% conversion for Indian retail with no named customer — [DashVoice](https://dashloc.com/dashvoice). A US Caterpillar dealer reports +76% conversions — [Convirza](https://www.convirza.com/content-hub/conversation-analytics-transforms-business/)

### Inferences
- For a solo developer, a workable pipeline is: Exotel (or a mobile recorder app) records the call; a webhook sends the file to Sarvam batch speech-to-text with diarization; an LLM summarizes and scores against a presales checklist; the result is written back to the Zoho Lead or Deal as a Note or fields. At ₹45/hr, 500 hours of calls a month would cost about ₹22,500 in transcription. That is my arithmetic, not a vendor quote.
- Showroom (in-person) conversations are harder to process than phone calls. They need a far-field microphone or the salesperson's phone, they have more noise and more speakers, and they raise a sharper consent question. Phone calls are the lower-risk first target.
- Because no Hinglish benchmark exists, the practical first step is a 2-day bake-off. Hand-transcribe about 30 minutes of real Magppie calls as a reference, then compare Sarvam, Deepgram Nova-3 multi, Gemini and ElevenLabs Scribe on WER and on extraction of entities such as budget, timeline and objections.
- A spoken recording notice at call start plus an opt-out path, logged in CRM, fits the DPDP purpose-specific notice principle. This is an inference; it is not legal advice.

### Gaps
- Not checked this session: official per-minute pricing for Deepgram, AssemblyAI, Google Chirp 3 and OpenAI transcription; Knowlarity and Ozonetel pricing; Zoho PhoneBridge recording-API details.
- No independent Hinglish WER benchmark found.
- The DPDP Rules text was not checked for any specific call-recording provision. No source addressed call recording directly.
- No Indian, showroom-specific case study of conversation intelligence with measured results was found.

## Showroom/retail analytics: footfall and dwell time from existing CCTV

### Takeaway
Footfall, zone dwell time and heatmaps can be produced from existing IP cameras over RTSP streams, and Indian vendors sell this at about ₹800–1,200 per camera per month. The published uplift figures are vendor marketing. The tools are technically easy to build yourself, but two constraints matter. First, Ultralytics YOLO is AGPL-licensed and its owner says internal commercial use needs an Enterprise license. Second, DPDP makes facial or demographic analytics risky, so anonymous counting and heatmaps are the defensible scope.

### Cited Findings
- **Agrex AI (AIVIS, India).** Uses existing camera RTSP streams for footfall counting, demographic estimation, dwell time, queue measurement and heatmaps. Pricing is about ₹800 per camera per month, within a stated ₹800–1,200 range. It claims +17% conversion, +14% footfall and –26% queue wait within 11 weeks, a 32% average conversion uplift and 10–40x first-year ROI, while noting results vary by store. These are marketing claims. — [Agrex footfall India guide](https://www.agrexai.com/footfall-analytics-india-2026-guide/); [Agrex retail footfall](https://www.agrexai.com/retail-footfall-analytics/)
- **Unsourced statistics on Agrex pages.** Its pages cite an NRF figure that 73% of top retailers use AI footfall tracking, and a "RetailNext 2.3x" figure, with no primary source given. Do not reuse these. — [Agrex](https://www.agrexai.com/retail-video-analytics-india-2026/)
- **Independent view.** A non-vendor piece makes the general case that footfall and dwell analytics from CCTV already installed turns security cameras into a commercial insight source. It has no India data. — [Manchester Digital](https://www.manchesterdigital.com/post/ve3/footfall-and-dwell-time-analytics-from-the-cctv-you-already-own)
- **Ultralytics licensing.** AGPL-3.0 requires open-sourcing the whole project. Ultralytics' page says internal business tools, SaaS and embedded uses need an Enterprise license, even with self-trained weights. Pricing is quote-only. — [Ultralytics license](https://ultralytics.com/license)
- **AI-enabled CCTV and DPDP.** The government confirmed in 2026 that AI-enabled CCTV is covered by the DPDP Rules. — [MediaNama Apr 2026](https://www.medianama.com/2026/04/223-govt-ai-enabled-cctv-cameras-dpdp-rules/). An expert view says individual express consent for CCTV is "not feasible", and the Act has no CCTV-specific mechanism — same source / [MediaNama DPDP](https://www.medianama.com/dpdp)
- **Facial analytics in retail.** A compliance-site analysis says stores cannot process customers' facial biometrics for marketing without explicit prior consent, which is hard to obtain in open retail. It suggests non-facial zone heatmapping instead. — [dpdpa.com FRT article](https://www.dpdpa.com/blogs/facial_recognition_technology_frt_dpdpa_india.html). Penalties can reach ₹250 crore — [MediaNama](https://www.medianama.com/2026/04/223-govt-ai-enabled-cctv-cameras-dpdp-rules/)

### Inferences
- For a premium kitchen showroom with a few visitors per hour, raw footfall counts matter less than linking a visit to a CRM lead: did a booked appointment turn up, how long did they stay, which display zones did they spend time at. A low-tech route is a tablet check-in at reception that creates or updates the Zoho record. Pairing it with anonymous camera-based counts would show the gap between walk-ins and logged leads. The share of walk-ins never logged in CRM is a likely high-value metric.
- For a do-it-yourself computer-vision build, consider detectors with permissive licenses such as RT-DETR or YOLOX (Apache) instead of Ultralytics. ByteTrack's licence was not verified this session.
- A design limited to anonymous counting, with no face storage and only aggregate output, plus visible signage, is the lowest-risk approach under DPDP. This is an inference, not legal advice.

### Gaps
- No independent accuracy audits of CCTV footfall vendors. No other Indian vendors were compared, for example Vehant, Videonetics or Staqu; none were searched.
- ByteTrack's licence and people-counting accuracy on typical Indian CCTV hardware were not verified.
- No published case study links showroom dwell time to conversion in furniture or kitchen retail.

## Lead scoring, next-best-action, Zoho CRM API limits, WhatsApp Business Platform pricing

### Takeaway
Zoho's API is generous for a single-company integration. Credits are 50K plus a per-user allowance per rolling 24 hours, COQL returns up to 2,000 rows per call and up to 100K rows per criteria, and Bulk Read handles anything larger. Zoho's built-in Zia Scores (as of a 2023 post) needed Enterprise edition, more than 20 users and at least 200 records. WhatsApp has billed per delivered template message since 1 Jul 2025. In India, marketing templates cost about ₹0.86 and utility/authentication about ₹0.115. Free-form and utility messages inside the 24-hour service window are free, though one source reports a possible change from Oct 2026 that I could not confirm.

### Cited Findings
- **Zoho API credits (rolling 24 hours).** Most calls cost 1 credit; Convert Lead costs 5. Limits by edition:
  - Standard: 50K + 250 per user, capped at 100K
  - Professional: 50K + 500 per user, capped at 3M
  - Enterprise/Zoho One: 50K + 1,000 per user, capped at 5M
  - Ultimate: 50K + 2,000 per user, no cap
  — [Zoho API limits v5](https://www.zoho.com/crm/developer/docs/api/v5/api-limits.html?crmprod=1). The EU and v8 pages show different figures, so check the page for your data center and API version — [Zoho EU](https://www.zoho.eu/crm/developer/docs/api/api-limits.html); [v8](https://prezohoweb.zoho.com/crm/developer/docs/api/v8/api-limits.html)
- **Concurrency (secondary source).** Concurrent calls range from 5 on Free to 25 on Ultimate, with a sub-limit of 10 for operations such as Convert Lead, insert/update and search. Writes are capped at 100 records per call. — [rollout.com](https://rollout.com/integration-guides/zoho-creator/api-essentials)
- **COQL.** LIMIT defaults to 200 and maxes at 2,000. Pagination reaches up to 100,000 records per unique criteria; beyond that, use Bulk Read. A query can select up to 500 fields and have up to 25 WHERE criteria. Lookup traversal works, and the docs show a two-level example. SUM, AVG, COUNT, MIN, MAX, GROUP BY and ORDER BY are supported. Cost is 1 credit for up to 200 rows, 2 for 201–1,000 and 3 for 1,001–2,000. — [Zoho COQL overview v8](https://www.zoho.com/crm/developer/docs/api/v8/COQL-Overview.html)
- **Zia Scores (2023 post, may be outdated).** Needs at least 200 records. Available only for Leads and Deals, and only on Enterprise/Ultimate editions with more than 20 user licenses. — [Zoho community](https://help.zoho.com/portal/es/community/topic/introducing-zia-scoring-28-2-2023?page=1). Prediction Builder works on any module, but its record minimum is not stated — [Zoho Zia predictive AI](https://www.zoho.com/agents/resources/help/conceptual-articles/zia-predictive-ai.html)
- **WhatsApp official billing model (Meta docs, updated 30 Mar 2026).**
  - Per-message billing since 1 Jul 2025, charged only when a template is delivered. Rates depend on template category and the recipient's country code.
  - Non-template messages are free, but can only be sent inside an open customer service window.
  - Utility templates are free inside that window.
  - Lower utility and authentication rates unlock with volume.
  - Everything, including templates, is free for 72 hours in a free entry point window opened from Click-to-WhatsApp ads or Facebook Page calls to action.
  — [Meta WhatsApp pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- **India rates (secondary sources).** Marketing is about ₹0.8631 per message from 1 Jan 2026, up roughly 10% from ₹0.7846. Utility and authentication are about ₹0.115. GST at 18% and the BSP markup come on top. INR billing localisation began 1 Jan 2026, and accounts must move to it by 31 Dec 2026. — [baat.ai](https://baat.ai/blog/whatsapp-api-pricing-india); [Monty Mobile](https://montymobile.com/blogs/whatsapp-business-api-pricing-in-india-inr-rates-gst-and-the-2026-currency-migration-deadline). An outlier lists utility at ₹0.35 and authentication at ₹0.26 — [CampaignHQ](https://blog.campaignhq.co/?p=3457)
- **Disputed October 2026 change.** respond.io says that from 1 Oct 2026, service messages and in-window utility templates become chargeable, with the first 1,000 service messages per number per month free. — [respond.io](https://respond.io/blog/whatsapp-pricing-change-2026). Unipile says there is no monthly free tier in 2026 — [Unipile](https://www.unipile.com/is-the-whatsapp-api-free/). This is unresolved, and I could not reach Meta's live page to check it.
- **Volume discounts.** Up to 20% off on high utility and authentication volume, per a third party. — [YCloud](https://www.ycloud.com/blog/whatsapp-api-pricing)

### Inferences
- With a lead volume typical of a premium brand (hundreds to low thousands per month), a machine-learned score will be noisy. A transparent rules-plus-LLM score is likely to beat it: signals such as site-visit booked, budget band, possession date, response latency, and a summary of call content. It can be refreshed through COQL pulls and written back to Zoho custom fields well within the credit limits.
- For next-best-action, a daily COQL job can flag stale leads, missing follow-ups and unanswered WhatsApp chats per presales manager. This fits the existing "Morning review" and PSM health work in the Monitoring_review repo.
- On WhatsApp costs, a utility template such as an appointment reminder or design-ready notice costs about ₹0.115 plus GST. Marketing nudges cost about 7.5x more. Classifying templates correctly as utility (transactional, tied to a user action) matters for cost.

### Gaps
- Meta's official India rate card could not be fetched (connection reset), so India rates come from BSP blogs.
- Zoho webhook and notification-API limits, and Prediction Builder's minimum records and editions, were not found.
- Meta's template category rules (for example, automatic recategorisation of utility templates to marketing) were not fetched this session.
- No credible case study of small-data lead scoring in interiors was found.

## Design visualization and quotation: generative re-rendering, 3D configurators, CPQ (configure-price-quote), auto-quotes

### Takeaway
Image-editing models can re-render a site photo for about US$0.03–0.05 per image through official APIs: Gemini 2.5 Flash Image about $0.039, FLUX.1 Kontext Pro about $0.04–0.05, GPT Image about $0.034–0.042. This makes a "your kitchen in Magppie finishes" preview in presales cheap. Indian interiors players claim big gains from visualization tools, but every number is self-reported. Western configurator and CPQ vendors (VividWorks, ArchiLabs, AR-Range, Combeenation) show automatic BOM and quote generation, but none is India-specific.

### Cited Findings
- **Image-editing prices (aggregators; check official pages).** Gemini 2.5 Flash Image is about $0.039 per image, or token pricing of $0.30 per 1M input and $2.50 per 1M output on Vertex AI — [cloudprice](https://cloudprice.net/models/gemini-2.5-flash-image); [getmaxim](https://www.getmaxim.ai/bifrost/llm-cost-calculator/provider/gemini/model/gemini-2.5-flash-image.md). Flux Kontext Pro is $0.050 per image — [Grida](https://canary.grida.co/ai/models) — or $0.04 per the official BFL price quoted by [apiyi](https://help.apiyi.com/?p=2839). GPT-Image-1 medium is $0.042; GPT Image 1.5 medium at 1024² is $0.034 — [Grida](https://canary.grida.co/ai/models); [apiyi](https://help.apiyi.com/?p=2839)
- **HomeLane SpaceCraft (launch press release, dated).** Claims project time is cut by 30 days (33%). Designers in a survey said they work 5x faster and close orders in 7 days instead of 30–45. SpaceCraft is a real-time 3D collaboration and visualization tool, not generative AI. — [ITVoice](https://www.itvoice.in/homelane-com-unveils-spacecraft-set-to-transform-how-people-design-their-homes)
- **Livspace.** Says its AI mood boarding and 3D rendering cut concept-to-visualisation time by 60% (self-reported, no method given) — [growwithcuong case study](https://growwithcuong.substack.com/p/case-study-ai-powered-interior-design). MeltFlex AI is used by Livspace designers to show concepts on photos of the client's own space, with no metrics given — [MeltFlex](https://www.meltflexai.com/case-studies/livspace). Separately, Fibr AI landing-page personalisation gave Livspace +40% leads, –32% cost per qualified meeting and –13% bounce rate. That is a vendor case study about marketing pages, not design. — [casestudies.com](https://www.casestudies.com/company/fibr-ai/case-study/livspace-drives-40-more-leads-with-fibr-ai)
- **IKEA Kreativ.** An AI and mixed-reality tool: scan a room, erase existing furniture, place IKEA products. The technology came from Geomagical Labs, acquired in 2020. — [VentureBeat](https://venturebeat.com/ai/ikea-launches-first-ai-powered-design-experience-no-swedish-meatballs-included); Canada launched June 2023 — [Retail Insight Network](https://www.retail-insight-network.com/newsletters/ikea-canada-kreativ-app). No published conversion figures; the CEO described a qualitative shift from transactional to experiential (Forbes India, Sep 2024, cited via search summary). Kreativ is linked to IKEA India's 2025 online expansion per a third-party blog — [markhub24](https://www.markhub24.com/post/ikea-india-s-digital-room-planning-experience-bridging-online-commerce-and-physical-retail)
- **Kitchen CPQ and configurators (vendor claims).**
  - VividWorks: kitchen and bath configurator that outputs BOMs, SKUs and assembly instructions and pushes quotes to ERP/CRM — [VividWorks](https://www.vividworks.com/industries/kitchen-bath)
  - ArchiLabs: automatic pricing, BOM and quote package as the customer configures, with a kitchen cabinet demo — [ArchiLabs CPQ](https://archilabs.ai/cpq)
  - AR-Range: modular furniture material and labour costing, with optional price display — [AR-Range](https://ar-range.app/modular-configurator)
  - Combeenation: real-time pricing including install and countertop per m² — [Combeenation](https://www.combeenation.com/en/knowledge/english-videoportal/detail/outdoor-kitchen-configurator/)
  - Odoo: configurators can push configurations into Odoo BOMs via XML-RPC/JSON-RPC — [ecosire](https://ecosire.com/zh/apps/odoo/odoo-furniture-mto-configurator)

### Inferences
- **Generative re-rendering is a fast, cheap differentiator for presales.** The presales manager uploads the customer's site photo, picks a Magppie collection, and gets 2–4 renders on WhatsApp within minutes, at under ₹20 per lead in API cost. Two risks remain. The model may invent cabinet layouts or proportions that cannot be built, so outputs should be labelled "mood preview, not design". And brand finishes need reference images to stay faithful; Kontext and Gemini both accept reference images.
- **Automatic quotation is the more defensible long-term project.** If Magppie's design tool (whatever designers use now) can export a cabinet or module list, a solo developer can turn that list into a priced, GST-applied quote PDF and attach it to the Zoho Deal. Buying a full 3D configurator is a larger, vendor-priced commitment.
- The HomeLane and Livspace numbers suggest the main measurable benefit of visualization is shorter cycle time (concept to order), not raw conversion. Track days-from-first-meeting-to-booking as the KPI.

### Gaps
- Not searched: 2020 Design, imos, Homestyler and Coohom API or export capabilities, and Indian CPQ vendors.
- No independent or A/B-tested conversion data for AI visualization in interiors.
- Official Google, BFL and OpenAI price pages were not fetched directly; prices come from aggregators.

## Credible case studies with measured results in furniture, interiors and home-improvement retail

### Takeaway
I found no independent, methodologically transparent case study with measured conversion uplift in furniture or interiors retail. Every number found (HomeLane 5x designer speed and 7-day closure, Livspace 60% faster visualisation and +40% leads, Agrex +17% conversion, DashVoice +25%) is self-reported by the brand or the vendor.

### Cited Findings
- HomeLane SpaceCraft: 33% shorter projects and orders closed in 7 days instead of 30–45, from a designer survey in a launch press release — [ITVoice](https://www.itvoice.in/homelane-com-unveils-spacecraft-set-to-transform-how-people-design-their-homes)
- Livspace: 60% faster concept-to-visualisation (self-reported) — [growwithcuong](https://growwithcuong.substack.com/p/case-study-ai-powered-interior-design); +40% leads from landing-page personalisation (vendor) — [casestudies.com](https://www.casestudies.com/company/fibr-ai/case-study/livspace-drives-40-more-leads-with-fibr-ai)
- Retail footfall analytics: +17% conversion within 11 weeks (vendor) — [Agrex](https://www.agrexai.com/footfall-analytics-india-2026-guide/)
- Conversation analytics: +1.5% sales within 12 weeks, BFSI (vendor, via Intel) — [Intel PDF](https://networkbuilders.intel.com/docs/networkbuilders/enhancing-business-performance-with-an-ai-driven-speech-analytics-platform-shyena-1719913654.pdf); +76% conversions at a US dealer — [Convirza](https://www.convirza.com/content-hub/conversation-analytics-transforms-business/)
- IKEA Kreativ: no measured outcome published — [VentureBeat](https://venturebeat.com/ai/ikea-launches-first-ai-powered-design-experience-no-swedish-meatballs-included)

### Inferences
- The modest, measured figure (+1.5% in banking) is probably closer to realistic than the double-digit marketing claims. Internal projects should be pitched on time saved and visibility, with conversion uplift as an upside to measure, not a promise.
- Magppie already runs presales monitoring dashboards, so any new tool can be measured in-house with a before/after or a showroom-versus-showroom comparison. That would give it better evidence than any vendor case study found.

### Gaps
- No peer-reviewed or audited studies found in this domain.
- IKEA and Ingka annual reports were not checked for digital-tool metrics.
