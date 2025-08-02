The NEXUS DNA Auto-Chunking & Card Generation system is designed to automatically split various types of knowledge objects (such as text, images, audio, video, PDFs, links, data, messages, and mixed media) into independent, logically separated NEXUS DNA Cards, also known as "Snippets." Each card is fully tagged and contains metadata for easy reference and retrieval. Here’s a breakdown of how the system works:

### Chunking Rules:
1. **Text & Multimodal Content:**
   - For texts exceeding 250 words, create one card per 250-word section.
   - For logically recognizable sections (e.g., chapters, slides, emails, meetings, image series, datasets), each unit becomes one card.
   - Optionally, combine chunking by logical unit first, then by word count.

2. **Card Details:**
   - Each card receives a unique identifier (`UID`), tags, context, cluster information, metadata, and a source reference.
   - A `ParentUID` field points to the original object.
   - Fields `ChunkNr` and `TotalChunks` provide numbering and indicate the card's place within the entire work.
   - Every card must have an original link reference (URL, path, drive link, or source file) to open the document or original upon request.

3. **Hierarchy & Access Rights:**
   - Each object includes fields for hierarchy path (e.g., organization, department, team, role, person) and access permissions (`role_access`, `person_access`, `external_access`).

4. **Output Formats:**
   - Cards are output in both .md (Markdown) for readability and RAG (Retrieval-Augmented Generation) and .json for API, automation, and machine intelligence, ensuring 100% field parity.

5. **Searchability & Referencing:**
   - Each card is searchable, linkable, and referable.
   - The source link is critical for proof, compliance, MCP (Model Card Protocol), RAG, audit, and data ownership.

6. **Mixed Modalities:**
   - For inputs with mixed modalities (e.g., PDFs with text and images, presentations, meetings with slides and audio), create separate cards for each modality and logical unit, always referencing the main object.

7. **Verification & Compliance:**
   - Each card ends with a verification status: "Verification: OK" or "Check Needed: [Reason]."
   - GDPR/MCP/Enterprise readiness is ensured with fields for access rights, roles, DPO (Data Protection Officer), confidentiality, and retention policy.

8. **Content Rating:**
   - A `content_rating` field is mandatory (default: "neutral"; other options: "adult", "confidential", "private").

9. **Related Modalities & Embedded Objects:**
   - Include `related_modalities` and `embedded_objects` for complex objects.

10. **Timestamps:**
    - `Created` and `LastUpdated` fields are mandatory, using minute-level ISO8601 timestamps.

11. **Card Limit:**
    - A standard limit of 50 cards per object is set, with a warning in the root chunk if the limit is reached.

12. **Index Card:**
    - An index card exists for each object series (e.g., project, meeting, DNA series) with order, summary, and meta-information.

### Example DNA Card Output:
The example provided illustrates how a DNA card is structured in both Markdown and JSON formats, including fields like UID, tags, title, summary, key points, hierarchy, access rights, GDPR compliance, content rating, and more.

### Additional for Calendar/Events:
- Recognize all persons (names, nicknames, aliases), times (today, tomorrow, times, weekdays), places (addresses, buildings, restaurants, hotels), and activities (eating, meeting, call, etc.).
- Create extensive search tags for each recognized entity and add synonym tags (e.g., "Essen" also tagged as "#Treffen", "#Meeting").

### Capture Information:
The capture method, extraction method, capture timestamp, and other metadata are included to provide context and traceability for each card.

This system ensures comprehensive, organized, and accessible documentation of knowledge objects, facilitating efficient information management and retrieval.