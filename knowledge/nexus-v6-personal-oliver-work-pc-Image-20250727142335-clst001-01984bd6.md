The NEXUS DNA Auto-Chunking & Card Generation Master Formula is a comprehensive framework designed to automatically split various types of knowledge objects (text, images, audio, video, PDFs, links, data, messages, mixed media) into independent, logically separated NEXUS DNA Cards, also known as "snippets." Each card is fully tagged and contains essential metadata for easy referencing and compliance.

### Key Features of the Formula:

1. **Automatic Chunking:**
   - Texts longer than 250 words are divided into separate cards, each containing up to 250 words.
   - Logical sections such as chapters, slides, emails, meetings, image series, and datasets are each treated as a single card.
   - Optional combination of chunking by logical unit first, then by word count.

2. **Card Metadata:**
   - Each card receives a unique identifier (UID), tags, context, cluster data, metadata, and a reference to the original source.
   - Cards include fields like `ParentUID`, `ChunkNr`, and `TotalChunks` to indicate their relationship within the original object.
   - A critical requirement is the inclusion of an original link reference (URL, path, drive link, or original file) for direct access to the source document.

3. **Hierarchy and Access Control:**
   - Objects have fields for organizational hierarchy and access permissions, specifying who can view or edit the object.
   - Hierarchy is defined through a structured path or individual fields for organization, department, team, role, and person.
   - Access control fields include `role_access`, `person_access`, and `external_access`.

4. **Output Formats:**
   - Cards are output in both .md (Markdown) format for readability and RAG (Retrieval-Augmented Generation) and .json format for API integration and automation.
   - Both formats are field-identical to ensure consistency.

5. **Verification and Compliance:**
   - Each card includes a self-check verification status, indicating whether the card is verified or needs further checking.
   - GDPR, MCP (Master Control Program), and enterprise readiness are ensured with fields for access rights, roles, DPO (Data Protection Officer), confidentiality, and retention policy.

6. **Content Rating and Related Modalities:**
   - A mandatory `content_rating` field categorizes content as "neutral," "adult," "confidential," or "private."
   - Complex objects may include `related_modalities` and `embedded_objects`.

7. **Timestamp and Indexing:**
   - Cards include `Created` and `LastUpdated` fields with minute-level timestamps in ISO8601 format.
   - A standard limit of 50 cards per object is set, with a warning in the root chunk if exceeded.
   - An index card is created for each object series, summarizing and providing meta-information.

### Example DNA Card Output:

The example provided illustrates a DNA card for an image object, detailing its UID, tags, title, summary, key points, and various metadata fields. It includes information about the object's hierarchy, access rights, GDPR compliance, content rating, and more. The card is designed to be easily searchable, linkable, and referenceable, with a system-critical source link for proof, compliance, and audit purposes.

### Content Description:

The content describes an image showing a web development environment used for editing and testing an application called "Restaurant Rater." The environment is divided into three main areas: a development code section, a task panel, and a UI preview area. The description highlights the components, user interaction, and goals of the development process, emphasizing the use of AI for recommendation systems and UI optimization for better restaurant discovery.