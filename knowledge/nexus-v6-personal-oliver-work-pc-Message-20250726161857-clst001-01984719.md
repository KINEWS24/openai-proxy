The NEXUS DNA Auto-Chunking & Card Generation Master Formula is a comprehensive framework designed to automatically segment various types of knowledge objects (such as text, images, audio, video, PDFs, links, data, messages, and mixed media) into distinct, logically separated NEXUS DNA Cards, also known as "Snippets." Each card is fully tagged and contains metadata for easy reference and retrieval. Here's a breakdown of the key components and rules outlined in the formula:

### Chunking Rules:
1. **Text & Multimodal Content:**
   - For texts exceeding 250 words, create a separate card for every 250-word section.
   - For logically recognizable sections (e.g., chapters, slides, emails, meetings, image series, datasets), each unit becomes one card.
   - Optionally, combine chunking by logical unit first, then by word count.

2. **Card Attributes:**
   - Each card receives a unique identifier (`UID`), tags, context, cluster information, metadata, and a source reference.
   - A `ParentUID` field points to the original object.
   - `ChunkNr` and `TotalChunks` fields indicate the card's sequence and total number in the series.
   - Every card must have an original link reference (URL, path, drive link, or source file) for direct access to the original document.

3. **Hierarchy & Access Control:**
   - Each object includes fields for hierarchy and access rights, such as `hierarchy_path`, `role_access`, `person_access`, and `external_access`.

4. **Output Formats:**
   - Cards are output in both .md (Markdown) for readability and RAG (Retrieval-Augmented Generation) and .json for API, automation, and machine intelligence, ensuring field parity.

5. **Verification & Compliance:**
   - Each card ends with a verification status: "Verification: OK" or "Check Needed: [Reason]."
   - GDPR/MCP/Enterprise readiness is ensured with fields for access rights, roles, DPO, confidentiality, and retention policy.

6. **Content Rating & Related Modalities:**
   - A mandatory `content_rating` field is included, with options like "neutral," "adult," "confidential," or "private."
   - Complex objects may have `related_modalities` and `embedded_objects` fields.

7. **Timestamps & Limits:**
   - `Created` and `Last Updated` fields use a minute-level ISO8601 timestamp.
   - A standard limit of 50 cards per object is set, with a warning in the root chunk if exceeded.

8. **Index Card:**
   - An index card exists for each object series (project, meeting, DNA series) with order, summary, and meta-information.

### Additional Rules for Calendar/Events:
- Recognize all persons (names, nicknames, aliases), times (today, tomorrow, times, weekdays), places (addresses, buildings, restaurants, hotels), and activities (eating, meeting, call, etc.).
- Create extensive search tags for each recognized entity and add synonym tags (e.g., "Essen" also tagged as "#Treffen," "#Meeting").

### Example Output:
The example provided illustrates a DNA Card output in both .md and .json formats, detailing the structure and fields required for a card representing an image object. The card includes metadata such as UID, tags, hierarchy, access rights, GDPR compliance, content rating, and verification status, along with a source link for the original image.

This formula ensures that all knowledge objects are systematically organized, easily accessible, and compliant with data protection regulations, facilitating efficient knowledge management and retrieval.