The NEXUS DNA Auto-Chunking & Card Generation Master Formula is a comprehensive framework designed to automatically split various types of knowledge objects (text, images, audio, video, PDFs, links, data, messages, mixed media) into independent, logically separated NEXUS DNA Cards or "snippets." Each card is fully tagged and contains metadata for easy searchability, linking, and referencing. Here's a breakdown of the key components and rules outlined in the formula:

### Chunking Rules:
1. **Text & Multimodal Content:**
   - For texts exceeding 250 words, create a card for each 250-word section.
   - For logically recognizable sections (e.g., chapters, slides, emails, meetings), each unit becomes one card.
   - Optionally combine chunking by logical unit first, then by word count.
   - Each card includes:
     - `UID`, unique tags, context, cluster, metadata, and source reference.
     - `ParentUID` to indicate the original object.
     - `ChunkNr` and `TotalChunks` for numbering and association within the complete work.
     - A mandatory original link reference for document access.

2. **Hierarchy & Access Rights:**
   - Every object has fields for hierarchy path (organization, department, team, role, person) or individual fields.
   - Access fields (`role_access`, `person_access`, `external_access`) define who can view/edit the object.

3. **Output Formats:**
   - Cards are output in both .md (Markdown) for readability and RAG (retrieval-augmented generation) and .json for API, automation, and machine intelligence, ensuring field parity.

4. **Verification & Compliance:**
   - Each card ends with a verification status ("Verification: OK" or "Check Needed: [Reason]").
   - GDPR/MCP/Enterprise-Ready fields for access rights, roles, DPO, confidentiality, and retention policy.
   - Content rating is mandatory (default: "neutral"; options: "adult", "confidential", "private").

5. **Additional Features:**
   - Related modalities/embedded objects for complex objects.
   - Created/Last Updated fields with minute-level ISO8601 timestamps.
   - Standard limit of 50 cards per object, with a warning in the root chunk if exceeded.
   - An index card for each object series (project, meeting, DNA series) with order, summary, and meta-info.

### Example DNA Card Output:
The example provided illustrates a DNA card for an image, detailing fields such as UID, ParentUID, ChunkNr, TotalChunks, Archetype, ObjectType, Subject, Tags, Title, Summary, KeyPoints, ImageDescription, LinkTarget, Hierarchy, Access, GDPR compliance, content rating, and more. The card is designed to be both human-readable and machine-processable.

### Additional for Calendar/Events:
- Recognize all persons (names, nicknames, aliases), times (today, tomorrow, times, weekdays), places (addresses, buildings, restaurants, hotels), and activities (eating, meeting, call, etc.).
- Create extensive search tags for each recognized entity and add synonym tags (e.g., "Essen" → "#Treffen", "#Meeting").

### Content Example:
The content provided is an article from TechCrunch about Meta's appointment of Shengjia Zhao as the chief scientist of their AI superintelligence unit. The article discusses Meta's strategic moves in AI research, including hiring top researchers and investing in cloud computing infrastructure.

### Calendar Detection Results:
The system detected calendar-related content with a 10% confidence level, identifying keywords like "event" and "agenda" but without a title or URL match.

### Capture Information:
Details about the capture method, extraction method, capture timestamp, and process ID are included, along with the source URL for reference.

This formula ensures that all knowledge objects are systematically organized, easily accessible, and compliant with data protection regulations, making it a robust solution for managing complex information in various formats.