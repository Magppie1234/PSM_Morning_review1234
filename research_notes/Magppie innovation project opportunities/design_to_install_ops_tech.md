# Design-to-Install Operations Technology (Premium Modular Kitchen / Wardrobe, India, 2026)

Scope: the back half of the business. Design handoff, BOM and cut lists, manufacturing planning, QC, logistics, site readiness, installation field operations, after-sales. Research done 2026-10-21 with a capped number of web searches (about 16). Many vendor specifics (pricing, API docs) could not be verified and are listed under Gaps. "Demonstrated" means a published result or a shipping product. "Theoretical" means proposed or inferred.

## Design-to-manufacturing: software, export formats, BOM/cut-list automation, rule-based validation, order-error evidence

### Takeaway
The main design-to-factory tools (Polyboard, imos iX, Cabinet Vision, Microvellum) all produce cut lists, BOMs and CNC output. Open, documented export formats were confirmed only for Polyboard (CSV/TXT cut list) and Cabinet Vision (XML-based ORD/ORDX order import), and SlabSmith (DXF for stone). The strongest industry evidence is that most rework starts at order entry and design handoff, not on the shop floor. That makes a solo-built validation layer between design output and the factory (BOM and cut-list sanity checks, rule checks) the highest-leverage project in this area.

### Cited Findings
- Polyboard can export the cutting list as CSV or TXT ("ASCII export"). The user picks the fields, their order and the separator, and this is in addition to PDF output — [Wood Designer: Polyboard cutting list export](https://wooddesigner.org/help-centre/polyboard-cutting-list-export/); [Polyboard output](https://wooddesigner.org/help-categories/polyboard-output/)
- Polyboard's CSV cut list is meant to be imported into spreadsheets and third-party optimisers. Integrating with CutList Plus only requires mapping Polyboard's output fields to the ones CutList accepts — [Wood Designer: CutList Plus integration](https://wooddesigner.org/cutlist-plus-polyboard-integration/); [OptiCut import](https://wooddesigner.org/opticut-cutting-list-set-up-polyboard-import/)
- Polyboard prices panels in a panel materials library, bars per metre, and fittings in a fittings library. Older forum answers (2020 and later) say edited material or price lists cannot be imported back. That is a limitation if pricing is managed outside the tool, and it may have changed since — [Wood Designer forum](https://wooddesigner.org/forum/polyboard/import-export-materials-and-fittings-from-and-to-csv-file/); [Cut list / cost report](https://wooddesigner.org/help-centre/polyboard-cut-list-plans-cost-report/)
- imos iX is described as integrated design-to-manufacturing software. The CAD side automatically outputs BOMs, drawings and production reports, and the CAM side generates CNC programs for the common machine makers. The specific export formats were not documented in what I found — [ipros directory listing](https://www.ipros.com/en/cg1/CAM/cnc/)
- Cabinet Vision accepts orders in .ord or .ordx format, and ORDX can be set to an XML data format. Third-party ordering platforms (Allmoxy) push orders into Microvellum as XML files — [Allmoxy: connecting to industry partner software](https://articles.allmoxy.com/connecting-allmoxy-to-industry-partner-software); [Allmoxy: Cabinet Vision export](https://articles.allmoxy.com/cabinet-vision-export)
- In a Microvellum community thread, a user asks whether a CSV export of drawer dimensions exists by default. The thread suggests per-part CSV exports are not obviously documented — [Microvellum Community](https://community.microvellum.com/portal/en/community/topic/drawer-export-as-a-csv-file)
- A woodworking forum notes that CNC routers usually take a DXF per part rather than a tabular cut list — [UKWorkshop forum](https://forums.ukworkshop.co.uk/threads/cutting-list-for-cnc.147245/)
- **Order-error evidence:** a Woodworking Network/FDMC article says that by the time information reaches the shop, most errors have already been made, causing 60 to 70 percent of go-backs. The article is older and the figure is anecdotal and undated — [Woodworking Network: How to cut back on go-backs](https://www.woodworkingnetwork.com/magazine/fdmc-magazine/how-cut-back-go-backs)
- Countertop fabrication: Moraware says fabricators should aim for 3% or less of sales in reworks. It puts the average fabricator at about 10% of business tied up in reworks. Both figures are Moraware's own, traced to a 2020 Moraware blog, with no independent study. It lists measurement errors, including wrong entries in CAD, as the most common cause, followed by installation mistakes, customer misuse, production mistakes and accidents — [Moraware: What percentage of your business goes to reworks?](https://www.moraware.com/?p=19582)
- A cabinet-maker digital-workflow playbook says many furniture and cabinet makers still use printed orders and re-key data by hand from design tools into ERP or MES. It recommends a single order of record connected to the design and ERP systems — [Feed the factory (playbook PDF)](https://wnaymg.files.cmp.optimizely.com/feed-the-factory)
- A cabinet manufacturer's designer guidance says many warranty claims can be prevented with better order-entry habits. It recommends sending drawings to the client before finalising orders so missing parts or conflicts are caught — [Decor Cabinets Academy](https://academy.decorcabinets.com/?p=22302)
- An INNERGY event is titled "Re-work Is Killing Your Margins: Lessons from Microvellum Shops". This shows the vendor ecosystem treats rework as a top problem, but the event gives no numbers — [INNERGY event](https://events.innergy.com/d/vdzwl3/1Q)

### Inferences
- Projects a solo developer can build: (1) a cut-list/BOM linter that ingests the design tool's CSV/XML export and checks it against rules: panel sizes within sheet limits, grain direction, edge-banding on every visible edge, hardware count matching cabinet count (hinges per door height, drawer runners per drawer), appliance cut-outs matching the appliance spec sheet, and minimum clearances; (2) a design-to-order diff that compares what the customer signed, the BOM, and what was released to the factory. Both rely on one stable export, which Polyboard and Cabinet Vision/Microvellum offer through CSV or XML.
- Rule-based ergonomic and clearance checks (e.g. hob-to-tall-unit gap, door swing against appliance handles, counter height) are a deterministic rules engine and need no ML. They are cheap to build once the export schema is known. This is theoretical: I found no vendor or case study publishing a measured error reduction from this kind of linter.
- For stone/quartz countertops, measurement and CAD-entry errors are the top cause of rework (Moraware). A digital-template-to-DXF check (templated dimensions against kitchen design dimensions) targets the most expensive failure directly.

### Gaps
- Pricing for 2020 Design, imos iX, Cabinet Vision, Microvellum, KD Max and Polyboard was not retrieved. These are typically quote-based or per-seat licences, so check vendor pages.
- KD Max (common in China and India) export formats and 2020 Design API/export documentation were not found.
- No published cabinet-specific industry average for remake rate. The 60 to 70% figure is the share of go-backs caused by order entry, not a remake rate. Magppie's own remake log by cause would be the real baseline.
- No case study found with a measured before/after error reduction from automated design validation.
- SketchUp plugin exports (e.g. OpenCutList, CutList Bridge) were not researched in this pass.

## Production: nesting, scheduling, digital job travellers, vision QC for panels and stone

### Takeaway
Open-source nesting exists (SVGnest; Deepnest adds DXF), but it has reliability caveats such as DXF unit scaling. Stone countertop nesting is a mature commercial category (SlabSmith, SlabOS) built on slab photos and DXF from laser templaters. Panel and stone defect detection with YOLO-class models is well demonstrated in research, with roughly 78 to 90% mAP@50 on panel and plank datasets. Those systems need a fixed camera, controlled lighting and labelled data, so a solo developer should treat them as a later project unless they start with smartphone-based human-review triage.

### Cited Findings
- Deepnest is an open-source nesting desktop app for laser, plasma and other CNC machines. It is based on SVGnest, adds DXF support by conversion, exports DXF and SVG, and runs on Windows, macOS and Linux — [GitHub: Deepnest fork](https://github.com/functionalprototype/Deepnest); [AlternativeTo: Deepnest](https://alternativeto.net/software/deepnest)
- Licensing is reported second-hand as permissive for SVGnest and unclear for Deepnest. A user also reports that a 380 mm object imported at 1077 mm, a DXF unit-scaling problem, because DXF does not store units. Check the LICENSE files — [LightBurn forum](https://forum.lightburnsoftware.com/t/nesting-or-organisation-of-shapes/1411)
- SlabSmith (Northwood Designs) is described as both a manufacturing aid and a sales tool for stone. The workflow: template the space, place the countertop shapes on slab images, get customer approval of the layout, then export a DXF of the nest for manufacturing. Its "Perfect Match" module handles nesting — [Stoneworld: Embracing today's technology](https://stoneworld.com/articles/85717-embracing-today-s-technology) (older article)
- A Slabwise guide says SlabSmith photographs slabs with a calibrated overhead rig, reads DXF from the major laser templaters, can nest several jobs together, runs on Windows, and reports accuracy of about ±1/16 inch on a good setup. This is a third-party guide — [Slabwise: What is SlabSmith used for](https://slabwise.com/guides/what-is-slabsmith-software-used-for-in-stone-fabrication); [Slabwise: Countertop layout with SlabSmith](https://slabwise.com/guides/how-to-do-countertop-layout-on-a-slab-using-slabsmith)
- SlabOS (a competitor) markets automatic slab nesting that fits more pieces per slab to cut waste — [Capterra: SlabOS](https://www.capterra.in/software/1102817/SlabOS)
- Decorative melamine panels (2025): a real-time inspection system on an NVIDIA Jetson Nano. YOLO beat traditional computer vision, which struggled with changes in lighting and camera angle. Real defect images were scarce, so synthetic data was generated. The modified YOLOv8 reached 78% mAP@50 on edge breakage, scratches and surface damage, using GAN-generated images to fix class imbalance — [Scitepress 2025: Real-time visual inspection of decorative wood panels](https://scitepress.org/PublishedPapers/2025/137822)
- EFCW-YOLO (Forests, Nov 2025): a lightweight YOLOv8n variant reached 90.26% mAP50 with a 6.12 MB model on a self-built multi-species plank dataset (PlankDef-9K) — [MDPI Forests 16:1757](https://mdpi-res.com/d_attachment/forests/forests-16-01757/article_deploy/forests-16-01757.pdf)
- A 2026 comparative study (Faster R-CNN with MobileNetV3-FPN vs YOLOv8s, seven classes) warns that reported performance shifts substantially with benchmark design and domain shift — [CMC 2026](https://www.sciopen.com/article/10.32604/cmc.2026.083365)
- A January 2026 review covers wood surface defect detection (knots, cracks, resin pockets), with YOLO and two-stage detectors as the main families — [Applied Computing and Intelligence 2026 review](https://www.aimspress.com/aimspress-data/aci/2026/1/PDF/aci-06-01-001.pdf)
- An older YOLOv5 study used 839 images from the public "Wood Defect Database" covering live knots, dead knots, cracks and holes — [BJFU journal](https://j.bjfu.edu.cn/en/article/doi/10.12171/j.1000-1522.20220419)
- Stone: an autoencoder-based marble surface anomaly detector, trained without labels on a Kaggle marble dataset, reported 89% accuracy (Jurnal EECCIS, 2024) — [DOAJ: EECCIS 2024](https://doaj.org/article/e2b690a36ddb4b4d89badcc0276cc8e5)
- Stone: a deep-learning comparison for marble crack detection on thermal and RGB slab images (Springer, 2023) — [Springer chapter](https://link.springer.com/chapter/10.1007/978-981-99-4626-6_36); YOLOv5 for granite rock class and defects (CILAMCE 2022) — [CILAMCE 2022 paper](https://publicacoes.softaliza.com.br/cilamce2022/article/download/5267/4335/965)
- DeepMarbleVision (CMC 2026) reached 99.5% accuracy on a three-class marble quality grading dataset. This is grading, not defect localisation — [CMC 2026 DeepMarbleVision](https://www.techscience.com/cmc/v89n2/68783)
- A public Roboflow stone dataset covers pit, spot and crack defects across granite, marble and other stones — [Roboflow Universe](https://universe.roboflow.com/astonetech/stone-classification-wpmay/model/2/train/results)
- Factory tracking: Offsight (a modular manufacturing project-management product) offers real-time production status per order and alerts when orders fall behind. This is a vendor claim — [BuiltWorlds: Offsight](https://builtworlds.com/companies/offsight/)

### Inferences
- For a solo developer, a **digital job traveller** (QR label per panel or carcass linked to the order, scanned at each station: cut, edge, bore, assemble, pack, dispatch) is low-tech and high-value. It enables the dispatch completeness check ("all 143 parts of order X scanned at packing") that prevents short-shipments to site. This is inferred, with no measured case study found here.
- Nesting optimisation is only worth building if Magppie cuts its own panels and the design tool lacks an optimiser. Polyboard, imos and Cabinet Vision bundle or integrate optimisers. For stone, commercial tools are mature, and a custom build would only make sense for photo-based slab-vein matching previews for customers.
- Vision QC: the published systems use fixed cameras, controlled light and hundreds to thousands of labelled images. The realistic starting point is smartphone photos at final inspection, logged against each part, with a model (or VLM) flagging likely defects for human confirmation, while building a labelled dataset for a later fixed-camera YOLO model.
- The OR-Tools CP-SAT solver could schedule production jobs (job-shop scheduling). This is theoretical for Magppie, and I did not research it in depth this pass.

### Gaps
- No measured case study of nesting yield improvement for a kitchen maker. No SlabSmith or SlabOS pricing was retrieved.
- No published accuracy for smartphone-captured (uncontrolled) panel or stone defect detection.
- Whether Magppie's stone, steel or engineered materials are cut in-house or by suppliers decides which of these projects apply. That is unknown.

## Installation and field operations: site readiness, installer apps, photo audits, snags, crew routing, customer tracking

### Takeaway
Indian leaders (Livspace, HomeLane) run site-operations apps and customer live-tracking. HomeLane job descriptions show a "materials on site before crews are assigned" readiness gate. Google OR-Tools supports VRP with time windows for scheduling installer crews, free. No source showed vision-model verification of site readiness in production. It is a buildable but undemonstrated idea that should be designed around human review.

### Cited Findings
- Livspace's "Trackpad" iOS app is a "one-stop application to manage site operations and tasks". Users view project timelines, mark task start and end dates, and update progress — [App Store: Livspace Trackpad](https://apps.apple.com/us/app/-/id1616007808)
- Singapore's IMDA directory describes Livspace's "fulfillment cloud" as order management for brands and OEMs, project management for contractors, and live tracking for customers — [IMDA: Livspace](https://www.imda.gov.sg/resources/innovative-tech-companies-directory/livspace)
- Livspace's in-house Canvas platform does 2D/3D visualisation, budgeting and project tracking. It makes modular kitchens and wardrobes in its factories, then installs on site — [Wikipedia: Livspace](https://en.wikipedia.org/wiki/Livspace); [Orange Owl: Livspace story](https://orangeowl.marketing/unicorn-chronicles/livspace-success-story/)
- A CB Insights summary says Livspace's supply chain and project tracking are overseen by predictive AI. This is a secondary, news-based summary and unverified — [CB Insights: Livspace](https://www.cbinsights.com/company/livspace)
- A HomeLane project manager job post: the role reports to an installation manager, checks drawings, confirms materials are on site before crews are assigned, and updates the coordinator and customer until completion. This is a recruiting ad, not an operations disclosure — [Weekday: HomeLane PM interiors](https://jobs.weekday.works/project-manager-interiors-at-homelane-wkdyjldoxc)
- Google OR-Tools officially supports the Vehicle Routing Problem with Time Windows (VRPTW). It uses a travel-time matrix plus a time dimension and minimises total travel time — [Google OR-Tools: VRPTW](https://developers.google.com/optimization/routing/vrptw)
- OR-Tools "disjunctions" allow visits to be dropped with a penalty, useful when no qualified crew is available — [Activimetrics: Exploring disjunctions in OR-Tools](https://activimetrics.com/blog/ortools/exploring_disjunctions/)
- A 2023 ISARC paper proposes monitoring factory assembly with computer vision plus BIM, noting that cycle times in modular factories vary widely. This is construction-adjacent, not kitchens — [ISARC 2023 paper](https://www.iaarc.org/publications/fulltext/001_ISARC_2023_Paper_197.pdf)

### Inferences
- **Site-readiness gate before dispatch** (theoretical but buildable): before releasing a kitchen for dispatch, the site supervisor or customer submits a set of guided photos and a short video (walls plastered and painted, floor tiles laid, plumbing and electrical points at the drawing positions, window and door frames fixed, site dry and clean). A VLM gives a first-pass classification ("looks ready / not ready / unclear") per checklist item. Anything not clearly "ready" goes to a human. The value comes from avoiding wasted dispatch and installer trips. HomeLane's own JD shows readiness is a human gate today.
- **Proof-of-installation photo audit**: required photos at handover (each wall elevation, hinge alignment, gaps, countertop joints, appliance fitment), checked for completeness automatically (right count, right angles, not blurry, geotag and timestamp match) and spot-checked by a human. Completeness checks are reliable. Quality judgement by VLM is not (see the VLM section).
- **Crew routing**: Indian metro installer scheduling is multi-day and job-length-driven rather than many stops per day. OR-Tools VRPTW with skills restrictions (allowed vehicles per node; check the current API) and disjunctions fits. A solo developer can run it on a single server for free. Payoff depends on crew count, and for under 10 crews a well-built calendar may be enough.
- **Customer progress tracking** (Livspace-style live tracking) is mostly data plumbing from the job traveller and installer app into a customer-facing status page or WhatsApp updates.

### Gaps
- No case studies were retrieved for IKEA/TaskRabbit, Wren, Magnet or Howdens installer operations in this pass (tool-call budget). No measured outcomes (fewer failed site visits, fewer installation days) were found for any firm.
- No source found showing VLM-verified site-readiness in production at any interiors company.
- Livspace and HomeLane installation durations and first-time-right rates were not found in public sources.

## After-sales: WhatsApp photo ticket triage, predictive maintenance, spare-part identification

### Takeaway
WhatsApp Business Platform messaging in India is cheap: service replies are free inside the 24-hour window, and utility messages cost roughly ₹0.11 to ₹0.16. Aggregators report a change from 1 October 2026 that I could not confirm with Meta. That makes a WhatsApp photo-intake service bot cheap to run. Triage (category, urgency, likely part) suits a VLM plus human. I found no evidence for predictive maintenance on kitchen hardware, and it is low-value for a kitchen brand compared with photo-based triage.

### Cited Findings
- India WhatsApp rates in early 2026, per aggregators: marketing about ₹0.78 to ₹0.88 (Robylon) or ₹1.09 (AiSensy); utility about ₹0.11 to ₹0.16 (Robylon) or ₹0.145 (AiSensy); service messages free inside the 24-hour customer-service window. Sources conflict — [Robylon: WhatsApp API pricing India](https://www.robylon.ai/blog/whatsapp-business-api-pricing-india); [AiSensy: per-message pricing Jan 2026](https://m.aisensy.com/blog/whatsapp-api-new-pricing/)
- TelecomTalk reports that from 1 Oct 2026 Meta charges ₹0.115 per delivered service and utility message, with 1,000 free service messages per business number per month. AiSensy says utility templates inside an open window also become chargeable. Not confirmed against Meta's own rate card — [TelecomTalk](https://telecomtalk.info/whatsappbusiness-price-reveal-telegram-arattai-may-benefit/1012403/); [AiSensy: October 2026 update](https://m.aisensy.com/blog/whatsapp-pricing-update-october-2026/)
- Moraware lists customer misuse or poor care as one category of countertop rework, which supports structured intake that separates warranty from misuse claims — [Moraware](https://www.moraware.com/?p=19582)

### Inferences
- **WhatsApp service intake**: the customer sends a photo or video plus order number. The bot pulls the order's BOM (the hardware brand and model used, from the design export), a VLM proposes a category (hinge sag, drawer runner, soft-close failure, edge-band peel, countertop chip or stain, appliance issue), and a human approves. The ticket goes to a technician with the likely spare part pre-picked. Matching a part from the order's own BOM is far more reliable than open-ended image identification.
- Predictive maintenance of appliances belongs to the appliance OEMs (Hettich, Blum, Bosch and others), not the kitchen brand. A proactive service programme, such as a 12-month hinge and runner adjustment visit scheduled automatically from the installation date, is the practical form.

### Gaps
- No published accuracy for VLM-based furniture or hardware warranty triage.
- No public spare-parts image-identification product for cabinet hardware was found (not searched in depth).
- Meta's official India rate card was not fetched directly.

## Vision-language model reliability for inspection tasks and human-in-the-loop design

### Takeaway
On the main industrial anomaly benchmark (MMAD, ICLR 2025), the best general model, GPT-4o, scored only about 74.9% average accuracy, which the authors call well below industrial requirements. A 2026 preprint found no VLM above 75% at detecting missing parts, and Claude Sonnet 4.6 scored 44.1%. Models also degrade on small objects. VLMs should therefore be used for triage, completeness checks and drafting, with a human approving any pass/fail decision on quality, dispatch or warranty.

### Cited Findings
- MMAD: 39,672 questions over 8,366 industrial images in seven subtasks. GPT-4o was the best model tested at 74.9% average accuracy, and the authors conclude this falls short of industrial deployment needs — [arXiv 2410.09453 (MMAD)](https://arxiv.org/html/2410.09453v3); [ICLR 2025 proceedings](https://proceedings.iclr.cc/paper_files/paper/2025/hash/d91ffbe9c126765755ff52d36b715683-Abstract-Conference.html)
- A follow-up 7B "Thinking" model, AD-Copilot, reportedly reached 82.29% on MMAD, beating GPT-4o. This comes from a secondary summary and needs checking against the paper — [AlphaXiv overview 2603.13779](https://www.alphaxiv.org/overview/2603.13779)
- MissingBench-Verified (2026 preprint): 10 VLMs tested on images with essential parts removed. None exceeded 75% at recognising the absence, Claude Sonnet 4.6 scored lowest at 44.1%, and some models showed an "existence bias", claiming removed parts were clearly visible — [arXiv 2607.18673](https://arxiv.org/pdf/2607.18673)
- IJCAI 2025: across 11 large VLMs, performance is significantly worse on small-object queries, and performance on regular-sized objects does not predict it. Chain-of-thought and image resizing help to varying degrees — [IJCAI 2025: Visual detail hallucinations](https://www.ijcai.org/proceedings/2025/212)
- Hallucination surveys link fine-detail errors to the vision encoder's limited resolution and poor capture of fine-grained semantics. Feeding outputs of small domain-expert vision models into the VLM as evidence improves precision — [Survey review (Moonlight)](https://www.themoonlight.io/tw/review/a-survey-on-hallucination-in-large-vision-language-models); [AlphaXiv: Mitigating hallucination with visual supervision](https://www.alphaxiv.org/abs/2311.16479.md)
- Rawte et al. (TrustNLP 2025) define eight visual hallucination types and a vulnerability index (VHVI) for ranking VLMs — [ACL Anthology](https://preview.aclanthology.org/setup/2025.trustnlp-main.32)

### Inferences
- The failure modes that matter most for Magppie's use cases are missing-part detection (e.g. "is the plumbing point present?", "are all handles fitted?"), small defects (chips, scratches, gaps of a few millimetres) and false "looks fine" answers. All three are documented weaknesses. VLM output should never be the only gate for dispatch, handover sign-off or warranty rejection.
- Human-in-the-loop design pattern (inferred from the above):
  1. Deterministic checks first: photo count, required angles, blur and exposure, EXIF timestamp and geotag, order ID.
  2. VLM classifies each checklist item into "pass / fail / unclear" with a mandatory short reason. Ask about one item per prompt, crop or zoom on the region, and ask "what is missing" explicitly.
  3. Route anything "fail" or "unclear", plus a random 10 to 20% sample of "pass" (a design choice, not a sourced figure), to a human reviewer.
  4. Log human overrides as labelled data to measure VLM precision and recall on Magppie's own images and to train a small specialised detector later, the expert-model hybrid suggested in the literature.
  5. Report the model's measured agreement rate monthly before trusting it more.
- Asymmetric errors: a false "not ready" costs a human review, while a false "ready" costs a wasted truck trip and an installer day. Tune prompts and thresholds toward flagging.

### Gaps
- No public head-to-head benchmark of current Gemini, GPT and Claude models specifically on construction-site readiness or furniture-defect photos.
- No published human-in-the-loop field study with measured outcomes for VLM inspection in interiors or furniture.
- Current API prices for vision calls were not retrieved in this pass. Check the vendor pricing pages, since pricing changes often.
